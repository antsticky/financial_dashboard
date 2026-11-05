import { useEffect, useState } from "react";
import {
  formatMoney,
  formatPercent,
  formatSignedMoney,
  tone,
} from "../data/format";
import { banks, holdings } from "../data/mock";
import { compareDates, type Scope } from "../data/metrics";

export function DateCompare({
  scope,
  allMonths,
  rangeMonths,
}: {
  scope: Scope;
  allMonths: string[];
  rangeMonths: string[];
}) {
  const [from, setFrom] = useState(rangeMonths[0]);
  const [to, setTo] = useState(rangeMonths[rangeMonths.length - 1]);
  const [editing, setEditing] = useState<"from" | "to">("from");

  useEffect(() => {
    setFrom(rangeMonths[0]);
    setTo(rangeMonths[rangeMonths.length - 1]);
  }, [rangeMonths]);

  const comparison = compareDates(scope, from, to);
  const lead = comparison.rows.find((row) => row.id === "combined") ?? comparison.rows[0];
  const parts = comparison.rows.filter((row) => row !== lead);
  const partMax = Math.max(...parts.flatMap((row) => [row.valueFrom, row.valueTo]), 1);
  const leadMax = Math.max(lead.valueFrom, lead.valueTo, 1);
  const startLabel = compactMonth(comparison.start);
  const endLabel = compactMonth(comparison.end);

  function pick(month: string) {
    if (editing === "from") {
      if (month > to) {
        setFrom(to);
        setTo(month);
      } else {
        setFrom(month);
      }
      setEditing("to");
    } else if (month < from) {
      setTo(from);
      setFrom(month);
    } else {
      setTo(month);
    }
    if (editing === "to") setEditing("from");
  }

  return (
    <>
      <section className="card" aria-label="Date range">
        <div className="range-ends">
          <button type="button" aria-pressed={editing === "from"} onClick={() => setEditing("from")}>
            <span>From</span>
            <strong>{compactMonth(from)}</strong>
          </button>
          <span className="range-arrow" aria-hidden="true">
            →
          </span>
          <button type="button" aria-pressed={editing === "to"} onClick={() => setEditing("to")}>
            <span>To</span>
            <strong>{compactMonth(to)}</strong>
          </button>
        </div>
        <div className="month-grid" role="group" aria-label="Months">
          {allMonths.map((month) => {
            const point = month === from && month === to ? "both" : month === from ? "start" : month === to ? "end" : undefined;
            const partsOfMonth = monthParts(month);
            return (
              <button
                key={month}
                type="button"
                aria-pressed={month === from || month === to}
                aria-label={partsOfMonth.full}
                data-in-range={month >= from && month <= to ? "true" : undefined}
                data-endpoint={point}
                onClick={() => pick(month)}
              >
                {partsOfMonth.name}
                <small>{partsOfMonth.year}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card" aria-label="Comparison" aria-live="polite">
        <p className="kicker">{lead.label}</p>
        <p className="hero-value">{formatMoney(lead.valueTo)}</p>
        <p className={`caption ${tone(lead.difference)}`}>
          {`${formatSignedMoney(lead.difference)} ${formatPercent(lead.percent)} from ${startLabel}`}
        </p>
        <div className="compare-pair">
          <Meter label={startLabel} value={lead.valueFrom} max={leadMax} />
          <Meter label={endLabel} value={lead.valueTo} max={leadMax} color={seriesColor(lead.id)} />
        </div>
        <div className="compare-flows">
          <div>
            <span>Contributions</span>
            <strong>{formatMoney(lead.contributions)}</strong>
          </div>
          <div>
            <span>Dividends</span>
            <strong className={lead.dividends > 0 ? "positive" : "neutral"}>{formatMoney(lead.dividends)}</strong>
          </div>
        </div>
      </section>

      {parts.length > 0 ? (
        <section className="card" aria-label="Breakdown">
          <h2>Breakdown</h2>
          <div className="compare-list">
            {parts.map((row) => (
              <article key={row.id} className="compare-item">
                <div className="compare-item-head">
                  <h3>{row.label}</h3>
                  <p className={tone(row.difference)}>
                    {formatSignedMoney(row.difference)}
                    {row.percent !== null ? ` ${formatPercent(row.percent)}` : ""}
                  </p>
                </div>
                <div className="compare-meters">
                  <MeterRow label={startLabel} value={row.valueFrom} max={partMax} />
                  <MeterRow label={endLabel} value={row.valueTo} max={partMax} color={seriesColor(row.id)} />
                </div>
                <p className="caption">
                  {`Contributions ${formatMoney(row.contributions)} · Dividends ${formatMoney(row.dividends)}`}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Meter({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
      <span className="meter-track" aria-hidden="true">
        <b style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
    </div>
  );
}

function MeterRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  return (
    <div className="meter-row">
      <span>{label}</span>
      <span className="meter-track" aria-hidden="true">
        <b style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <strong>{formatMoney(value)}</strong>
    </div>
  );
}

function seriesColor(id: string): string {
  return holdings.find((item) => item.id === id)?.color ?? banks.find((item) => item.id === id)?.color ?? "#1c1915";
}

function compactMonth(month: string): string {
  return monthParts(month).full;
}

function monthParts(month: string): { name: string; year: string; full: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  const name = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date);
  return {
    name,
    year: String(year).slice(2),
    full: `${name} ${year}`,
  };
}
