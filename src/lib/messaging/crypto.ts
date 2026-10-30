import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

let cachedKey: Buffer | null = null;

/**
 * 32-byte key for encrypting invite tokens at rest. Production sets
 * INVITE_TOKEN_KEY (64 hex chars). Local development generates one next to
 * the database directory so it survives restarts and never enters git.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const env = process.env.INVITE_TOKEN_KEY;
  if (env) {
    if (!/^[0-9a-f]{64}$/i.test(env)) throw new Error("INVITE_TOKEN_KEY must be 64 hex characters");
    cachedKey = Buffer.from(env, "hex");
    return cachedKey;
  }
  const dataDir = path.resolve(process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), "data", "pgdata"));
  const keyPath = path.join(path.dirname(dataDir), "invite-token.key");
  if (!existsSync(keyPath)) {
    mkdirSync(path.dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  cachedKey = Buffer.from(readFileSync(keyPath, "utf8").trim(), "hex");
  return cachedKey;
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptToken(blob: string): string | null {
  try {
    const [v, iv, tag, enc] = blob.split(".");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
