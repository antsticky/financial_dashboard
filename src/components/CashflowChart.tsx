import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatMoney } from "../data/format";
import { dateLabel, monthTickDates, type FlowPoint } from "../data/metrics";

const contribution = "#3d5a80";
const dividend = "#0d7a4f";

export function CashflowChart({ points }: { points: FlowPoint[] }) {
  const drawn = points.some((point) => point.contribution !== 0 || point.dividend !== 0);
  if (!drawn) return null;
  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ebe4d8" vertical={false} />
            <XAxis
              dataKey="month"
              ticks={monthTickDates(points.map((point) => point.month))}
              tickFormatter={(value: string) =>
                new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
                  new Date(`${value.slice(0, 10)}T00:00:00Z`),
                )
              }
              tick={{ fontSize: 11, fill: "#5e5a54" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value)}
              width={44}
              tick={{ fontSize: 11, fill: "#5e5a54" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => formatMoney(Number(value ?? 0))}
              labelFormatter={(value) => dateLabel(String(value))}
              contentStyle={tooltipStyle}
            />
            <Bar
              dataKey="contribution"
              name="Contributions"
              fill={contribution}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
            />
            <Bar
              dataKey="dividend"
              name="Dividends"
              fill={dividend}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        <li>
          <span className="swatch" style={{ background: contribution }} />
          Contributions
        </li>
        <li>
          <span className="swatch" style={{ background: dividend }} />
          Dividends
        </li>
      </ul>
    </>
  );
}

const tooltipStyle = {
  background: "#fffcf8",
  border: "1px solid #e8e2d8",
  borderRadius: 12,
  fontSize: 13,
};
