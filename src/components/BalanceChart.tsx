import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatMoney } from "../data/format";
import { dateLabel, monthTickDates, type ChartLine, type ValuePoint } from "../data/metrics";

export function BalanceChart({
  lines,
  points,
}: {
  lines: ChartLine[];
  points: ValuePoint[];
}) {
  const drawn = lines.filter((line) => points.some((point) => typeof point[line.key] === "number"));
  if (points.length === 0 || drawn.length === 0) return null;
  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
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
              filterNull
              formatter={(value) => formatMoney(Number(value ?? 0))}
              labelFormatter={(value) => dateLabel(String(value))}
              contentStyle={tooltipStyle}
            />
            {drawn.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={line.key === "total" ? 2.5 : 2}
                dot={false}
                connectNulls={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        {drawn.map((line) => (
          <li key={line.key}>
            <span className="swatch" style={{ background: line.color }} />
            {line.label}
          </li>
        ))}
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
