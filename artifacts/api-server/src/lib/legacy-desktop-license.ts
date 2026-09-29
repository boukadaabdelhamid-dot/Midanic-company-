import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function parsePythonBytesLiteral(literal: string): Buffer {
  const trimmed = literal.trim();
  let body = trimmed;
  const bytesPrefix = trimmed[0] === "b" || trimmed[0] === "B";
  const quote = bytesPrefix ? trimmed[1] : trimmed[0];
  if (bytesPrefix || quote === '"' || quote === "'") {
    if ((quote !== '"' && quote !== "'") || trimmed.at(-1) !== quote) {
      throw new Error("Invalid legacy license salt format");
    }
    body = trimmed.slice(bytesPrefix ? 2 : 1, -1);
  }

  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character !== "\\") {
      const code = character.charCodeAt(0);
      // Some secret-entry surfaces may preserve \xNN escapes as Latin-1
      // characters instead of leaving the source literal text unchanged.
      if (code > 0xff) throw new Error("Invalid legacy license salt format");
      bytes.push(code);
      continue;
    }

    const escape = body[index + 1];
    if (escape === "x") {
      const hex = body.slice(index + 2, index + 4);
      if (!/^[\da-f]{2}$/i.test(hex)) {
        throw new Error("Invalid legacy license salt format");
      }
      bytes.push(Number.parseInt(hex, 16));
      index += 3;
      continue;
    }
    if (escape === "\\" || escape === quote) {
      bytes.push(escape.charCodeAt(0));
      index += 1;
      continue;
    }
    throw new Error("Unsupported legacy license salt escape");
  }

  if (bytes.length === 0) throw new Error("Legacy license salt is empty");
  return Buffer.from(bytes);
}

function encodeBase32(data: Buffer): string {
  let buffer = 0;
  let bits = 0;
  let output = "";

  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
      buffer &= (1 << bits) - 1;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return output;
}

export function generateLegacyDesktopLicenseKey(hwid: string): string {
  const saltLiteral = process.env.DESKTOP_LEGACY_LICENSE_SALT;
  if (!saltLiteral) throw new Error("Legacy desktop license generation is not configured");

  const digest = createHmac("sha256", parsePythonBytesLiteral(saltLiteral))
    .update(hwid.toUpperCase(), "utf8")
    .digest();
  const key = encodeBase32(digest).slice(0, 20);
  return `${key.slice(0, 5)}-${key.slice(5, 10)}-${key.slice(10, 15)}-${key.slice(15, 20)}`;
}