import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { seal } from "./seal.mjs";

const input = argument("--in") || "drafts/portfolio.json";
const output = argument("--out") || "misc/portfolio.bin";
const secret = argument("--secret");

if (!secret) {
  console.error(
    "Usage: node scripts/encrypt-config.mjs --secret <passphrase> [--in drafts/portfolio.json] [--out misc/portfolio.bin]",
  );
  process.exit(1);
}

try {
  const config = JSON.parse(readFileSync(input, "utf8"));
  validatePortfolio(config);
  const sealed = seal(Buffer.from(JSON.stringify(config)), secret);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, sealed);
  console.log(`Sealed ${input} to ${output}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not seal the config");
  process.exit(1);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

function validatePortfolio(config) {
  const banks = uniqueIds(config.banks, "banks");
  if (!Array.isArray(config.colors) || config.colors.length < config.banks.length) {
    throw new Error("colors must list one entry for each bank, in the same order");
  }
  const indexes = uniqueIds(config.indexes, "indexes");
  for (const index of config.indexes) {
    if (!index.quoteCurrency || !index.market?.symbol) {
      throw new Error(`index ${index.id} needs quoteCurrency and market.symbol`);
    }
  }
  if (config.baseCurrency !== "EUR") {
    throw new Error("baseCurrency must be EUR");
  }
  if (!Array.isArray(config.fx)) throw new Error("fx must be a list");
  for (const rate of config.fx) {
    if (!rate.from || !rate.to || !rate.symbol) {
      throw new Error("each fx entry needs from, to, and symbol");
    }
  }
  if (!Array.isArray(config.positions) || config.positions.length === 0) {
    throw new Error("positions must list at least one holding");
  }
  for (const position of config.positions) {
    if (!banks.has(position.bankId)) {
      throw new Error(`unknown bank ${position.bankId}`);
    }
    if (!indexes.has(position.indexId)) {
      throw new Error(`unknown index ${position.indexId}`);
    }
    if (typeof position.notional !== "number" || position.notional <= 0) {
      throw new Error(`notional for ${position.bankId} ${position.indexId} must be a positive number`);
    }
  }
}

function uniqueIds(items, label) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`${label} must be a non-empty list`);
  }
  const ids = new Set();
  for (const item of items) {
    if (!item.id || !item.name) throw new Error(`each ${label} entry needs id and name`);
    if (ids.has(item.id)) throw new Error(`duplicate ${label} id ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}
