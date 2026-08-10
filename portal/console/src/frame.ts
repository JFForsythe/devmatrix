// SPDX-License-Identifier: GPL-3.0-or-later

export const FRAME_WIDTH = 64;
export const FRAME_HEIGHT = 32;
export const FRAME_BYTES = FRAME_WIDTH * FRAME_HEIGHT * 2;

/** Convert 0xRRGGBB pixels into the device's two-byte RGB565 frame format. */
export function encodeRgb565Frame(pixels: ArrayLike<number>): Uint8Array {
  if (pixels.length !== FRAME_WIDTH * FRAME_HEIGHT) {
    throw new Error(`A frame must contain exactly ${FRAME_WIDTH * FRAME_HEIGHT} pixels.`);
  }

  const bytes = new Uint8Array(FRAME_BYTES);
  for (let index = 0; index < pixels.length; index += 1) {
    const color = pixels[index];
    const red = (color >>> 16) & 0xff;
    const green = (color >>> 8) & 0xff;
    const blue = color & 0xff;
    const rgb565 = ((red >>> 3) << 11) | ((green >>> 2) << 5) | (blue >>> 3);

    // Wire format is RGB565 little-endian — low byte first, exactly what
    // dk01.ino memcpys into its uint16_t framebuffer and what the proven
    // examples/flights-overhead.mjs writeUInt16LE path sends. Red = 00 f8.
    bytes[index * 2] = rgb565 & 0xff;
    bytes[index * 2 + 1] = (rgb565 >>> 8) & 0xff;
  }

  if (bytes.byteLength !== FRAME_BYTES) {
    throw new Error(`Frame encoder produced ${bytes.byteLength} bytes, expected ${FRAME_BYTES}.`);
  }
  return bytes;
}
export function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.byteLength !== FRAME_BYTES) {
    throw new Error(`Frame payload must be exactly ${FRAME_BYTES} bytes.`);
  }

  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 1024));
  }
  return btoa(binary);
}
