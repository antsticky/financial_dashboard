import {
  banks,
  holdings,
  perBase,
  purchases,
  snapshots,
  type BankId,
  type HoldingId,
} from "./portfolio";

export type Scope = {
  bank: BankId | "all";
  holding: HoldingId | "all";
};

export type RangeLength = 6 | 12;

export type ChartLine = {
  key: string;
  label: string;
  color: string;
};

export type ValuePoint = {
  month: string;
  label: string;
  [series: string]: string | number | null;
};

export type FlowPoint = {
  month: string;
  label: string;
  contribution: number;
  dividend: number;
};

export type Summary = {
  latestValue: number;
  latestMonth: string;
  basisDate: string | null;
  basisKind: "purchase" | "start" | "mixed";
  changeAmount: number;
  changePercent: number | null;
  dividends: number;
};

export type ComparisonRow = {
  id: string;
  label: string;
  origin: string;
  fromLabel: string;
  valueFrom: number;
  valueTo: number;
  difference: number;
  percent: number | null;
  contributions: number;
  dividends: number;
};

export type DateComparison = {
  start: string;
  end: string;
  rows: ComparisonRow[];
};

type Figures = {
  value: number;
  contribution: number;
  dividend: number;
};

let valueRate = (month: string) => perBase("EUR", month);

export function setValueRate(currency: string) {
  valueRate = (month: string) => perBase(currency, month);
}

const combinedLine: ChartLine = {
  key: "total",
  label: "Combined",
  color: "#1c1c1a",
};

export function listDates(): string[] {
  return [...new Set(snapshots.map((snapshot) => snapshot.month))].sort();
}

export function listMonths(): string[] {
  return [...new Set(listDates().map((date) => date.slice(0, 7)))];
}

export function sliceMonths(dates: string[], range: RangeLength): string[] {
  if (range === 12 || dates.length === 0) return dates;
  const [year, month, day] = dates[dates.length - 1].split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 - 6, day || 1));
  const cutoff = start.toISOString().slice(0, 10);
  return dates.filter((date) => date >= cutoff);
}

export function monthLabel(month: string): string {
  return formatMonth(month, month.length > 7 ? { day: "numeric", month: "short" } : { month: "short" });
}

export function monthTickDates(dates: string[]): string[] {
  const ticks: string[] = [];
  let previous = "";
  for (const date of dates) {
    const month = date.slice(0, 7);
    if (month === previous) continue;
    ticks.push(date);
    previous = month;
  }
  return ticks;
}

export function monthMenuLabel(month: string): string {
  return formatMonth(month, { month: "long", year: "numeric" });
}

export function dateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function basisPhrase(summary: Pick<Summary, "basisKind" | "basisDate">): string {
  if (summary.basisKind === "start" && summary.basisDate) return `from ${dateLabel(summary.basisDate)}`;
  if (summary.basisKind === "purchase" && summary.basisDate) return `vs ${dateLabel(summary.basisDate)}`;
  return "since purchase";
}

export function basisSentence(summary: Pick<Summary, "basisKind" | "basisDate">): string {
  if (summary.basisKind === "start" && summary.basisDate) return `From ${dateLabel(summary.basisDate)}.`;
  if (summary.basisKind === "purchase" && summary.basisDate) return `Buy price on ${dateLabel(summary.basisDate)}.`;
  return "Since purchase.";
}

export function holdingsInScope(bank: Scope["bank"]) {
  const ids = new Set(
    snapshots
      .filter((snapshot) => bank === "all" || snapshot.bankId === bank)
      .map((snapshot) => snapshot.holdingId),
  );
  return holdings.filter((holding) => ids.has(holding.id));
}

export function scopeCaption(scope: Scope): string {
  const holding = holdings.find((item) => item.id === scope.holding);
  const bank = banks.find((item) => item.id === scope.bank);
  if (holding && bank) return `${holding.name} at ${bank.label}.`;
  if (holding) return `${holding.name} across banks.`;
  if (bank) return `${bank.label}, each ETF.`;
  return "All banks, each ETF.";
}

