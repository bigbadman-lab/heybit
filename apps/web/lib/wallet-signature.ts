import { decodeBase58, encodeBase58 } from "@heybit/shared/factory";

export const SIWS_STATEMENT = "Sign in to HEYBIT. This proves you own this wallet and does not send a transaction.";
export const SIWS_VERSION = "1";
export const SIWS_CHAIN_ID = "mainnet";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface SiwsInput {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

export interface ParsedSiws {
  domain: string;
  address: string;
  nonce: string;
  chainId: string;
  issuedAt: string;
  expirationTime: string;
}

export function siwsMessage(input: SiwsInput): string {
  let message = `${input.domain} wants you to sign in with your Solana account:\n`;
  message += input.address;
  if (input.statement) {
    message += `\n\n${input.statement}`;
  }
  const fields = [
    `URI: ${input.uri}`,
    `Version: ${input.version}`,
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
  ];
  message += `\n${fields.join("\n")}`;
  return message;
}

export function parseSiwsMessage(message: string): ParsedSiws | null {
  const lines = message.split("\n");
  const heading = lines[0] ?? "";
  const marker = " wants you to sign in with your Solana account:";
  if (!heading.endsWith(marker)) {
    return null;
  }
  const domain = heading.slice(0, -marker.length);
  const address = lines[1] ?? "";
  if (!domain || !SOLANA_ADDRESS.test(address)) {
    return null;
  }
  const fields = new Map<string, string>();
  for (const line of lines) {
    const split = line.indexOf(": ");
    if (split > 0) {
      fields.set(line.slice(0, split), line.slice(split + 2));
    }
  }
  const nonce = fields.get("Nonce") ?? "";
  const chainId = fields.get("Chain ID") ?? "";
  const issuedAt = fields.get("Issued At") ?? "";
  const expirationTime = fields.get("Expiration Time") ?? "";
  if (!/^[a-f0-9]{32}$/.test(nonce)) {
    return null;
  }
  if (chainId !== SIWS_CHAIN_ID && chainId !== "solana:mainnet") {
    return null;
  }
  if (!Number.isFinite(Date.parse(issuedAt)) || !Number.isFinite(Date.parse(expirationTime))) {
    return null;
  }
  return { domain, address, nonce, chainId, issuedAt, expirationTime };
}

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
