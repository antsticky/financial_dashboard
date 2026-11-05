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
  changeAmount: number;
  changePercent: number | null;
  dividends: number;
};

export type ComparisonRow = {
  id: string;
  label: string;
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

export function listMonths(): string[] {
  return [...new Set(snapshots.map((snapshot) => snapshot.month))].sort();
}

export function sliceMonths(months: string[], range: RangeLength): string[] {
  return range === 12 ? months : months.slice(-range);
}

export function monthLabel(month: string): string {
  return formatMonth(month, { month: "short" });
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
  return months.map((month) => {
    const point: ValuePoint = {
      month,
      label: monthLabel(month),
    };
    for (const line of lines) {
      point[line.key] = valueForLine(scope, line.key, month);
    }
    return point;
  });
}

export function flowSeries(scope: Scope, months: string[]): FlowPoint[] {
  return months.map((month) => {
    const row = figures(scope, month);
    return {
      month,
      label: monthLabel(month),
      contribution: row.contribution,
      dividend: row.dividend,
    };
  });
}

export function summarize(scope: Scope, months: string[]): Summary {
  const last = figures(scope, months[months.length - 1]);
  const basis = purchaseBasis(scope);
  const changeAmount = last.value - basis.cost;
  let dividends = 0;
  for (const month of months) {
    dividends += figures(scope, month).dividend;
  }
  return {
    latestValue: last.value,
    latestMonth: months[months.length - 1],
    basisDate: basis.date,
    changeAmount,
    changePercent: basis.cost === 0 ? null : changeAmount / basis.cost,
    dividends,
  };
}

export function compareDates(
  scope: Scope,
  from: string,
  to: string,
): DateComparison {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const months = listMonths().filter((month) => month >= start && month <= end);

  return {
    start,
    end,
    rows: comparisonParts(scope).map((part) => {
      const atStart = figures(part.scope, start);
      const atEnd = figures(part.scope, end);
      const difference = atEnd.value - atStart.value;
      let contributions = 0;
      let dividends = 0;
      for (const month of months) {
        const row = figures(part.scope, month);
        contributions += row.contribution;
        dividends += row.dividend;
      }
      return {
        id: part.id,
        label: part.label,
        valueFrom: atStart.value,
        valueTo: atEnd.value,
        difference,
        percent: atStart.value === 0 ? null : difference / atStart.value,
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

function valueForLine(scope: Scope, key: string, month: string): number {
  if (key === "total") return figures(scope, month).value;
  if (scope.holding === "all") {
    return figures({ bank: scope.bank, holding: key as HoldingId }, month).value;
  }
  if (scope.bank === "all" && banks.some((bank) => bank.id === key)) {
    return figures({ bank: key, holding: scope.holding }, month).value;
  }
  return figures(scope, month).value;
}

function banksForHolding(holding: HoldingId) {
  const ids = new Set(
    snapshots
      .filter((snapshot) => snapshot.holdingId === holding)
      .map((snapshot) => snapshot.bankId),
  );
  return banks.filter((bank) => ids.has(bank.id));
}

function purchaseBasis(scope: Scope): { cost: number; date: string | null } {
  const rows = purchases.filter(
    (purchase) =>
      (scope.bank === "all" || purchase.bankId === scope.bank) &&
      (scope.holding === "all" || purchase.holdingId === scope.holding),
  );
  const dates = [...new Set(rows.map((purchase) => purchase.bought))];
  const cost = rows.reduce(
    (sum, purchase) => sum + purchase.costEur * valueRate(purchase.bought.slice(0, 7)),
    0,
  );
  return { cost, date: dates.length === 1 ? dates[0] : null };
}

function figures(scope: Scope, month: string): Figures {
  const rows = snapshots.filter(
    (snapshot) =>
      snapshot.month === month &&
      (scope.bank === "all" || snapshot.bankId === scope.bank) &&
      (scope.holding === "all" || snapshot.holdingId === scope.holding),
  );
  if (rows.length === 0) {
    return { value: 0, contribution: 0, dividend: 0 };
  }
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
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}
