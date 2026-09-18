#!/bin/bash
# flash-station.sh — one production board, start to ship-ready:
#   flash current firmware → read MAC → derive serial → factory-wipe NVS
#   → verify setup mode → print the evidence ledger row.
#
# Usage (from the repository root, exactly ONE board plugged in):
#   hardware/procedures/flash-station.sh [/dev/cu.usbmodemXXXX]
#
# Prerequisites: arduino-cli with the pinned esp32 core, esptool >= 5
# (python3 -m esptool), pyserial, and a compiled build in
# firmware/dk01/out/ (arduino-cli compile --fqbn "$FQBN"
# --output-dir firmware/dk01/out firmware/dk01).
#
# MatrixPortal S3 bench gotchas this script exists to absorb
# (learned on the 2026-08-26 first-ship night — see
# hardware/evidence/2026-08-26-r0-first-ship-bench.md):
#   * The native-USB port re-enumerates on every reset and for a few
#     seconds after plug-in. Never pin a port node: glob at each use,
#     and require the same node twice, 2 s apart, before trusting it.
#   * The FIRST esptool touch after any reset often dies mid-connect
#     ("Device not configured"). One re-glob + retry always recovered
#     it. Every esptool call here retries exactly once, then fails.
#   * The port is exclusive-open on macOS: close serial monitors
#     before running this.
#   * refresh_hz reads low (~170) for the first stat line after boot,
#     then settles at 200 idle. Judge only settled lines.
# …and on the hardened script's first real board (2026-09-18 — see
# hardware/evidence/2026-09-18-flash-station-first-real-run.md):
#   * A board plugged in with BOOT held, or otherwise latched into the ROM
#     loader, stays there across esptool's default RTS reset: the firmware
#     never boots, nothing reaches serial, and NVS is never populated. A
#     watchdog reset re-samples the boot pins, so every direct esptool
#     call here ends with one.
#   * The core's upload wrapper (tools/flasher.py) leaves *_flashed.bin
#     copies in the build folder and diffs the NEXT upload against them.
#     esptool MD5-checks the flash before trusting that diff, so it is
#     safe, but the next board then gets a partial or skipped write that
#     cannot be held to a fixed standard. The references are cleared
#     before every upload: a station writes every board in full.
#   * A fresh board can carry NVS that only ESP-IDF itself wrote (RF
#     calibration and Wi-Fi driver defaults). That is not another
#     product's provisioning; the gate below calls it "factory".
#
# Fail-closed rules (EH-01 in docs/reviews/2026-09-08-full-review/
# examples-hardware-operations.md; exercised without hardware by
# flash-station.test.sh, which injects every failure listed here):
#   * every esptool / arduino-cli exit status is checked — the one retry
#     covers the first-touch re-enumeration, never a second failure;
#   * the pre-flash NVS sniff must return exactly NVS_SIZE bytes before
#     it is classified as blank / dk01 / foreign;
#   * the build's partition table must place `nvs` at NVS_OFFSET+NVS_SIZE,
#     and the table read back from the board after flashing must equal
#     the build's byte for byte — nothing is erased otherwise;
#   * the upload must hash-verify exactly the regions the board package
#     writes (bootloader, partition table, boot_app0, app, TinyUF2), at
#     the addresses the build's own partition table implies;
#   * one device identity per run: the eFuse MAC read before flashing
#     must match after the flash and after the setup-mode observation,
#     the boot banner and hotspot name seen on serial must belong to this
#     build and this board, and no step may see more than one port.
# shellcheck disable=SC2012

set -u

FQBN="esp32:esp32:adafruit_matrixportal_esp32s3"
BUILD_DIR="firmware/dk01/out"
SKETCH="firmware/dk01"
NVS_OFFSET="0x9000"
NVS_SIZE="0x5000"
PT_OFFSET="0x8000"        # ESP-IDF partition table …
PT_SIZE="0xC00"           # … 3 KiB: entries plus the MD5 record
BOOTLOADER_ADDR="0x0"     # The core's upload pattern (platform.txt
BOOT_APP0_ADDR="0xe000"   #   tools.esptool_py.upload.pattern_args) writes
APP_ADDR="0x10000"        #   these fixed addresses; TinyUF2 comes from the table.
# The next two are overridden only by the fault-injection harness.
PORT_GLOB="${DMX_PORT_GLOB:-/dev/cu.usbmodem*}"
STAT_WINDOW_S="${DMX_STAT_WINDOW_S:-30}"

