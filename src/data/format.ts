const money = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat("en-IE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number): string {
  return money.format(value);
}

export function formatSignedMoney(value: number): string {
  if (value > 0) return `+${money.format(value)}`;
  return money.format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const text = `${Math.abs(value * 100).toFixed(1)}%`;
  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function tone(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}