export function chartLines(scope: Scope): ChartLine[] {
  if (scope.holding === "all") {
    const lines = holdingsInScope(scope.bank).map((holding) => ({
      key: holding.id,
      label: holding.ticker,
      color: holding.color,
    }));
    return lines.length > 1 ? [...lines, combinedLine] : lines;
  }

  if (scope.bank === "all") {
    const accounts = banksForHolding(scope.holding);
    if (accounts.length > 1) {
      return [
        ...accounts.map((bank) => ({
          key: bank.id,
          label: bank.label,
          color: bank.color,
        })),
        combinedLine,
      ];
    }
  }

  const holding = holdings.find((item) => item.id === scope.holding);
  return holding
    ? [{ key: holding.id, label: holding.ticker, color: holding.color }]
    : [];
}

export function valueSeries(scope: Scope, months: string[]): ValuePoint[] {
  const lines = chartLines(scope);
  return months.flatMap((month) => {
    const point: ValuePoint = {
      month,
      label: monthLabel(month),
    };
    let present = false;
    for (const line of lines) {
      const value = valueForLine(scope, line.key, month);
      point[line.key] = value;
      if (value != null) present = true;
    }
    return present ? [point] : [];
  });
}

export function flowSeries(scope: Scope, months: string[]): FlowPoint[] {
  return months.flatMap((month) => {
    const row = figures(scope, month);
    if (!row) return [];
    return [{
      month,
      label: monthLabel(month),
      contribution: row.contribution,
      dividend: row.dividend,
    }];
  });
}

export function summarize(scope: Scope, months: string[]): Summary {
  const start = months[0] ?? null;
  const end = months.at(-1) ?? null;
  const basis = performanceBasis(scope, start, end);
  const changeAmount = basis.to - basis.from;
  let dividends = 0;
  for (const month of months) {
    dividends += figures(scope, month)?.dividend ?? 0;
  }
  return {
    latestValue: basis.to,
    latestMonth: end ?? "",
    basisDate: basis.date,
    basisKind: basis.kind,
    changeAmount,
    changePercent: basis.from === 0 ? null : changeAmount / basis.from,
    dividends,
  };
}

export function compareDates(
  scope: Scope,
  from: string,
  to: string,
): DateComparison {
  const dates = listDates();
  const start = dateBound(dates, from <= to ? from : to, "start");
  const end = dateBound(dates, from <= to ? to : from, "end");
  const months = dates.filter((date) => date >= start && date <= end);

  return {
    start,
    end,
    rows: comparisonParts(scope).map((part) => {
      const basis = performanceBasis(part.scope, start, end);
      const difference = basis.to - basis.from;
      let contributions = 0;
      let dividends = 0;
      for (const month of months) {
        const row = figures(part.scope, month);
        contributions += row?.contribution ?? 0;
        dividends += row?.dividend ?? 0;
      }
      return {
        id: part.id,
        label: part.label,
        origin: basis.phrase,
        fromLabel: basis.short,
        valueFrom: basis.from,
        valueTo: basis.to,
        difference,
        percent: basis.from === 0 ? null : difference / basis.from,
        contributions,
        dividends,
      };
    }),
  };
}

function comparisonParts(scope: Scope): { id: string; label: string; scope: Scope }[] {
  if (scope.holding === "all") {
    const parts = holdingsInScope(scope.bank).map((holding) => ({
      id: holding.id,
      label: holding.ticker,
      scope: { bank: scope.bank, holding: holding.id },
    }));
    return parts.length > 1
      ? [{ id: "combined", label: "Combined", scope }, ...parts]
      : parts;
  }

  if (scope.bank === "all") {
    const accounts = banksForHolding(scope.holding);
    if (accounts.length > 1) {
      return [
        { id: "combined", label: "Combined", scope },
        ...accounts.map((bank) => ({
          id: bank.id,
          label: bank.label,
          scope: { bank: bank.id, holding: scope.holding },
        })),
      ];
    }
  }

  const holding = holdings.find((item) => item.id === scope.holding);
  const bank = banks.find((item) => item.id === scope.bank);
  return [
    {
      id: scope.holding,
      label: holding && bank ? `${holding.ticker} at ${bank.label}` : holding?.ticker ?? "ETF",
      scope,
    },
  ];
}