die() { echo "FAIL: $*" >&2; exit 1; }
hex() { printf '0x%x' "$(( $1 ))"; }   # 0x00010000, 0x10000 and 65536 → 0x10000

# Optional first argument: an explicit port node. With it, every step
# targets that node and nothing globs. Without it, exactly ONE board may
# be cabled: every glob refuses to choose between two ports.
FIXED_PORT="${1:-}"
if [ -n "$FIXED_PORT" ]; then
  [ -e "$FIXED_PORT" ] || die "no such port: $FIXED_PORT"
fi

APP_BIN="$BUILD_DIR/dk01.ino.bin"
PT_BIN="$BUILD_DIR/dk01.ino.partitions.bin"
[ -f "$APP_BIN" ] || die "no build in $BUILD_DIR — compile first (see header)"
[ -f "$PT_BIN" ] || die "no partition table in $BUILD_DIR — compile first (see header)"
BUILD_VERSION=$(grep -a -oE 'Devmatrix DK-01 fw [0-9]+\.[0-9]+\.[0-9]+' "$APP_BIN" | head -1 | awk '{print $NF}')
[ -n "$BUILD_VERSION" ] || die "cannot read the firmware version banner from $APP_BIN"
if command -v shasum >/dev/null 2>&1; then BUILD_SHA=$(shasum -a 256 "$APP_BIN" | cut -c1-64); else BUILD_SHA=$(sha256sum "$APP_BIN" | cut -c1-64); fi

pt_entries() {
  # Print "label offset size" for every ESP-IDF partition entry (magic 0xAA50).
  python3 - "$1" <<'PYEOF'
import struct, sys
d = open(sys.argv[1], 'rb').read()
for i in range(0, len(d) - 31, 32):
    e = d[i:i + 32]
    if e[:2] != b'\xaa\x50':
        continue
    off, size = struct.unpack('<II', e[4:12])
    print(e[12:28].rstrip(b'\0').decode('ascii', 'replace'), hex(off), hex(size))
PYEOF
}
pt_field() { printf '%s\n' "$1" | awk -v l="$2" -v c="$3" '$1 == l { print $c; exit }'; }

# The erase below targets NVS_OFFSET blind, so the build's own partition
# table must agree — and the fixed upload addresses must land in the
# partitions they are meant for.
PT_ENTRIES=$(pt_entries "$PT_BIN") || die "cannot parse $PT_BIN"
NVS_OFF_BUILD=$(pt_field "$PT_ENTRIES" nvs 2)
NVS_SIZE_BUILD=$(pt_field "$PT_ENTRIES" nvs 3)
if [ "$(hex "${NVS_OFF_BUILD:-0}")" != "$(hex "$NVS_OFFSET")" ] || [ "$(hex "${NVS_SIZE_BUILD:-0}")" != "$(hex "$NVS_SIZE")" ]; then
  die "the build's partition table puts nvs at ${NVS_OFF_BUILD:-?}+${NVS_SIZE_BUILD:-?}, not $NVS_OFFSET+$NVS_SIZE — refusing to erase blind"
fi
OTADATA_OFF=$(pt_field "$PT_ENTRIES" otadata 2)
OTA0_OFF=$(pt_field "$PT_ENTRIES" ota_0 2)
UF2_OFF=$(pt_field "$PT_ENTRIES" uf2 2)
[ -n "$OTADATA_OFF" ] && [ "$(hex "$OTADATA_OFF")" = "$(hex "$BOOT_APP0_ADDR")" ] \
  || die "otadata is not at $BOOT_APP0_ADDR in the build's table; the core's upload pattern would write boot_app0 into the wrong partition"
