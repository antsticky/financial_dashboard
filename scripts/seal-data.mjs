import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrape as scrapeErste } from "./scrape-erste.mjs";
import { scrape as scrapeEtf } from "./scrape-etf.mjs";
import { scrape as scrapeFt } from "./scrape-ft.mjs";
import { scrape as scrapeFx } from "./scrape-fx.mjs";
import { seal } from "./seal.mjs";
import { sealedName } from "./sealed-name.mjs";

const from = "2025-11-01";
const to = new Date().toISOString().slice(0, 10);

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

const scrapers = { justetf: scrapeEtf, ft: scrapeFt, erste: scrapeErste };
const fxScrapers = { ft: scrapeFx };
const scraped = new Map(
  config.indexes
    .filter((index) => scrapers[index.market.provider])
    .map((index) => [index.market.symbol, index]),
);
const fxScraped = new Map(
  config.fx
    .filter((rate) => fxScrapers[rate.provider])
    .map((rate) => [rate.symbol, rate]),
);

mkdirSync(outputDir, { recursive: true });
for (const name of readdirSync(outputDir)) {
  if (name.endsWith(".bin")) rmSync(join(outputDir, name));
}
rmSync(join(outputDir, "history"), { recursive: true, force: true });
rmSync(join(outputDir, "portfolio.bin"), { force: true });

writeSealed(join(outputDir, sealedName(secret, "portfolio")), config, secret);
for (const symbol of symbols) {
  const series = fxScraped.has(symbol)
    ? await fxHistory(symbol)
    : scraped.has(symbol)
      ? await scrapedHistory(symbol)
      : history(symbol);
  writeSealed(join(outputDir, sealedName(secret, symbol)), series, secret);
}
console.log(`Sealed config and ${symbols.length} histories in ${outputDir}`);

async function fxHistory(symbol) {
  const rate = fxScraped.get(symbol);
  const profile = await fxScrapers[rate.provider](symbol, { from, to });
  const points = (profile.points ?? [])
    .filter((point) => point.date >= from && point.date <= to && point.value != null)
    .map((point) => ({ date: point.date, value: point.value }));
  if (!points.length) throw new Error("Scraped series is empty");
  return { symbol, points };
}

async function scrapedHistory(symbol) {
  const index = scraped.get(symbol);
  const profile = await scrapers[index.market.provider](symbol, index.quoteCurrency, { from, to });
  const points = (profile.points ?? [])
    .filter((point) => point.date >= from && point.date <= to && point.value != null)
    .map((point) => ({ date: point.date, value: point.value }));
  if (!points.length) throw new Error("Scraped series is empty");
  return { symbol, points };
}

function history(symbol) {
  const quote = config.fx.find((item) => item.symbol === symbol);
  const anchor = quote?.anchor ?? startFor(symbol);
  let value = anchor;
  let state = hash(symbol);
  const points = weekdays(from, to).map((date) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const shock = ((state % 1000) / 1000 - 0.48) * (quote ? 0.0025 : 0.008);
    value = Math.max(anchor >= 20 ? 1 : 0.2, value * (1 + shock));
    const digits = anchor >= 20 ? 2 : 4;
    const rounded = Number(value.toFixed(digits));
    value = rounded;
    return { date, value: rounded };
  });
  return { symbol, points };
}

function weekdays(start, end) {
  const days = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
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
