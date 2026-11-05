import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrape as scrapeErste } from "./scrape-erste.mjs";
import { scrape as scrapeEtf } from "./scrape-etf.mjs";
import { scrape as scrapeFt } from "./scrape-ft.mjs";
import { scrape as scrapeFx } from "./scrape-fx.mjs";
import { openSealed, seal } from "./seal.mjs";
import { sealedName } from "./sealed-name.mjs";

const windowStart = "2025-11-01";
const overlapDays = 7;

const secret = argument("--secret") || process.env.MISC_PASSPHRASE;
const root = argument("--root") || ".";
const dataDir = join(root, "data");
const today = new Date().toISOString().slice(0, 10);

if (!secret) {
  console.error("Usage: node scripts/append-data.mjs --secret <passphrase> [--root .]");
  process.exit(1);
}

const portfolio = openJson(join(dataDir, sealedName(secret, "portfolio")));
const indexScrapers = { justetf: scrapeEtf, ft: scrapeFt, erste: scrapeErste };
const fxScrapers = { ft: scrapeFx };

const jobs = [
  ...portfolio.indexes.map((index) => ({
    symbol: index.market.symbol,
    scrape: indexScrapers[index.market.provider],
    run: (scrape, from) => scrape(index.market.symbol, index.quoteCurrency, { from, to: today }),
  })),
  ...portfolio.fx.map((rate) => ({
    symbol: rate.symbol,
    scrape: fxScrapers[rate.provider],
    run: (scrape, from) => scrape(rate.symbol, { from, to: today }),
  })),
];

let updated = 0;
let unchanged = 0;
let skipped = 0;
let failed = 0;

for (const job of jobs) {
  if (!job.scrape) {
    skipped += 1;
    continue;
  }
  try {
    const changed = await appendSeries(job.symbol, async (from) => {
      const profile = await job.run(job.scrape, from);
      return profile.points ?? [];
    });
    if (changed) updated += 1;
    else unchanged += 1;
  } catch (error) {
    failed += 1;
    console.error(error instanceof Error ? error.message : "Scrape failed");
  }
}

console.log(`Appended ${updated} series, ${unchanged} already current, ${skipped} without a scraper`);
if (failed) {
  console.error(`${failed} series could not be scraped`);
  process.exit(1);
}

async function appendSeries(symbol, fetchPoints) {
  const path = join(dataDir, sealedName(secret, symbol));
  const history = openJson(path);
  if (history.symbol !== symbol || !Array.isArray(history.points)) {
    throw new Error("Sealed series could not be opened");
  }

  const last = history.points.reduce((max, point) => (point.date > max ? point.date : max), "");
  const from = last ? shiftDate(last, -overlapDays) : windowStart;
  const fresh = (await fetchPoints(from))
    .filter((point) => point?.value != null && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && point.date <= today)
    .map((point) => ({ date: point.date, value: point.value }));
  if (!fresh.length) throw new Error("Scraped series is empty");

  const byDate = new Map(history.points.map((point) => [point.date, point.value]));
  let changed = false;
  for (const point of fresh) {
    if (byDate.get(point.date) !== point.value) {
      byDate.set(point.date, point.value);
      changed = true;
    }
  }
  if (!changed) return false;

  const points = [...byDate.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([date, value]) => ({ date, value }));
  writeFileSync(path, seal(Buffer.from(JSON.stringify({ symbol, points })), secret));
  return true;
}

function shiftDate(iso, days) {
  const cursor = new Date(`${iso}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  const shifted = cursor.toISOString().slice(0, 10);
  return shifted < windowStart ? windowStart : shifted;
}

function openJson(path) {
  try {
    return JSON.parse(openSealed(readFileSync(path), secret).toString("utf8"));
  } catch {
    throw new Error("Sealed file could not be opened");
  }
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}
