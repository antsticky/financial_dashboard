import { pathToFileURL } from "node:url";

const origin = "https://markets.ft.com";

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
      "Usage: node scripts/scrape-ft.mjs --isin <isin> [--currency EUR] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out drafts/profile.json]",
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
    console.log(`Wrote ${profile.points.length} months to ${output}`);
  } else {
    process.stdout.write(text);
  }
}

export async function scrape(id, quoteCurrency, dates) {
  const page = await getText(`/data/funds/tearsheet/summary?s=${encodeURIComponent(`${id}:${quoteCurrency}`)}`);
  const instrument = page.match(/xid(?:&quot;|")\s*:\s*(?:&quot;|")(\d+)/)?.[1];
  if (!instrument) throw new Error("Profile was not found");

  const chart = await postJson("/data/chartapi/series", {
    days: 3650,
    dataPeriod: "Day",
    dataInterval: 1,
    returnDateType: "ISO8601",
    elements: [{ Type: "price", Symbol: instrument, Currency: quoteCurrency }],
  });
  const series = chart.Elements?.[0];
  const closes = series?.ComponentSeries?.find((item) => item.Type === "Close")?.Values;
  if (chart.Status !== 1 || !series || !closes?.length || closes.length !== chart.Dates?.length) {
    throw new Error("Profile was not found");
  }

  const points = dailyCloses(chart.Dates, closes, dates);
  const last = points.at(-1);
  return {
    isin: id,
    name: series.CompanyName ?? "",
    ticker: series.DisplaySymbol ?? "",
    fundCurrency: series.Currency ?? quoteCurrency,
    currency: quoteCurrency,
    quote: last ? { date: last.date, value: last.value } : { date: null, value: null },
    points,
  };
}

function dailyCloses(dates, closes, range) {
  const from = range.from.slice(0, 10);
  const to = range.to.slice(0, 10);
  const byDate = new Map();
  for (let index = 0; index < dates.length; index += 1) {
    const value = closes[index];
    const date = dates[index]?.slice(0, 10);
    if (value == null || !date || date < from || date > to) continue;
    byDate.set(date, value);
  }
  return [...byDate.entries()].map(([date, value]) => ({ date, value }));
}

async function getText(path) {
  const response = await request(path, { accept: "text/html" });
  return response.text();
}

async function postJson(path, body) {
  const response = await request(path, {
    method: "POST",
    accept: "application/json",
    "content-type": "application/json",
    body: JSON.stringify(body),
  });
  return response.json();
}

async function request(path, { accept, method = "GET", body, ...headers }) {
  const response = await fetch(`${origin}${path}`, {
    method,
    body,
    headers: {
      accept,
      "user-agent": "Mozilla/5.0",
      referer: origin,
      ...headers,
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
