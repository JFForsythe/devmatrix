// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const MAX_GZIP_BYTES = 262_144;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const consoleDirectory = resolve(scriptDirectory, "..");
const inputPath = resolve(consoleDirectory, "dist-device", "index.html");
const outputPath = resolve(
  consoleDirectory,
  "..",
  "..",
  "firmware",
  "dk01",
  "web_console_next.h",
);

const html = await readFile(inputPath);
const gzipped = gzipSync(html, { level: 9, mtime: 0 });

if (gzipped.length > MAX_GZIP_BYTES) {
  throw new Error(
    `Device Console is ${gzipped.length} bytes gzipped; limit is ${MAX_GZIP_BYTES} bytes.`,
  );
}

if (!gzipped.subarray(4, 8).every((byte) => byte === 0)) {
  throw new Error("Generated gzip unexpectedly contains a non-zero mtime.");
}

const byteRows = [];
for (let offset = 0; offset < gzipped.length; offset += 12) {
  const row = Array.from(gzipped.subarray(offset, offset + 12), (byte) =>
    `0x${byte.toString(16).padStart(2, "0")}`,
  );
  byteRows.push(`  ${row.join(", ")},`);
}

const header = [
  "// GENERATED from portal/console — do not hand-edit (ADR-0027)",
  "static const uint8_t CONSOLE_NEXT_HTML_GZ[] PROGMEM = {",
  ...byteRows,
  "};",
  `static const unsigned int CONSOLE_NEXT_HTML_GZ_LEN = ${gzipped.length};`,
  "",
].join("\n");

await writeFile(outputPath, header, "utf8");
console.log(`Device Console gzip: ${gzipped.length} bytes`);