[ -n "$OTA0_OFF" ] && [ "$(hex "$OTA0_OFF")" = "$(hex "$APP_ADDR")" ] \
  || die "ota_0 is not at $APP_ADDR in the build's table; the core's upload pattern would write the app into the wrong partition"
[ -n "$UF2_OFF" ] || die "no uf2 partition in the build's table — not the TinyUF2 scheme the kit ships with (USB recovery would be lost)"
EXPECTED_ADDRS="$(hex "$BOOTLOADER_ADDR") $(hex "$PT_OFFSET") $(hex "$BOOT_APP0_ADDR") $(hex "$APP_ADDR") $(hex "$UF2_OFF")"

stable_port() {
  # Echo a port node only after it reports the same name twice, 2 s apart.
  local tries=0 p p2 n
  if [ -n "$FIXED_PORT" ]; then
    while [ $tries -lt 30 ]; do
      [ -e "$FIXED_PORT" ] && { echo "$FIXED_PORT"; return 0; }
      sleep 1; tries=$((tries + 1))
    done
    return 1
  fi
  while [ $tries -lt 30 ]; do
    # shellcheck disable=SC2086
    n=$(ls $PORT_GLOB 2>/dev/null | wc -l | tr -d ' ')
    [ "$n" -gt 1 ] && die "multiple usbmodem ports — one board at a time, or pass one explicitly: $0 /dev/cu.usbmodemXXXX"
    # shellcheck disable=SC2086
    p=$(ls $PORT_GLOB 2>/dev/null | head -1)
    if [ -n "${p:-}" ]; then
      sleep 2
      # shellcheck disable=SC2086
      p2=$(ls $PORT_GLOB 2>/dev/null | head -1)
      [ "$p" = "$p2" ] && { echo "$p"; return 0; }
    fi
    sleep 1; tries=$((tries + 1))
  done
  return 1
}

run_esptool() {
  # esptool against a freshly-globbed stable port. On a non-zero exit,
  # wait out one S3 re-enumeration and retry exactly once; a second
  # failure is fatal. Output reaches stdout only on success.
  local port out rc
  port=$(stable_port) || die "no stable USB port (is the board plugged in?)"
  out=$(python3 -m esptool --after watchdog-reset --port "$port" "$@" 2>&1); rc=$?
  if [ $rc -ne 0 ]; then
    echo "   (esptool $1: first touch failed — retrying once)" >&2
    sleep 3
    port=$(stable_port) || die "port never came back after the esptool retry wait"
    out=$(python3 -m esptool --after watchdog-reset --port "$port" "$@" 2>&1); rc=$?
    [ $rc -eq 0 ] || die "esptool $1 failed twice (exit $rc): $(printf '%s\n' "$out" | tail -3 | tr '\n' ' ')"
  fi
  printf '%s\n' "$out"
}

read_mac() {
  local out mac
  out=$(run_esptool read-mac) || return 1
  mac=$(printf '%s\n' "$out" | grep -oE '([0-9a-f]{2}:){5}[0-9a-f]{2}' | head -1)
  [ -n "$mac" ] || return 1
  echo "$mac"
}

same_board() {  # same_board <when>
  local mac
  mac=$(read_mac) || die "could not re-read the MAC $1 — port lost; nothing further touched. If the panel stays dark the S3 is parked in its ROM loader: run 'python3 -m esptool chip-id' to reset it (docs/MANUAL.md ch. 10), then re-run this board"
  [ "$mac" = "$MAC_BEFORE" ] || die "board changed $1 ($MAC_BEFORE → $mac) — stopping; re-run per board"
}

NVSDUMP=$(mktemp "${TMPDIR:-/tmp}/nvs-sniff.XXXXXX") || die "mktemp failed"
PTDUMP=""
trap 'rm -f "$NVSDUMP" "$PTDUMP"' EXIT

