import { pathToFileURL } from "node:url";

const origin = "https://www.justetf.com";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

async function main() {
const isin = argument("--isin").toUpperCase();
const currency = (argument("--currency") || "EUR").toUpperCase();
const output = argument("--out");
const range = dateRange(argument("--from"), argument("--to"));

if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
  console.error(
    "Usage: node scripts/scrape-etf.mjs --isin <isin> [--currency EUR] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out drafts/profile.json]",
  );
  process.exit(1);
}
if (output && !output.startsWith("drafts/")) {
  console.error("Write the scraped profile under drafts/");
  process.exit(1);
}

const profile = await scrape(isin, currency, range);
const text = `${JSON.stringify(profile, null, 2)}\n`;
if (output) {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text);
    console.log(`Wrote ${profile.points.length} points to ${output}`);
} else {
  process.stdout.write(text);
}
}

export async function scrape(id, quoteCurrency, dates) {
  const [card, quote, chart, page] = await Promise.all([
    getJson(`/api/etfs/cards?locale=en&currency=${quoteCurrency}&isin=${id}`),
    getJson(`/api/etfs/${id}/quote?locale=en&currency=${quoteCurrency}`),
    getJson(
      `/api/etfs/${id}/performance-chart?locale=en&currency=${quoteCurrency}&valuesType=MARKET_VALUE&reduceData=false&includeDividends=false&dateFrom=${dates.from}&dateTo=${dates.to}`,
    ),
    getText(`/en/etf-profile.html?isin=${id}`),
  ]);
  const listed = card.etfs?.[0];
  if (!listed) throw new Error("Profile was not found");
  return {
    isin: id,
    name: listed.name,
    ticker: textField(page, "etf-profile-header_identifier-value-ticker"),
    fundCurrency: textField(page, "tl_etf-basics_value_fund-currency"),
    currency: quoteCurrency,
    ter: listed.ter?.raw ?? null,
    quote: {
      date: quote.latestQuoteDate,
      value: quote.latestQuote?.raw ?? null,
    },
    points: dailyPoints(chart.series ?? []),
  };
}

function dailyPoints(series) {
  const byDate = new Map();
  for (const point of series) {
    if (!point?.date || point.value?.raw == null) continue;
    byDate.set(point.date.slice(0, 10), point.value.raw);
  }
  return [...byDate.entries()].map(([date, value]) => ({ date, value }));
}

function textField(html, testId) {
  const match = html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]+)<`));
  if (!match) return "";
  return match[1].replaceAll("&amp;", "&").replaceAll("&#039;", "'").trim();
}

async function getJson(path) {
  const response = await request(path, "application/json");
  return response.json();
}

async function getText(path) {
  const response = await request(path, "text/html");
  return response.text();
}

async function request(path, accept) {
  const response = await fetch(`${origin}${path}`, {
    headers: {
      accept,
      "accept-language": "en",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
  return response;
}

function dateRange(from, to) {
  const end = to || new Date().toISOString().slice(0, 10);
  if (from) return { from, to: end };
  const [year, month] = end.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 12, 1));
  return { from: start.toISOString().slice(0, 10), to: end };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}
