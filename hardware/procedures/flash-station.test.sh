#!/bin/bash
# flash-station.test.sh — fault-injection harness for flash-station.sh.
#
# No hardware is touched. PATH shims stand in for esptool (python3 -m
# esptool), arduino-cli, sleep and pyserial; a temporary "repository root"
# carries a fake build with a real ESP-IDF partition table. Every scenario
# runs the real script and asserts its exit status, its message, and how
# many times erase-region was invoked — zero for every failure that must
# leave the board untouched (EH-01, docs/reviews/2026-09-08-full-review/
# examples-hardware-operations.md). `make check` runs this.
#
#   bash hardware/procedures/flash-station.test.sh
#
# Board identities are the demo fleet's canonical ones (docs/USER-STORY.md,
# portal/console/src/mock.ts): DMX-4E71-0952 and DMX-4E71-1108. No real
# unit's MAC appears here.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/flash-station.sh"
REAL_PYTHON3="$(command -v python3)" || { echo "python3 is required" >&2; exit 1; }
T="$(mktemp -d "${TMPDIR:-/tmp}/flash-station-test.XXXXXX")" || exit 1
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/pylib/serial" "$T/root/firmware/dk01/out" "$T/root/hardware/evidence" \
         "$T/root-badpt/firmware/dk01/out" "$T/root-nobuild/firmware/dk01/out" "$T/ports"

# --- fake build: a binary carrying the banner, and real partition tables ---
printf 'x\0=== Devmatrix DK-01 fw 0.12.7 ===\0y\0' > "$T/root/firmware/dk01/out/dk01.ino.bin"
cp "$T/root/firmware/dk01/out/dk01.ino.bin" "$T/root-badpt/firmware/dk01/out/dk01.ino.bin"
make_table() {  # make_table <out> <nvs offset>
  "$REAL_PYTHON3" - "$1" "$2" <<'PYEOF'
import hashlib, struct, sys
out, nvs_off = sys.argv[1], int(sys.argv[2], 16)
rows = [("nvs", 1, 2, nvs_off, 0x5000), ("otadata", 1, 0, 0xe000, 0x2000),
        ("ota_0", 0, 0x10, 0x10000, 0x200000), ("ota_1", 0, 0x11, 0x210000, 0x200000),
        ("uf2", 0, 0, 0x410000, 0x40000), ("ffat", 1, 0x81, 0x450000, 0x3b0000)]
t = b''.join(b'\xaa\x50' + bytes([ty, st]) + struct.pack('<II', off, sz)
             + lbl.encode().ljust(16, b'\0') + b'\0' * 4 for lbl, ty, st, off, sz in rows)
t += b'\xeb\xeb' + b'\xff' * 14 + hashlib.md5(t).digest()
open(out, 'wb').write(t.ljust(0xC00, b'\xff'))
PYEOF
}
make_table "$T/root/firmware/dk01/out/dk01.ino.partitions.bin" 0x9000
make_table "$T/root-badpt/firmware/dk01/out/dk01.ino.partitions.bin" 0xa000
echo "| DMX-4E71-1108 | done |" > "$T/root/hardware/evidence/ledger.md"

# --- shims ------------------------------------------------------------------
printf '#!/bin/bash\nexit 0\n' > "$T/bin/sleep"
cat > "$T/bin/python3" <<EOF
#!/bin/bash
# esptool is simulated; anything else runs the real interpreter with the
# fake pyserial on its path.
if [ "\${1:-}" = "-m" ] && [ "\${2:-}" = "esptool" ]; then
  shift 2
  exec "$REAL_PYTHON3" "$T/fake-esptool.py" "\$@"
fi
PYTHONPATH="$T/pylib\${PYTHONPATH:+:\$PYTHONPATH}" exec "$REAL_PYTHON3" "\$@"
EOF
cat > "$T/bin/arduino-cli" <<EOF
#!/bin/bash
exec "$REAL_PYTHON3" "$T/fake-arduino-cli.py" "\$@"
EOF
chmod +x "$T/bin/"*

cat > "$T/fake-esptool.py" <<'PYEOF'
import os, sys
S = os.environ['FAKE']
def log(line):
    with open(os.path.join(S, 'calls.log'), 'a') as f:
        f.write(line + '\n')
def count(name):
    p = os.path.join(S, name)
    n = (int(open(p).read()) if os.path.exists(p) else 0) + 1
    open(p, 'w').write(str(n))
    return n
args = sys.argv[1:]
i = args.index('--port')
port, cmd, rest = args[i + 1], args[i + 2], args[i + 3:]
n = count('esptool.calls')
log('esptool ' + cmd + ' ' + ' '.join(rest))
if str(n) in os.environ.get('FAKE_FAIL_CALLS', '').split():
    print("A fatal error occurred: Could not open %s, the port is busy or doesn't exist." % port)
    sys.exit(2)