echo "== 1/6 build + board =="
echo "   build $BUILD_VERSION  sha256 ${BUILD_SHA:0:12}…  regions: $EXPECTED_ADDRS"
PORT=$(stable_port) || die "no stable USB port (is the board plugged in?)"
echo "   $PORT"
MAC_BEFORE=$(read_mac) || die "could not identify the board on $PORT"
echo "   board $MAC_BEFORE"

# Foreign-device gate. A board is safe to process when its NVS region
# is factory-blank, carries dk01's own namespace (a dev kit boots and
# re-populates NVS immediately, so wiped boards read as dk01-occupied),
# or holds nothing but ESP-IDF's own namespaces with no saved Wi-Fi
# network ("factory": a fresh board whose test firmware touched the
# radio). Anything else — another namespace, a saved network, or data
# that does not parse — belongs to a DIFFERENT product or setup. On the
# first ship night a provisioned closed-product device on a second
# cable was flashed and wiped by mistake; this gate is why that can't
# recur. Deliberate override:
#   FLASH_ANYWAY=1 hardware/procedures/flash-station.sh <port>
sleep 2
run_esptool read-flash "$NVS_OFFSET" "$NVS_SIZE" "$NVSDUMP" >/dev/null || die "could not sniff NVS before flashing"
GOT=$(wc -c < "$NVSDUMP" | tr -d ' ')
[ "$GOT" -eq $(( NVS_SIZE )) ] || die "NVS sniff returned $GOT bytes, expected $(( NVS_SIZE )) — refusing to classify a partial read"
NVS_STATE=$(python3 - "$NVSDUMP" <<'PYEOF'
import sys
SYSTEM = {'phy', 'nvs.net80211', 'misc'}   # ESP-IDF's own: RF calibration, Wi-Fi driver state, system
d = open(sys.argv[1], 'rb').read()
def key(e):
    return e[8:24].split(b'\0')[0].decode('ascii', 'replace')
def classify(d):
    if all(b == 0xFF for b in d):
        return 'blank'
    if b'dk01' in d:
        return 'dk01'
    items = []                                   # (entry, payload of its extra span slots)
    for pg in range(0, len(d) - 4095, 4096):     # NVS page: 32 B header, 32 B state bitmap, 126 entries
        page = d[pg:pg + 4096]
        if page[:4] == b'\xff\xff\xff\xff':
            continue
        bitmap, i = page[32:64], 0
        while i < 126:
            e = page[64 + 32 * i: 96 + 32 * i]
            if (bitmap[i // 4] >> (i % 4 * 2)) & 3 == 2:     # written
                span = max(1, e[2])
                items.append((e, page[96 + 32 * i: 64 + 32 * (i + span)]))
                i += span
            else:
                i += 1
    names = {e[24]: key(e) for e, _ in items if e[0] == 0 and e[1] == 0x01}
    if not names or any(n not in SYSTEM for n in names.values()):
        return 'foreign'
    wifi = [i for i, n in names.items() if n == 'nvs.net80211']
    for e, payload in items:                     # a saved station SSID means it was set up as something
        if e[0] in wifi and key(e) == 'sta.ssid' and e[1] != 0x48:
            if any(b not in (0x00, 0xFF) for b in payload[4:36]):
                return 'foreign-wifi'
    return 'factory'
print(classify(d))
PYEOF
) || die "could not classify the NVS dump"
case "$NVS_STATE" in
  blank|dk01|factory) ;;
  foreign-wifi)
    [ "${FLASH_ANYWAY:-}" = "1" ] || die "board $MAC_BEFORE has a saved Wi-Fi network and no dk01 namespace — it has been set up as something else, not a fresh kit board. Unplug it, or if truly intended re-run with FLASH_ANYWAY=1" ;;
  foreign)
    [ "${FLASH_ANYWAY:-}" = "1" ] || die "board $MAC_BEFORE has NVS data with no dk01 namespace — this is a DIFFERENT product's provisioned device, not a kit board. Unplug it, or if truly intended re-run with FLASH_ANYWAY=1" ;;
  *) die "unexpected NVS classification: $NVS_STATE" ;;
esac
echo "   NVS: $NVS_STATE${FLASH_ANYWAY:+ (override active)}"

