import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts Spotify refresh tokens before they are stored. TOKEN_KEY is 32
// bytes as hex (openssl rand -hex 32). Losing it makes stored tokens unreadable.
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function key() {
  const key = Buffer.from(process.env.TOKEN_KEY ?? "", "hex");
  if (key.length !== 32) {
    throw new Error("TOKEN_KEY must be 64 hex characters");
  }
  return key;
}

// Returns "v1:iv:tag:ciphertext", each part base64.
export function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv, tag, ciphertext].map((part) => part.toString("base64")).join(":");
}

// Throws if the value was changed or encrypted with a different key.
export function decrypt(blob) {
  const [version, iv, tag, ciphertext] = blob.split(":");
  if (version !== VERSION || !ciphertext) {
    throw new Error("Unrecognised encrypted value");
  }

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}