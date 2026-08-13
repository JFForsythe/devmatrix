// SPDX-License-Identifier: GPL-3.0-or-later
// Device identity verification (ADR-0031). mDNS is unauthenticated and the
// LAN transport is plain HTTP, so the box proves itself cryptographically:
// it signs a Console-supplied nonce with an Ed25519 key minted on its first
// boot, and this browser pins the public key the first time it pairs.
//
// WebCrypto handles the verify on secure origins that support Ed25519; the
// bundled pure-JS verifier (@noble/ed25519, MIT) covers the device's own
// non-secure origin, where crypto.subtle does not exist.
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

ed.etc.sha512Sync = (...messages: Uint8Array[]) => sha512(ed.etc.concatBytes(...messages));

export interface DeviceIdentity {
  device: string;
  alg: string;
  pubkey: string;
  fingerprint: string;
  sig?: string;
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 32 random bytes, base64. getRandomValues exists on every origin. */
export function makeNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToB64(bytes);
}

/** The signed message: "dmx-id-v1:<serial>:" + raw nonce bytes. */
function buildMessage(device: string, nonceB64: string): Uint8Array {
  const prefix = new TextEncoder().encode(`dmx-id-v1:${device}:`);
  const nonce = b64ToBytes(nonceB64);
  const message = new Uint8Array(prefix.length + nonce.length);
  message.set(prefix, 0);
  message.set(nonce, prefix.length);
  return message;
}

async function webCryptoVerify(sig: Uint8Array, message: Uint8Array, pubkey: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", pubkey as BufferSource, "Ed25519", false, ["verify"]);
  return crypto.subtle.verify("Ed25519", key, sig as BufferSource, message as BufferSource);
}

/**
 * True only if `identity.sig` is a valid signature over the nonce by
 * `identity.pubkey`. Never throws; a malformed response is just "false".
 */
export async function verifyIdentity(identity: DeviceIdentity, nonceB64: string): Promise<boolean> {
  try {
    if (identity.alg !== "ed25519" || !identity.sig) return false;
    const message = buildMessage(identity.device, nonceB64);
    const sig = b64ToBytes(identity.sig);
    const pubkey = b64ToBytes(identity.pubkey);
    if (sig.length !== 64 || pubkey.length !== 32) return false;
    if (typeof crypto.subtle?.importKey === "function") {
      try {
        return await webCryptoVerify(sig, message, pubkey);
      } catch {
        // This browser's WebCrypto lacks Ed25519 — fall through to pure JS.
      }
    }
    return ed.verify(sig, message, pubkey);
  } catch {
    return false;
  }
}