echo "== 2/6 flashing $BUILD_VERSION =="
upload_once() {
  rm -f "$BUILD_DIR"/*_flashed.bin   # no diffing against the previous board (see header)
  arduino-cli upload --fqbn "$FQBN" -p "$1" --input-dir "$BUILD_DIR" "$SKETCH" 2>&1
}
UP=$(upload_once "$PORT"); UP_RC=$?
if [ $UP_RC -ne 0 ] || ! printf '%s\n' "$UP" | grep -q "Hard resetting"; then
  echo "   (upload: first attempt failed — retrying once)" >&2
  sleep 3
  PORT=$(stable_port) || die "port lost after a failed upload"
  UP=$(upload_once "$PORT"); UP_RC=$?
  [ $UP_RC -eq 0 ] || die "upload failed twice (exit $UP_RC): $(printf '%s\n' "$UP" | tail -3 | tr '\n' ' ')"
fi
printf '%s\n' "$UP" > "$BUILD_DIR/last-upload.log"   # raw transcript, for the bench record
# Every expected region must have been written at its expected address
# and hash-verified by esptool; "Hard resetting" alone proves nothing.
VERIFIED=$(UPLOAD_OUT="$UP" EXPECTED_ADDRS="$EXPECTED_ADDRS" python3 - <<'PYEOF'
import os, re, sys
out = os.environ['UPLOAD_OUT'].replace('\r', '\n')
want = sorted(int(a, 16) for a in os.environ['EXPECTED_ADDRS'].split())
wrote = sorted(int(a, 16) for a in re.findall(r'^\s*Wrote \d+ bytes.*? at (0x[0-9a-fA-F]+) in ', out, re.M))
hashes = len(re.findall(r'^\s*Hash of data verified\.', out, re.M))
problems = []
if wrote != want:
    problems.append('regions written %s, expected %s' % ([hex(a) for a in wrote], [hex(a) for a in want]))
if hashes != len(want):
    problems.append('%d hash-verified regions, expected %d' % (hashes, len(want)))
if 'Hard resetting' not in out:
    problems.append('no hard reset after the write')
if problems:
    print('; '.join(problems)); sys.exit(1)
print(hashes)
PYEOF
) || die "upload not fully verified: $VERIFIED"
echo "   $VERIFIED regions hash-verified at $EXPECTED_ADDRS, board reset"

echo "== 3/6 identity + partition-table read-back =="
sleep 2
same_board "after the flash"
SERIAL=$(echo "$MAC_BEFORE" | awk -F: '{printf "DMX-%s%s-%s%s", toupper($3), toupper($4), toupper($5), toupper($6)}')
HOTSPOT=$(echo "$MAC_BEFORE" | awk -F: '{printf "DEVMATRIX-%s%s", toupper($5), toupper($6)}')
echo "   MAC $MAC_BEFORE → serial $SERIAL, hotspot $HOTSPOT"
# The MAC is eFuse-burned, so the serial catches re-runs the eye can't:
# an already-processed board plugged back in (proven necessary on the
# first ship night — a done board came back on a different USB port).
if ls hardware/evidence/*.md >/dev/null 2>&1 && grep -rq "$SERIAL" hardware/evidence/; then
  echo
  echo "   *** ALREADY PROCESSED: $SERIAL appears in hardware/evidence/ ***"
  echo "   *** Re-running is harmless, but check the to-box pile.       ***"
  echo
fi
PTDUMP=$(mktemp "${TMPDIR:-/tmp}/pt-readback.XXXXXX") || die "mktemp failed"
sleep 2
run_esptool read-flash "$PT_OFFSET" "$PT_SIZE" "$PTDUMP" >/dev/null || die "could not read the partition table back from the board"
[ "$(wc -c < "$PTDUMP" | tr -d ' ')" -eq $(( PT_SIZE )) ] || die "partition-table read-back is short — not erasing on a partial read"
cmp -s "$PTDUMP" "$PT_BIN" || die "the partition table on the board differs from the build's — not erasing $NVS_OFFSET on an unknown layout"
echo "   partition table on the board == build; nvs at $NVS_OFFSET+$NVS_SIZE confirmed"

echo "== 4/6 factory wipe (NVS $NVS_OFFSET+$NVS_SIZE — the no-traces rule) =="
sleep 2
WIPE=$(run_esptool erase-region "$NVS_OFFSET" "$NVS_SIZE") || die "NVS wipe failed"
printf '%s\n' "$WIPE" | grep -q "erased successfully" || die "NVS wipe did not report success: $(printf '%s\n' "$WIPE" | tail -2 | tr '\n' ' ')"
echo "   wiped; board resetting factory-fresh"

echo "== 5/6 verifying setup mode ($STAT_WINDOW_S s of stat lines) =="
DMX_PORT="$FIXED_PORT" DMX_PORT_GLOB="$PORT_GLOB" DMX_STAT_WINDOW_S="$STAT_WINDOW_S" \
DMX_EXPECT_VERSION="$BUILD_VERSION" DMX_EXPECT_HOTSPOT="$HOTSPOT" python3 - <<'PYEOF'
import glob, os, re, sys, time
import serial
fixed = os.environ.get('DMX_PORT') or None
window = float(os.environ['DMX_STAT_WINDOW_S'])
want_ver, want_ap = os.environ['DMX_EXPECT_VERSION'], os.environ['DMX_EXPECT_HOTSPOT']
deadline = time.time() + window + 15
ok = False
def fail(msg):
    print('FAIL: ' + msg, file=sys.stderr); sys.exit(1)
while time.time() < deadline:
    if fixed:
        # Honor the explicit port: globbing here would read a NEIGHBOURING
        # board's serial and pass a board that was never observed.
        if not os.path.exists(fixed):
            fail('the selected port %s disappeared' % fixed)
        ports = [fixed]
    else:
        ports = glob.glob(os.environ['DMX_PORT_GLOB'])
        if len(ports) > 1:
            fail('%d usbmodem ports — one board at a time, or pass the port explicitly' % len(ports))
    if not ports:
        time.sleep(1); continue
    try:
        s = serial.Serial(ports[0], 115200, timeout=1, dsrdtr=False)
    except Exception:
        time.sleep(1); continue
    try:
        s.dtr = True
        end = time.time() + window
        while time.time() < end:
            line = s.readline().decode('utf-8', 'replace').strip()
            if not line:
                continue
            m = re.search(r'Devmatrix DK-01 fw ([0-9.]+)', line)
            if m and m.group(1) != want_ver:
                fail('board reports fw %s, this build is %s' % (m.group(1), want_ver))
            m = re.search(r'setup: join "([^"]+)"', line)
            if m and m.group(1) != want_ap:
                fail('board announces hotspot %s, expected %s — not the board that was flashed' % (m.group(1), want_ap))
            if 'refresh_hz' in line:
                print('   ' + line)
                if 'rssi=0' in line and 'ip=0.0.0.0' in line and 'refresh_hz=200' in line:
                    ok = True
                    end = min(end, time.time() + 11)  # one settled line after
    finally:
        s.close()
    break
if not ok:
    fail('never saw a settled setup-mode stat line (want refresh_hz=200 rssi=0 ip=0.0.0.0)')
PYEOF
[ $? -eq 0 ] || die "setup-mode verification failed — do NOT box this board"

echo "== 6/6 final identity check =="
sleep 2
same_board "after the setup-mode check"
echo "   still $MAC_BEFORE on the port that produced the stat lines"

echo
echo "BOARD READY — $SERIAL carries $BUILD_VERSION (sha256 ${BUILD_SHA:0:12}…), NVS wiped,"
echo "  setup mode observed. The final identity check reset the board once more, so"
echo "  within a few seconds the panel shows the ALL-CAPS  SETUP: JOIN $HOTSPOT  card."
echo "  If readable, box it and write the serial on the card line. Ledger row for the"
echo "  evidence file:"
echo
echo "| $SERIAL | ✅ $BUILD_VERSION | ✅ ($VERIFIED regions) | ✅ | pending | — |"
