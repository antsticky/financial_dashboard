import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  formatPercent,
  formatSignedMoney,
  tone,
} from "../data/format";
import { banks, holdings } from "../data/portfolio";
import { compareDates, type Scope } from "../data/metrics";

export function DateCompare({
  scope,
  dates,
  rangeDates,
}: {
  scope: Scope;
  dates: string[];
  rangeDates: string[];
}) {
  const months = useMemo(() => [...new Set(dates.map((date) => date.slice(0, 7)))], [dates]);
  const [from, setFrom] = useState(rangeDates[0] ?? "");
  const [to, setTo] = useState(rangeDates.at(-1) ?? "");
  const [editing, setEditing] = useState<"from" | "to">("from");
  const [step, setStep] = useState<"month" | "day">("month");
  const [month, setMonth] = useState<string | null>(null);

  useEffect(() => {
    setFrom(rangeDates[0] ?? "");
    setTo(rangeDates.at(-1) ?? "");
    setEditing("from");
    setStep("month");
    setMonth(null);
  }, [rangeDates]);

  const comparison = compareDates(scope, from, to);
  const lead = comparison.rows.find((row) => row.id === "combined") ?? comparison.rows[0];
  const parts = comparison.rows.filter((row) => row !== lead);
  const partMax = Math.max(...parts.flatMap((row) => [row.valueFrom, row.valueTo]), 1);
  const leadMax = Math.max(lead.valueFrom, lead.valueTo, 1);
  const endLabel = shortDate(comparison.end);
  const days = month ? dates.filter((date) => date.startsWith(month)) : [];
  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);

  function begin(end: "from" | "to") {
    setEditing(end);
    setStep("month");
    setMonth(null);
  }

  function pickMonth(value: string) {
    setMonth(value);
    setStep("day");
  }

  function pickDay(date: string) {
    if (editing === "from") {
      if (date > to) {
        setFrom(to);
        setTo(date);
      } else {
        setFrom(date);
      }
      setEditing("to");
    } else if (date < from) {
      setTo(from);
      setFrom(date);
    } else {
      setTo(date);
    }
    setStep("month");
    setMonth(null);
    if (editing === "to") setEditing("from");
  }

  return (
    <>
      <section className="card" aria-label="Date range">
        <div className="range-ends">
          <button type="button" aria-pressed={editing === "from"} onClick={() => begin("from")}>
            <span>From</span>
            <strong>{shortDate(from)}</strong>
          </button>
          <span className="range-arrow" aria-hidden="true">
            →
          </span>
          <button type="button" aria-pressed={editing === "to"} onClick={() => begin("to")}>
            <span>To</span>
            <strong>{shortDate(to)}</strong>
          </button>
        </div>
        <div className="picker-frame">
          <div className="picker-step">
            <strong>{step === "day" && month ? monthParts(month).full : "\u00a0"}</strong>
            <button
              type="button"
              hidden={step !== "day"}
              onClick={() => begin(editing)}
            >
              Months
            </button>
          </div>
          {step === "month" ? (
            <div className="month-grid" role="group" aria-label="Months">
              {months.map((value) => {
                const point = value === fromMonth && value === toMonth ? "both" : value === fromMonth ? "start" : value === toMonth ? "end" : undefined;
                const partsOfMonth = monthParts(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={value === fromMonth || value === toMonth}
                    aria-label={partsOfMonth.full}
                    data-in-range={value >= fromMonth && value <= toMonth ? "true" : undefined}
                    data-endpoint={point}
                    onClick={() => pickMonth(value)}
                  >
                    {partsOfMonth.name}
                    <small>{partsOfMonth.year}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="day-grid" role="group" aria-label="Days">
              {days.map((date) => {
                const point = date === from && date === to ? "both" : date === from ? "start" : date === to ? "end" : undefined;
                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={date === from || date === to}
                    aria-label={shortDate(date)}
                    data-in-range={date >= from && date <= to ? "true" : undefined}
                    data-endpoint={point}
                    onClick={() => pickDay(date)}
                  >
                    {Number(date.slice(8, 10))}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="card" aria-label="Comparison" aria-live="polite">
        <p className="kicker">{lead.label}</p>
        <p className="hero-value">{formatMoney(lead.valueTo)}</p>
        <p className={`caption ${tone(lead.difference)}`}>
          {`${formatSignedMoney(lead.difference)} ${formatPercent(lead.percent)} ${lead.origin}`}
        </p>
        <div className="compare-pair">
          <Meter label={lead.fromLabel} value={lead.valueFrom} max={leadMax} />
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
                  <MeterRow label={row.fromLabel} value={row.valueFrom} max={partMax} />
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

function shortDate(date: string): string {
  const [year, monthNumber, day] = date.split("-").map(Number);
  if (!year || !monthNumber) return date;
  return new Intl.DateTimeFormat("en", {
    day: day ? "numeric" : undefined,
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, day || 1)));
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
