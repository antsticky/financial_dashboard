import { createDecipheriv, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const passphrase = process.env.MISC_PASSPHRASE ?? "";
if (!passphrase) {
  console.error("MISC_PASSPHRASE is missing");
  process.exit(1);
}

const blob = readFileSync(new URL("../misc/sealed.bin", import.meta.url));
if (blob.length < 45) {
  console.error("misc/sealed.bin is incomplete");
  process.exit(1);
}

const salt = blob.subarray(0, 16);
const iv = blob.subarray(16, 28);
const tag = blob.subarray(28, 44);
const data = blob.subarray(44);

try {
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  decipher.update(data);
  decipher.final();
} catch {
  console.error("misc/sealed.bin could not be opened");
  process.exit(1);
}
