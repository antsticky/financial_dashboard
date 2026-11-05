import { createHmac } from "node:crypto";

export function sealedName(passphrase, label) {
  return `${createHmac("sha256", passphrase).update(label).digest("hex")}.bin`;
}
