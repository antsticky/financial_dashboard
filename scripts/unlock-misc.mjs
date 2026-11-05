import { readFileSync } from "node:fs";
import { openSealed } from "./seal.mjs";

const passphrase = process.env.MISC_PASSPHRASE ?? "";
if (!passphrase) {
  console.error("MISC_PASSPHRASE is missing");
  process.exit(1);
}

const blob = readFileSync(new URL("../misc/sealed.bin", import.meta.url));

try {
  openSealed(blob, passphrase);
} catch {
  console.error("misc/sealed.bin could not be opened");
  process.exit(1);
}
