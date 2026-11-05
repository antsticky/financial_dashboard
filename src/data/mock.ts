export type BankId = "bank1" | "bank2";

export type Bank = {
  id: BankId;
  label: string;
  color: string;
};

export const banks: Bank[] = [
  { id: "bank1", label: "Bank 1", color: "#1f3d32" },
  { id: "bank2", label: "Bank 2", color: "#5e4b8a" },
];

export type HoldingId = "vwce" | "cspx" | "aggh";

export type Holding = {
  id: HoldingId;
  ticker: string;
  name: string;
  color: string;
};

export const holdings: Holding[] = [
  {
    id: "vwce",
    ticker: "VWCE",
    name: "Vanguard FTSE All-World",
    color: "#1f6b4a",
  },
  {
    id: "cspx",
    ticker: "CSPX",
    name: "iShares Core S&P 500",
    color: "#3d5a80",
  },
  {
    id: "aggh",
    ticker: "AGGH",
    name: "iShares Global Aggregate Bond",
    color: "#9a6b2f",
  },
];

export type MonthSnapshot = {
  month: string;
  bankId: BankId;
  holdingId: HoldingId;
  value: number;
  contribution: number;
  dividend: number;
};

const months = [
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
] as const;

const bank1VwceRows = [
  [12000, 250, 0],
  [12500, 0, 48],
  [12800, 300, 0],
  [13300, 0, 0],
  [12850, 0, 52],
  [13100, 250, 0],
  [13700, 0, 0],
  [14200, 300, 56],
  [14600, 0, 0],
  [14000, 0, 0],
  [14650, 250, 60],
  [15200, 0, 0],
] as const;

const bank2VwceRows = [
  [6200, 150, 0],
  [6450, 0, 24],
  [6600, 200, 0],
  [6800, 0, 0],
  [6500, 0, 26],
  [6700, 150, 0],
  [6950, 0, 0],
  [7200, 200, 28],
  [7350, 0, 0],
  [7100, 0, 0],
  [7400, 150, 30],
  [7700, 0, 0],
] as const;

const cspxRows = [
  [9800, 300, 0],
  [10400, 0, 28],
  [10850, 0, 0],
  [11400, 350, 0],
  [10600, 0, 32],
  [11250, 0, 0],
  [12100, 300, 0],
  [12800, 0, 36],
  [13350, 0, 0],
  [12600, 0, 0],
  [13400, 300, 40],
  [14150, 0, 0],
] as const;

const agghRows = [
  [6400, 200, 16],
  [6450, 0, 16],
  [6380, 0, 16],
  [6500, 0, 17],
  [6550, 200, 17],
  [6480, 0, 17],
  [6600, 0, 18],
  [6680, 0, 18],
  [6620, 200, 18],
  [6700, 0, 19],
  [6760, 0, 19],
  [6840, 0, 19],
] as const;

function rows(
  bankId: BankId,
  holdingId: HoldingId,
  values: readonly (readonly [number, number, number])[],
): MonthSnapshot[] {
  return months.map((month, index) => ({
    month,
    bankId,
    holdingId,
    value: values[index][0],
    contribution: values[index][1],
    dividend: values[index][2],
  }));
}

export const snapshots: MonthSnapshot[] = [
  ...rows("bank1", "vwce", bank1VwceRows),
  ...rows("bank2", "vwce", bank2VwceRows),
  ...rows("bank1", "cspx", cspxRows),
  ...rows("bank2", "aggh", agghRows),
];
