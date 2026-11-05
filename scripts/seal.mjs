import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export function seal(plain, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), data]);
}

export function openSealed(blob, passphrase) {
  if (blob.length < 45) {
    throw new Error("sealed blob is incomplete");
  }
  const salt = blob.subarray(0, 16);
  const iv = blob.subarray(16, 28);
  const tag = blob.subarray(28, 44);
  const data = blob.subarray(44);
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
