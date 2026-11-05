import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrape } from "./scrape-etf.mjs";
import { seal } from "./seal.mjs";
import { sealedName } from "./sealed-name.mjs";

const months = [
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
];

const input = argument("--in") || "drafts/portfolio.json";
const secret = argument("--secret");
const outputDir = argument("--out") || "data";

if (!secret) {
  console.error(
    "Usage: node scripts/seal-data.mjs --secret <passphrase> [--in drafts/portfolio.json] [--out data]",
  );
  process.exit(1);
}

const config = JSON.parse(readFileSync(input, "utf8"));
const symbols = [
  ...new Set([
    ...config.indexes.map((index) => index.market.symbol),
    ...config.fx.map((rate) => rate.symbol),
  ]),
];

const scraped = new Map(
  config.indexes
    .filter((index) => index.market.provider === "justetf")
    .map((index) => [index.market.symbol, index]),
);

mkdirSync(outputDir, { recursive: true });
for (const name of readdirSync(outputDir)) {
  if (name.endsWith(".bin")) rmSync(join(outputDir, name));
}
rmSync(join(outputDir, "history"), { recursive: true, force: true });
rmSync(join(outputDir, "portfolio.bin"), { force: true });

writeSealed(join(outputDir, sealedName(secret, "portfolio")), config, secret);
for (const symbol of symbols) {
  const series = scraped.has(symbol) ? await scrapedHistory(symbol) : history(symbol);
  writeSealed(join(outputDir, sealedName(secret, symbol)), series, secret);
}
console.log(`Sealed config and ${symbols.length} histories in ${outputDir}`);

async function scrapedHistory(symbol) {
  const profile = await scrape(symbol, "EUR", { from: `${months[0]}-01`, to: `${months.at(-1)}-31` });
  const byMonth = new Map(profile.points.map((point) => [point.month, point.value]));
  const points = months.map((month) => {
    const value = byMonth.get(month);
    if (value == null) throw new Error("Scraped series does not cover every month");
    return { month, value };
  });
  return { symbol, points };
}

function history(symbol) {
  const fx = symbol.includes("=X");
  let value = startFor(symbol);
  let state = hash(symbol);
  const points = months.map((month) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const shock = ((state % 1000) / 1000 - 0.48) * (fx ? 0.012 : 0.04);
    value = Math.max(fx ? 0.2 : 1, value * (1 + shock));
    const digits = fx ? 4 : 2;
    const rounded = Number(value.toFixed(digits));
    value = rounded;
    return { month, value: rounded };
  });
  return { symbol, points };
}

function startFor(symbol) {
  const n = hash(symbol);
  if (symbol.includes("=X")) return 0.9 + (n % 30) / 100;
  return 20 + (n % 480);
}

function hash(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function writeSealed(path, value, passphrase) {
  writeFileSync(path, seal(Buffer.from(JSON.stringify(value)), passphrase));
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}
