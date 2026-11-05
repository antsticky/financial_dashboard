import { pathToFileURL } from "node:url";

const origin = "https://www.erstemarket.hu";

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
      "Usage: node scripts/scrape-erste.mjs --isin <isin> [--currency EUR] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out drafts/profile.json]",
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
  const page = await getText(`/befektetesi_alapok/alap/${encodeURIComponent(id)}`);
  const facts = pageFacts(page);
  if (!facts.instrument) throw new Error("Profile was not found");
  if (facts.currency && facts.currency !== quoteCurrency) {
    throw new Error("Quoted currency does not match the fund");
  }

  const chart = await getJson(`/funds/chart/${facts.instrument}`);
  const series = Array.isArray(chart?.series) ? chart.series : [];
  if (!series.length) throw new Error("Profile was not found");

  const daily = series
    .filter((point) => Array.isArray(point) && point.length >= 2 && point[1] != null)
    .map(([time, value]) => ({ date: utcDay(time), value }));
  if (facts.date && facts.price != null && facts.date > daily.at(-1).date) {
    daily.push({ date: facts.date, value: facts.price });
  }

  const points = monthEnds(daily, dates);
  const last = points.at(-1);
  const ticker = typeof chart.ticker === "string" ? chart.ticker.trim() : "";
  return {
    isin: id,
    name: facts.name || chart.title || "",
    ticker,
    fundCurrency: facts.currency || quoteCurrency,
    currency: quoteCurrency,
    quote: last ? { date: last.date, value: last.value } : { date: null, value: null },
    points: points.map(({ month, value }) => ({ month, value })),
  };
}

function pageFacts(html) {
  const instrument = html.match(/instrument-id="(\d+)"/)?.[1] ?? "";
  const name = decode(html.match(/data-name="([^"]*)"/)?.[1] ?? "");
  const currency = html.match(/last_price[^>]*title="([A-Z]{3})"/)?.[1]
    || html.match(/Alap devizaneme[\s\S]{0,120}?>([A-Z]{3})</)?.[1]
    || "";
  const priceText = html.match(/last_price[^>]*>([0-9][0-9\s.,]*)</)?.[1] ?? "";
  const price = priceText ? Number(priceText.replaceAll(/\s/g, "").replace(",", ".")) : null;
  const dated = html.match(/Árfolyam dátuma:[\s\S]{0,240}?>(\d{4})\.(\d{2})\.(\d{2})/) ;
  return {
    instrument,
    name,
    currency,
    price: Number.isFinite(price) ? price : null,
    date: dated ? `${dated[1]}-${dated[2]}-${dated[3]}` : "",
  };
}

function monthEnds(daily, range) {
  const from = range.from.slice(0, 7);
  const to = range.to.slice(0, 7);
  const byMonth = new Map();
  for (const point of daily) {
    const month = point.date.slice(0, 7);
    if (month < from || month > to) continue;
    byMonth.set(month, { month, date: point.date, value: point.value });
  }
  return [...byMonth.values()];
}

function utcDay(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function decode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&ndash;", "–");
}

async function getText(path) {
  const response = await request(path, { accept: "text/html" });
  return response.text();
}

async function getJson(path) {
  const response = await request(path, {
    accept: "application/json",
    "x-requested-with": "XMLHttpRequest",
  });
  const text = await response.text();
  if (!text || text === "0") return null;
  return JSON.parse(text);
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
