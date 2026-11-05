let currencyCode = "EUR";

export function setFormatCurrency(code: string) {
  currencyCode = code;
}

const compact = new Intl.NumberFormat("en-IE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSignedMoney(value: number): string {
  if (value > 0) return `+${formatMoney(value)}`;
  return formatMoney(value);
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