function valueForLine(scope: Scope, key: string, month: string): number | null {
  if (key === "total") return figures(scope, month)?.value ?? null;
  if (scope.holding === "all") {
    return figures({ bank: scope.bank, holding: key as HoldingId }, month)?.value ?? null;
  }
  if (scope.bank === "all" && banks.some((bank) => bank.id === key)) {
    return figures({ bank: key, holding: scope.holding }, month)?.value ?? null;
  }
  return figures(scope, month)?.value ?? null;
}

function banksForHolding(holding: HoldingId) {
  const ids = new Set(
    snapshots
      .filter((snapshot) => snapshot.holdingId === holding)
      .map((snapshot) => snapshot.bankId),
  );
  return banks.filter((bank) => ids.has(bank.id));
}

function purchasesIn(scope: Scope) {
  return purchases.filter(
    (purchase) =>
      (scope.bank === "all" || purchase.bankId === scope.bank) &&
      (scope.holding === "all" || purchase.holdingId === scope.holding),
  );
}

function performanceBasis(scope: Scope, start: string | null, end: string | null) {
  const rows = purchasesIn(scope).map((purchase) => positionResult(purchase, start, end));
  const active = rows.filter((row) => row.active);
  const from = rows.reduce((sum, row) => sum + row.from, 0);
  const to = rows.reduce((sum, row) => sum + row.to, 0);
  const pricedFromBuy = active.filter((row) => row.fromCost);
  const buyDates = [...new Set(pricedFromBuy.map((row) => row.bought))];
  if (active.length > 0 && pricedFromBuy.length === active.length) {
    const date = buyDates.length === 1 ? buyDates[0] : null;
    return {
      from,
      to,
      kind: "purchase" as const,
      date,
      phrase: date ? `vs ${dateLabel(date)}` : "since purchase",
      short: date ? shortDate(date) : "Buy",
    };
  }
  if (pricedFromBuy.length === 0 && start) {
    return {
      from,
      to,
      kind: "start" as const,
      date: start,
      phrase: `from ${dateLabel(start)}`,
      short: monthMenuLabel(start),
    };
  }
  return {
    from,
    to,
    kind: "mixed" as const,
    date: null,
    phrase: "since purchase",
    short: "Buy",
  };
}

function positionResult(purchase: (typeof purchases)[number], start: string | null, end: string | null) {
  if (end && end < purchase.bought) return { from: 0, to: 0, fromCost: false, bought: purchase.bought, active: false };
  const cost = purchase.costEur * valueRate(purchase.bought);
  const to = (end ? lotMarket(purchase.lot, end) : null) ?? 0;
  if (!start || start <= purchase.bought) {
    return { from: cost, to, fromCost: true, bought: purchase.bought, active: true };
  }
  return {
    from: lotMarket(purchase.lot, start) ?? cost,
    to,
    fromCost: false,
    bought: purchase.bought,
    active: true,
  };
}

function lotMarket(lot: number, date: string): number | null {
  const row = snapshots.find((snapshot) => snapshot.lot === lot && snapshot.month === date);
  return row ? row.value * valueRate(date) : null;
}

function shortDate(date: string): string {
  return formatMonth(date, { day: "numeric", month: "short", year: "2-digit" });
}

function dateBound(dates: string[], key: string, edge: "start" | "end"): string {
  if (key.length > 7) return key;
  const matches = dates.filter((date) => date.startsWith(key));
  if (!matches.length) return key;
  return edge === "start" ? matches[0] : matches[matches.length - 1];
}

function figures(scope: Scope, month: string): Figures | null {
  const rows = snapshots.filter(
    (snapshot) =>
      snapshot.month === month &&
      (scope.bank === "all" || snapshot.bankId === scope.bank) &&
      (scope.holding === "all" || snapshot.holdingId === scope.holding),
  );
  if (rows.length === 0) return null;
  const scale = valueRate(month);
  return rows.reduce(
    (sum, snapshot) => ({
      value: sum.value + snapshot.value * scale,
      contribution: sum.contribution + snapshot.contribution * scale,
      dividend: sum.dividend + snapshot.dividend * scale,
    }),
    { value: 0, contribution: 0, dividend: 0 },
  );
}

function formatMonth(month: string, options: Intl.DateTimeFormatOptions): string {
  const [year, monthNumber, day] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, day || 1)));
}
