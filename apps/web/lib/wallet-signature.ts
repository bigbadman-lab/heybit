import { decodeBase58, encodeBase58 } from "@heybit/shared/factory";

export function normalizeWalletSignature(value: unknown): string | null {
  if (typeof value === "string") {
    const base58 = decodeBase58(value);
    if (base58 && base58.length === 64) {
      return value;
    }
    const base64 = bytesFromBase64(value);
    return base64 ? encodeBase58(base64) : null;
  }
  const bytes = asSignatureBytes(value);
  if (bytes) {
    return encodeBase58(bytes);
  }
  if (value && typeof value === "object" && "signature" in value) {
    return normalizeWalletSignature((value as { signature: unknown }).signature);
  }
  return null;
}

function asSignatureBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array && value.length === 64) {
    return value;
  }
  if (value instanceof ArrayBuffer && value.byteLength === 64) {
    return new Uint8Array(value);
  }
  if (!Array.isArray(value) || value.length !== 64) {
    return null;
  }
  if (!value.every((item) => typeof item === "number" && item >= 0 && item <= 255)) {
    return null;
  }
  return Uint8Array.from(value);
}

function bytesFromBase64(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null;
  }
  try {
    const binary = atob(value);
    if (binary.length !== 64) {
      return null;
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}
