import source from "virtual:portfolio";

export type BankId = string;
export type HoldingId = string;

export type Bank = {
  id: BankId;
  label: string;
  color: string;
};

export type Holding = {
  id: HoldingId;
  ticker: string;
  name: string;
  color: string;
};

export type MonthSnapshot = {
  lot: number;
  month: string;
  bankId: BankId;
  holdingId: HoldingId;
  value: number;
  contribution: number;
  dividend: number;
};

type Point = { date: string; value: number };
type RawPoint = { date?: string; month?: string; value: number };

type PortfolioFile = {
  baseCurrency: string;
  colors: string[];
  banks: { id: string; name: string }[];
  indexes: {
    id: string;
    ticker: string;
    name: string;
    color: string;
    quoteCurrency: string;
    market: { symbol: string };
  }[];
  fx: { from: string; to: string; symbol: string; invert?: boolean }[];
  positions: { bankId: string; indexId: string; notional: number; bought: string; buyPrice: number }[];
};

export type Purchase = {
  lot: number;
  bankId: BankId;
  holdingId: HoldingId;
  bought: string;
  costEur: number;
};

const portfolio = source.portfolio as PortfolioFile;
const series = source.series as Record<string, RawPoint[]>;

if (portfolio.colors.length < portfolio.banks.length) {
  throw new Error("colors must list one entry for each bank, in the same order");
}

export const banks: Bank[] = portfolio.banks.map((bank, index) => ({
  id: bank.id,
  label: bank.name,
  color: portfolio.colors[index],
}));

const quoted = new Set(portfolio.fx.flatMap((pair) => [pair.from, pair.to]));
export const displayCurrencies = ["EUR", "USD", "HUF"].filter(
  (code) => code === portfolio.baseCurrency || quoted.has(code),
);

export function perBase(currency: string, date: string): number {
  if (currency === portfolio.baseCurrency) return 1;
  const direct = portfolio.fx.find((pair) => pair.from === portfolio.baseCurrency && pair.to === currency);
  if (direct) return pairRate(direct, date);
  const inverse = portfolio.fx.find((pair) => pair.from === currency && pair.to === portfolio.baseCurrency);
  if (!inverse) throw new Error(`Missing FX for ${currency}`);
  const intoBase = pairRate(inverse, date);
  return intoBase === 0 ? 0 : 1 / intoBase;
}

export const holdings: Holding[] = portfolio.indexes.map((index) => ({
  id: index.id,
  ticker: index.ticker,
  name: index.name,
  color: index.color,
}));

const prepared = new Map<string, Point[]>();

for (const symbol of Object.keys(series)) seriesFor(symbol);

const calendar = [
  ...new Set([...prepared.values()].flatMap((points) => points.map((point) => point.date))),
].sort();

export const purchases: Purchase[] = portfolio.positions.map((position, lot) => {
  const index = indexFor(position.indexId);
  return {
    lot,
    bankId: position.bankId,
    holdingId: position.indexId,
    bought: position.bought,
    costEur: position.buyPrice * position.notional * eurPerUnit(index.quoteCurrency, position.bought),
  };
});

export const snapshots: MonthSnapshot[] = portfolio.positions.flatMap((position, lot) => {
  const index = indexFor(position.indexId);
  const prices = seriesFor(index.market.symbol);
  const fx = fxFor(index.quoteCurrency);
  const priceCursor = { index: 0, value: null as number | null };
  const fxCursor = { index: 0, value: null as number | null };
  const rows: MonthSnapshot[] = [];
  for (const date of calendar) {
    const price = advance(prices, date, priceCursor);
    const rate = fx ? advance(fx.points, date, fxCursor) : 1;
    if (date < position.bought || price == null || rate == null || rate === 0) continue;
    const eur = fx ? (fx.invert ? 1 / rate : rate) : 1;
    rows.push({
      lot,
      month: date,
      bankId: position.bankId,
      holdingId: position.indexId,
      value: price * position.notional * eur,
      contribution: 0,
      dividend: 0,
    });
  }
  return rows;
});

function seriesFor(symbol: string): Point[] {
  const cached = prepared.get(symbol);
  if (cached) return cached;
  const raw = series[symbol];
  if (!raw?.length) throw new Error("Missing history");
  const points = raw
    .map((point) => {
      const date = point.date?.slice(0, 10) || (point.month?.length === 7 ? `${point.month}-28` : point.month?.slice(0, 10));
      return date ? { date, value: point.value } : null;
    })
    .filter((point): point is Point => point != null && Number.isFinite(point.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error("Missing history");
  prepared.set(symbol, points);
  return points;
}

function indexFor(id: string) {
  const index = portfolio.indexes.find((item) => item.id === id);
  if (!index) throw new Error("Unknown holding");
  return index;
}

function fxFor(currency: string): { points: Point[]; invert: boolean } | null {
  if (currency === portfolio.baseCurrency) return null;
  const pair = portfolio.fx.find((item) => item.from === currency && item.to === portfolio.baseCurrency);
  if (!pair) throw new Error(`Missing FX for ${currency}`);
  return { points: seriesFor(pair.symbol), invert: Boolean(pair.invert) };
}

function eurPerUnit(currency: string, date: string): number {
  const fx = fxFor(currency);
  if (!fx) return 1;
  const rate = carried(fx.points, date);
  if (rate == null || rate === 0) throw new Error(`Missing FX for ${currency}`);
  return fx.invert ? 1 / rate : rate;
}

function pairRate(pair: PortfolioFile["fx"][number], date: string): number {
  const value = carried(seriesFor(pair.symbol), date);
  if (value == null || value === 0) throw new Error(`Missing FX for ${pair.from}`);
  return pair.invert ? 1 / value : value;
}

function carried(points: Point[], date: string): number | null {
  let found: number | null = null;
  for (const point of points) {
    if (point.date > date) break;
    found = point.value;
  }
  return found;
}

function advance(points: Point[], date: string, cursor: { index: number; value: number | null }) {
  while (cursor.index < points.length && points[cursor.index].date <= date) {
    cursor.value = points[cursor.index].value;
    cursor.index += 1;
  }
  return cursor.value;
}
