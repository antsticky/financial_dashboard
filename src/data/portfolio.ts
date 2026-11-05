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
  month: string;
  bankId: BankId;
  holdingId: HoldingId;
  value: number;
  contribution: number;
  dividend: number;
};

type Point = { month: string; value: number };

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
  bankId: BankId;
  holdingId: HoldingId;
  bought: string;
  costEur: number;
};

const portfolio = source.portfolio as PortfolioFile;
const series = source.series as Record<string, Point[]>;

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

export function perBase(currency: string, month: string): number {
  if (currency === portfolio.baseCurrency) return 1;
  const direct = portfolio.fx.find((pair) => pair.from === portfolio.baseCurrency && pair.to === currency);
  if (direct) return pairQuote(direct, month);
  const inverse = portfolio.fx.find((pair) => pair.from === currency && pair.to === portfolio.baseCurrency);
  if (!inverse) throw new Error(`Missing FX for ${currency}`);
  const intoBase = pairQuote(inverse, month);
  return intoBase === 0 ? 0 : 1 / intoBase;
}

export const holdings: Holding[] = portfolio.indexes.map((index) => ({
  id: index.id,
  ticker: index.ticker,
  name: index.name,
  color: index.color,
}));

export const purchases: Purchase[] = portfolio.positions.map((position) => {
  const index = indexFor(position.indexId);
  const month = position.bought.slice(0, 7);
  return {
    bankId: position.bankId,
    holdingId: position.indexId,
    bought: position.bought,
    costEur: position.buyPrice * position.notional * eurPerUnit(index.quoteCurrency, month),
  };
});

export const snapshots: MonthSnapshot[] = portfolio.positions.flatMap((position) => {
  const index = indexFor(position.indexId);
  const bought = position.bought.slice(0, 7);
  return pointsFor(index.market.symbol)
    .filter((point) => point.month >= bought)
    .map((point) => ({
      month: point.month,
      bankId: position.bankId,
      holdingId: position.indexId,
      value: point.value * position.notional * eurPerUnit(index.quoteCurrency, point.month),
      contribution: 0,
      dividend: 0,
    }));
});

function indexFor(id: string) {
  const index = portfolio.indexes.find((item) => item.id === id);
  if (!index) throw new Error("Unknown holding");
  return index;
}

function pointsFor(symbol: string): Point[] {
  const points = series[symbol];
  if (!points?.length) throw new Error(`Missing history for ${symbol}`);
  return points;
}

function eurPerUnit(currency: string, month: string): number {
  if (currency === portfolio.baseCurrency) return 1;
  const pair = portfolio.fx.find((item) => item.from === currency && item.to === portfolio.baseCurrency);
  if (!pair) throw new Error(`Missing FX for ${currency}`);
  return pairQuote(pair, month);
}

function pairQuote(pair: PortfolioFile["fx"][number], month: string): number {
  const point = pointsFor(pair.symbol).find((item) => item.month === month);
  if (!point || point.value === 0) throw new Error(`Missing FX for ${pair.from}`);
  return pair.invert ? 1 / point.value : point.value;
}
