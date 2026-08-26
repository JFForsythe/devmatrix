#!/bin/bash
# flash-station.sh — one production board, start to ship-ready:
#   flash current firmware → read MAC → derive serial → factory-wipe NVS
#   → verify setup mode → print the evidence ledger row.
#
# Usage (from the repository root, board plugged in):
#   hardware/procedures/flash-station.sh
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
#     it. Every esptool call here retries once.
#   * The port is exclusive-open on macOS: close serial monitors
#     before running this.
#   * refresh_hz reads low (~170) for the first stat line after boot,
#     then settles at 200 idle. Judge only settled lines.

set -u

FQBN="esp32:esp32:adafruit_matrixportal_esp32s3"
BUILD_DIR="firmware/dk01/out"
SKETCH="firmware/dk01"
NVS_OFFSET="0x9000"
NVS_SIZE="0x5000"

die() { echo "FAIL: $*" >&2; exit 1; }

[ -f "$BUILD_DIR/dk01.ino.bin" ] || die "no build in $BUILD_DIR — compile first (see header)"

stable_port() {
  # Echo a port node only after it reports the same name twice, 2 s apart.
  local tries=0 p p2
  while [ $tries -lt 30 ]; do
    p=$(ls /dev/cu.usbmodem* 2>/dev/null | head -1)
    if [ -n "${p:-}" ]; then
      sleep 2
      p2=$(ls /dev/cu.usbmodem* 2>/dev/null | head -1)
      if [ "$p" = "$p2" ]; then echo "$p"; return 0; fi
    fi
    sleep 1; tries=$((tries + 1))
  done
  return 1
}

esptool_retry() {
  # Run an esptool subcommand against a freshly-globbed stable port;
  # on failure, wait out a re-enumeration and retry exactly once.
  local out port
  port=$(stable_port) || die "no stable USB port (is the board plugged in?)"
  out=$(python3 -m esptool --port "$port" "$@" 2>&1)
  if echo "$out" | grep -qiE 'error|fail'; then
    sleep 3
    port=$(stable_port) || die "port never came back after esptool retry wait"
    out=$(python3 -m esptool --port "$port" "$@" 2>&1) || true
  fi
  echo "$out"
}

echo "== 1/5 waiting for a stable port =="
PORT=$(stable_port) || die "no stable USB port (is the board plugged in?)"
echo "   $PORT"

echo "== 2/5 flashing $(strings "$BUILD_DIR/dk01.ino.bin" | grep -oE '^0\.[0-9]+\.[0-9]+$' | head -1 || echo '?') =="
UP=$(arduino-cli upload --fqbn "$FQBN" -p "$PORT" --input-dir "$BUILD_DIR" "$SKETCH" 2>&1)
if ! echo "$UP" | grep -q "Hard resetting"; then
  sleep 3
  PORT=$(stable_port) || die "port lost after failed upload"
  UP=$(arduino-cli upload --fqbn "$FQBN" -p "$PORT" --input-dir "$BUILD_DIR" "$SKETCH" 2>&1)
  echo "$UP" | grep -q "Hard resetting" || die "upload failed twice: $(echo "$UP" | tail -3)"
fi
VERIFIED=$(echo "$UP" | grep -o "Hash of data verified" | wc -l | tr -d ' ')
echo "   $VERIFIED regions hash-verified, board reset"

echo "== 3/5 reading MAC / deriving serial =="
sleep 2
MACOUT=$(esptool_retry read-mac)
MAC=$(echo "$MACOUT" | grep -oE '([0-9a-f]{2}:){5}[0-9a-f]{2}' | head -1)
[ -n "$MAC" ] || die "could not read MAC: $(echo "$MACOUT" | tail -2)"
SERIAL=$(echo "$MAC" | awk -F: '{printf "DMX-%s%s-%s%s", toupper($3), toupper($4), toupper($5), toupper($6)}')
HOTSPOT=$(echo "$MAC" | awk -F: '{printf "DEVMATRIX-%s%s", toupper($5), toupper($6)}')
echo "   MAC $MAC → serial $SERIAL, hotspot $HOTSPOT"

echo "== 4/5 factory wipe (NVS $NVS_OFFSET+$NVS_SIZE — the no-traces rule) =="
sleep 2
WIPE=$(esptool_retry erase-region "$NVS_OFFSET" "$NVS_SIZE")
echo "$WIPE" | grep -q "erased successfully" || die "NVS wipe failed: $(echo "$WIPE" | tail -2)"
echo "   wiped; board resetting factory-fresh"

echo "== 5/5 verifying setup mode (30 s of stat lines) =="
python3 - <<'PYEOF'
import serial, time, glob, sys
deadline = time.time() + 45
lines, ok = [], False
while time.time() < deadline:
    ports = glob.glob('/dev/cu.usbmodem*')
    if not ports:
        time.sleep(1); continue
    try:
        s = serial.Serial(ports[0], 115200, timeout=1, dsrdtr=False)
        s.dtr = True
        end = time.time() + 30
        while time.time() < end:
            line = s.readline().decode('utf-8', 'replace').strip()
            if 'refresh_hz' in line:
                print('   ' + line)
                lines.append(line)
                if 'rssi=0' in line and 'ip=0.0.0.0' in line and 'refresh_hz=200' in line:
                    ok = True
                    end = min(end, time.time() + 11)  # one settled line after
        s.close(); break
    except Exception:
        time.sleep(1)
if not ok:
    print('FAIL: never saw a settled setup-mode stat line '
          '(want refresh_hz=200 rssi=0 ip=0.0.0.0)', file=sys.stderr)
    sys.exit(1)
PYEOF
[ $? -eq 0 ] || die "setup-mode verification failed — do NOT box this board"

echo
echo "BOARD READY — owner steps: look at the panel for the ALL-CAPS"
echo "  JOIN ME → $HOTSPOT   card; if readable, box it and write the"
echo "  serial on the card line. Ledger row for the evidence file:"
echo
echo "| $SERIAL | ✅ | ✅ ($VERIFIED regions) | ✅ | pending | — |"
