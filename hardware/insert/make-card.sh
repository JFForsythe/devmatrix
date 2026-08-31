#!/bin/bash
# make-card.sh — render (and optionally print) a per-unit 4×6 welcome card.
#
#   hardware/insert/make-card.sh DMX-E28E-A334 [--print]
#
# Fills card-template.html with the unit's serial, hotspot, and .local
# Console address, embeds a QR that opens http://dmx-xxxx.local (served
# by the panel itself — no cloud, no DNS), renders a 4×6 PDF via
# headless Chrome into hardware/insert/cards/, and with --print sends
# one copy to the PL70e thermal printer at exact size.
#
# Needs: python3 + `qrcode` package, Google Chrome.

set -eu

SERIAL="${1:?usage: make-card.sh DMX-XXXX-XXXX [--print]}"
DIR="$(cd "$(dirname "$0")" && pwd)"
case "$SERIAL" in DMX-????-????) ;; *) echo "bad serial: $SERIAL" >&2; exit 1;; esac

OUT_HTML=$(mktemp -t card).html
OUT_PDF="$DIR/cards/${SERIAL}.pdf"
mkdir -p "$DIR/cards"

SERIAL="$SERIAL" TPL="$DIR/card-template.html" OUT="$OUT_HTML" python3 - <<'PYEOF'
import io, os, re
serial = os.environ['SERIAL']
last = serial.split('-')[-1].lower()
hostname = f"dmx-{last}.local"
hotspot = f"DEVMATRIX-{last.upper()}"

import qrcode, qrcode.image.svg
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
qr.add_data(f"http://{hostname}")
qr.make(fit=True)
img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
buf = io.BytesIO(); img.save(buf)
svg = buf.getvalue().decode()
svg = re.sub(r'(<svg[^>]*)>', r'\1 preserveAspectRatio="xMidYMid meet">', svg, count=1)

tpl = open(os.environ['TPL']).read()
html = (tpl.replace('{{SERIAL}}', serial)
           .replace('{{HOSTNAME}}', hostname)
           .replace('{{HOTSPOT}}', hotspot)
           .replace('{{QR_SVG}}', svg))
open(os.environ['OUT'], 'w').write(html)
print(f"   {serial}: QR → http://{hostname}")
PYEOF

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT_PDF" "file://$OUT_HTML" 2>/dev/null
rm -f "$OUT_HTML"
echo "   card: $OUT_PDF"

if [ "${2:-}" = "--print" ]; then
  lp -d _PL70e_BT -o media=Custom.4x6in -o print-scaling=none "$OUT_PDF"
fi
