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
import type { ChartLine, ValuePoint } from "../data/metrics";

export function BalanceChart({
  lines,
  points,
}: {
  lines: ChartLine[];
  points: ValuePoint[];
}) {
  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ebe4d8" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#5e5a54" }}
              axisLine={false}
              tickLine={false}
              interval={points.length > 6 ? 1 : 0}
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
              contentStyle={tooltipStyle}
            />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={line.key === "total" ? 2.5 : 2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        {lines.map((line) => (
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