if cmd == 'read-mac':
    macs = os.environ.get('FAKE_MACS', '48:27:4e:71:09:52').split()
    print('MAC: ' + macs[min(count('readmac.calls'), len(macs)) - 1])
    sys.exit(0)
if cmd == 'read-flash':
    off, size, out = int(rest[0], 16), int(rest[1], 16), rest[2]
    if off == 0x9000:
        kind = os.environ.get('FAKE_NVS', 'blank')
        if kind == 'blank':
            data = b'\xff' * size
        elif kind == 'dk01':
            data = b'\xff' * 64 + b'dk01' + b'\x00' * (size - 68)
        else:
            data = bytes(range(256)) * (size // 256)
        if os.environ.get('FAKE_SHORT_READ') == '1':
            data = data[:100]
    elif off == 0x8000:
        data = open(os.environ['FAKE_PT_FILE'], 'rb').read()
        if os.environ.get('FAKE_PT_MISMATCH') == '1':
            data = data[:4] + b'\x00\xa0\x00\x00' + data[8:]   # nvs moved: no longer the build's table
    else:
        print('A fatal error occurred: unexpected region'); sys.exit(2)
    open(out, 'wb').write(data)
    print('Read %d bytes at %#010x in 0.4 seconds (369.8 kbit/s)...' % (len(data), off))
    sys.exit(0)
if cmd == 'erase-region':
    if os.environ.get('FAKE_ERASE_FAIL') == '1':
        print('A fatal error occurred: Timed out waiting for packet header'); sys.exit(2)
    print('Flash memory region erased successfully in 0.3 seconds.')
    sys.exit(0)
print('A fatal error occurred: unknown command ' + cmd)
sys.exit(2)
PYEOF

cat > "$T/fake-arduino-cli.py" <<'PYEOF'
import os, sys
S = os.environ['FAKE']
args = sys.argv[1:]
with open(os.path.join(S, 'calls.log'), 'a') as f:
    f.write('arduino-cli ' + ' '.join(args) + '\n')
if args[:1] != ['upload']:
    sys.exit(0)
mode = os.environ.get('FAKE_UPLOAD', 'ok')
port = args[args.index('-p') + 1]
if mode == 'fail':
    print('A fatal error occurred: Failed to connect to ESP32-S3: No serial data received.')
    print('Failed uploading: uploading error: exit status 2')
    sys.exit(1)
addrs = [int(a, 16) for a in os.environ['FAKE_ADDRS'].split()]
if mode == 'missingregion':
    addrs = addrs[:-1]
for k, a in enumerate(addrs):
    print('Wrote %d bytes (%d compressed) at %#010x in 1.2 seconds (400.0 kbit/s).' % (1000 * (k + 1), 500 * (k + 1), a))
    if not (mode == 'nohash' and k == len(addrs) - 1):
        print('Hash of data verified.')
print('Hard resetting via RTS pin...')
if os.environ.get('FAKE_DROP_PORT') == '1':
    os.remove(port)
sys.exit(0)
PYEOF

cat > "$T/pylib/serial/__init__.py" <<'PYEOF'
import os, time
class Serial:
    def __init__(self, port, baudrate, timeout=1, dsrdtr=False):
        self.port = port
        self.lines = open(os.environ['FAKE_STAT_FILE']).read().splitlines()
        self.dtr = False
    def readline(self):
        if self.lines:
            return (self.lines.pop(0) + '\n').encode()
        time.sleep(0.02)
        return b''
    def close(self):
        pass
PYEOF

# --- scenario runner --------------------------------------------------------
STAT_OK=$'=== Devmatrix DK-01 fw 0.12.7 ===\nsetup: join "DEVMATRIX-0952" then any page opens http://192.168.4.1\nrefresh_hz=171 heap_free=160872 rssi=0 ip=0.0.0.0\nrefresh_hz=200 heap_free=160872 rssi=0 ip=0.0.0.0\nrefresh_hz=200 heap_free=160872 rssi=0 ip=0.0.0.0'
PASSED=0; FAILED=0
run_case() {  # run_case <name> <want exit> <want message> <want erase calls> [VAR=value ...]
  local name="$1" want_rc="$2" want_msg="$3" want_erase="$4"; shift 4
  local S="$T/case-$name" root="${ROOT:-$T/root}" out rc erased n=0
  mkdir -p "$S"
  printf '%s\n' "${STAT_LINES:-$STAT_OK}" > "$S/stat.txt"
  rm -f "$T/ports"/*
  while [ "$n" -lt "${PORTS:-1}" ]; do n=$((n + 1)); : > "$T/ports/cu.usbmodem$n"; done
  local args=(); [ "${FIXED:-1}" = "1" ] && args=("$T/ports/cu.usbmodem1")
  out=$(cd "$root" && env -i PATH="$T/bin:$PATH" HOME="$T" TMPDIR="$T" FAKE="$S" \
        FAKE_STAT_FILE="$S/stat.txt" FAKE_PT_FILE="$T/root/firmware/dk01/out/dk01.ino.partitions.bin" \
        FAKE_ADDRS="0x0 0x8000 0xe000 0x10000 0x410000" DMX_STAT_WINDOW_S=1 DMX_PORT_GLOB="$T/ports/*" \
        "$@" bash "$SCRIPT" ${args[@]+"${args[@]}"} 2>&1); rc=$?
  erased=$(grep -c '^esptool erase-region' "$S/calls.log" 2>/dev/null || true); erased="${erased:-0}"
  if [ "$rc" -eq "$want_rc" ] && printf '%s' "$out" | grep -q -- "$want_msg" && [ "$erased" -eq "$want_erase" ]; then
    echo "ok   $name"; PASSED=$((PASSED + 1))
  else
    echo "FAIL $name: exit $rc (want $want_rc), erase calls $erased (want $want_erase), wanted message '$want_msg'"
    printf '%s\n' "$out" | sed 's/^/     | /'; FAILED=$((FAILED + 1))
  fi
}

# Happy paths: the board is processed end to end and the ledger row appears.
run_case happy-fixed-port           0 'BOARD READY'                        1
FIXED=0 run_case happy-glob-one-port 0 'BOARD READY'                       1
run_case first-touch-retry          0 'BOARD READY'                        1 FAKE_FAIL_CALLS=1
STAT_LINES="${STAT_OK/DEVMATRIX-0952/DEVMATRIX-1108}" \
  run_case rerun-kit-board          0 'ALREADY PROCESSED'                  1 FAKE_NVS=dk01 FAKE_MACS=48:27:4e:71:11:08
run_case foreign-with-override      0 'override active'                    1 FAKE_NVS=foreign FLASH_ANYWAY=1
# Before the flash: nothing is written or erased.
run_case esptool-fails-twice        1 'failed twice'                       0 FAKE_FAIL_CALLS='1 2'
run_case short-nvs-read             1 'expected 20480'                     0 FAKE_SHORT_READ=1
run_case foreign-device             1 'DIFFERENT product'                  0 FAKE_NVS=foreign
FIXED=0 PORTS=2 run_case two-ports-glob 1 'multiple usbmodem ports'        0
ROOT="$T/root-badpt" run_case build-nvs-elsewhere 1 'refusing to erase blind' 0
ROOT="$T/root-nobuild" run_case no-build 1 'no build in'                   0
# After the flash, before the erase: the wipe must not happen.
run_case upload-fails-twice         1 'upload failed twice'                0 FAKE_UPLOAD=fail
run_case upload-missing-hash        1 'hash-verified regions, expected 5'  0 FAKE_UPLOAD=nohash
run_case upload-missing-region      1 'regions written'                    0 FAKE_UPLOAD=missingregion
run_case board-swapped-after-flash  1 'board changed after the flash'      0 FAKE_MACS='48:27:4e:71:09:52 48:27:4e:71:11:08'
run_case port-lost-after-flash      1 'port lost'                          0 FAKE_DROP_PORT=1
run_case partition-table-differs    1 'partition table on the board differs' 0 FAKE_PT_MISMATCH=1
# The erase itself.
run_case erase-fails-twice          1 'erase-region failed twice'          2 FAKE_ERASE_FAIL=1
# After the erase: the board is wiped but must not be boxed.
STAT_LINES=$'refresh_hz=199 heap_free=158328 rssi=-43 ip=10.0.0.166' \
  run_case setup-mode-never-settles 1 'do NOT box'                         1
STAT_LINES=$'=== Devmatrix DK-01 fw 0.12.6 ===\n'"$STAT_OK" \
  run_case wrong-firmware-on-serial 1 'reports fw 0.12.6'                  1
STAT_LINES=$'setup: join "DEVMATRIX-1108" then any page opens http://192.168.4.1\n'"$STAT_OK" \
  run_case other-board-on-serial    1 'announces hotspot DEVMATRIX-1108'   1
run_case board-swapped-after-wipe   1 'board changed after the setup-mode check' 1 \
  FAKE_MACS='48:27:4e:71:09:52 48:27:4e:71:09:52 48:27:4e:71:11:08'

echo "flash-station fault injection: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
