import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { BalanceChart } from "../components/BalanceChart";
import { CashflowChart } from "../components/CashflowChart";
import { DateCompare } from "../components/DateCompare";
import {
  formatMoney,
  formatPercent,
  formatSignedMoney,
  setFormatCurrency,
  tone,
} from "../data/format";
import { banks, displayCurrencies, type BankId, type HoldingId } from "../data/portfolio";
import {
  basisPhrase,
  basisSentence,
  chartLines,
  dateLabel,
  flowSeries,
  holdingsInScope,
  listDates,
  listMonths,
  setValueRate,
  sliceMonths,
  summarize,
  valueSeries,
  type ChartLine,
  type RangeLength,
  type Scope,
  type ValuePoint,
} from "../data/metrics";

type Tab = "overview" | "banks" | "etfs" | "compare" | "more";

const tabTitle: Record<Tab, string> = {
  overview: "Overview",
  banks: "Banks",
  etfs: "ETFs",
  compare: "Compare",
  more: "More",
};

export function DashboardPage({ onSignOut }: { onSignOut: () => void }) {
  const [bank, setBank] = useState<BankId | "all">("all");
  const [holding, setHolding] = useState<HoldingId | "all">("all");
  const [range, setRange] = useState<RangeLength>(6);
  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [currency, setCurrency] = useState(displayCurrencies[0] ?? "EUR");
  setFormatCurrency(currency);
  setValueRate(currency);
  const scope = useMemo<Scope>(() => ({ bank, holding }), [bank, holding]);
  const allDates = useMemo(() => listDates(), []);
  const dates = useMemo(() => sliceMonths(allDates, range), [allDates, range]);
  const allMonths = useMemo(() => listMonths(), []);
  const rangeMonths = useMemo(() => [...new Set(dates.map((date) => date.slice(0, 7)))], [dates]);
  const summary = useMemo(() => summarize(scope, dates), [scope, dates, currency]);
  const lines = useMemo(() => chartLines(scope), [scope]);
  const values = useMemo(() => valueSeries(scope, dates), [scope, dates, currency]);
  const flows = useMemo(() => flowSeries(scope, dates), [scope, dates, currency]);
  const etfs = holdingsInScope(bank);
  const bankLines = useMemo(
    () => chartLines({ bank, holding: "all" }).filter((line) => line.key !== "total"),
    [bank],
  );
  const bankValues = useMemo(
    () => valueSeries({ bank, holding: "all" }, dates),
    [bank, dates, currency],
  );
  const bankLabel = banks.find((item) => item.id === bank)?.label ?? "All banks";
  const fund = etfs.find((item) => item.id === holding);
  const scopeLine = `${bankLabel} · ${fund ? fund.ticker : "All ETFs"}`;

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function selectBank(next: BankId | "all") {
    setBank(next);
    setHolding((current) =>
      current !== "all" && holdingsInScope(next).some((item) => item.id === current)
        ? current
        : "all",
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="icon-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="option-menu"
          onClick={() => setMenuOpen(true)}
        >
          <IconMenu />
        </button>
        <div className="header-titles">
          <h1>{tabTitle[tab]}</h1>
          <p>{scopeLine}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Sign out" onClick={onSignOut}>
          <IconSignOut />
        </button>
      </header>

      <div className="app-body">
        <div className="stack">
          {tab === "overview" ? (
            <>
              <section className="card value-card" aria-label="Portfolio value">
                <div className="value-top">
                  <p className="kicker">Portfolio value</p>
                  <span className={`delta-pill ${tone(summary.changeAmount)}`}>
                    {formatPercent(summary.changePercent)}
                  </span>
                </div>
                <p className="hero-value">{formatMoney(summary.latestValue)}</p>
                <p className="caption">
                  {formatSignedMoney(summary.changeAmount)} {basisPhrase(summary)}
                </p>
                <BalanceChart lines={lines} points={values} />
                <div className="periods" role="group" aria-label="Range">
                  <button
                    type="button"
                    aria-pressed={range === 6}
                    onClick={() => setRange(6)}
                  >
                    6M
                  </button>
                  <button
                    type="button"
                    aria-pressed={range === 12}
                    onClick={() => setRange(12)}
                  >
                    12M
                  </button>
                </div>
              </section>

              <div className="tile-grid">
                <article className="tile stat-tile">
                  <span className="tile-icon" aria-hidden="true">
                    <IconTrend />
                  </span>
                  <span className="kicker">Performance</span>
                  <strong className={tone(summary.changeAmount)}>
                    {formatSignedMoney(summary.changeAmount)}
                  </strong>
                </article>
                <article className="tile stat-tile">
                  <span className="tile-icon" aria-hidden="true">
                    <IconCoin />
                  </span>
                  <span className="kicker">Dividends</span>
                  <strong className={summary.dividends > 0 ? "positive" : "neutral"}>
                    {formatMoney(summary.dividends)}
                  </strong>
                </article>
              </div>

              <Breakdown lines={lines} points={values} />

              {flows.some((point) => point.contribution !== 0 || point.dividend !== 0) ? (
                <section className="card">
                  <h2>Contributions and dividends</h2>
                  <CashflowChart points={flows} />
                </section>
              ) : null}
            </>
          ) : null}

          {tab === "banks" ? (
            <>
              <p className="page-note">Each account, with every ETF it holds.</p>
              <div className="tile-grid">
                <BankTile
                  wide
                  label="All banks"
                  caption="Combined"
                  color={combinedTone}
                  pressed={bank === "all"}
                  summary={summarize({ bank: "all", holding: "all" }, dates)}
                  onClick={() => selectBank("all")}
                />
                {banks.map((item) => (
                  <BankTile
                    key={item.id}
                    label={item.label}
                    caption="Account"
                    color={item.color}
                    pressed={bank === item.id}
                    summary={summarize({ bank: item.id, holding: "all" }, dates)}
                    onClick={() => selectBank(item.id)}
                  />
                ))}
              </div>
              <section className="card" aria-label="ETF performance">
                <h2>{bankLabel}</h2>
                <p className="caption">
                  {basisSentence(summarize({ bank, holding: "all" }, dates))}
                </p>
                <BalanceChart lines={bankLines} points={bankValues} />
                <div className="periods" role="group" aria-label="Range">
                  <button type="button" aria-pressed={range === 6} onClick={() => setRange(6)}>
                    6M
                  </button>
                  <button type="button" aria-pressed={range === 12} onClick={() => setRange(12)}>
                    12M
                  </button>
                </div>
                <ul className="perf-list">
                  {etfs.map((item) => {
                    const itemSummary = summarize({ bank, holding: item.id }, dates);
                    return (
                      <li key={item.id}>
                        <span className="swatch" style={{ background: item.color }} />
                        <span className="perf-name">
                          <strong>{item.ticker}</strong>
                          <span>{item.name}</span>
                        </span>
                        <span className="perf-figures">
                          <strong>{formatMoney(itemSummary.latestValue)}</strong>
                          <span className={tone(itemSummary.changeAmount)}>
                            {formatSignedMoney(itemSummary.changeAmount)}{" "}
                            {formatPercent(itemSummary.changePercent)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          ) : null}

          {tab === "etfs" ? (
            <>
              <p className="page-note">
                {bankLabel}. The same fund can sit in more than one account.
              </p>
              <div className="tile-grid">
                <button
                  type="button"
                  className="tile color-tile tile-span"
                  style={tileTone(combinedTone)}
                  aria-pressed={holding === "all"}
                  onClick={() => setHolding("all")}
                >
                  <strong>All ETFs</strong>
                  <span className="tile-value">{formatMoney(summarize({ bank, holding: "all" }, dates).latestValue)}</span>
                </button>
                {etfs.map((item) => {
                  const itemSummary = summarize({ bank, holding: item.id }, dates);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="tile color-tile"
                      style={tileTone(item.color)}
                      aria-pressed={holding === item.id}
                      aria-label={`${item.ticker}, ${item.name}`}
                      onClick={() => setHolding(item.id)}
                    >
                      <strong>{item.ticker}</strong>
                      <span className="tile-meta">{item.name}</span>
                      <span className="tile-value">{formatMoney(itemSummary.latestValue)}</span>
                    </button>
                  );
                })}
              </div>
              <section className="card" aria-label="ETF performance">
                <h2>{fund ? fund.ticker : "All ETFs"}</h2>
                <p className="caption">
                  {fund
                    ? `${fund.name}. ${basisSentence(summarize({ bank, holding }, dates))}`
                    : basisSentence(summarize({ bank, holding: "all" }, dates))}
                </p>
                <BalanceChart lines={lines.filter((line) => line.key !== "total")} points={values} />
                <div className="periods" role="group" aria-label="Range">
                  <button type="button" aria-pressed={range === 6} onClick={() => setRange(6)}>
                    6M
                  </button>
                  <button type="button" aria-pressed={range === 12} onClick={() => setRange(12)}>
                    12M
                  </button>
                </div>
                <ul className="perf-list">
                  {lines
                    .filter((line) => line.key !== "total")
                    .map((line) => {
                      const account = banks.find((item) => item.id === line.key);
                      const listed = etfs.find((item) => item.id === line.key);
                      const subtitle = account ? fund?.name : listed?.name;
                      const itemSummary = summarize(performanceScope(bank, holding, line.key), dates);
                      return (
                        <li key={line.key}>
                          <span className="swatch" style={{ background: line.color }} />
                          <span className="perf-name">
                            <strong>{account?.label ?? listed?.ticker ?? line.label}</strong>
                            {subtitle ? <span>{subtitle}</span> : null}
                          </span>
                          <span className="perf-figures">
                            <strong>{formatMoney(itemSummary.latestValue)}</strong>
                            <span className={tone(itemSummary.changeAmount)}>
                              {formatSignedMoney(itemSummary.changeAmount)}{" "}
                              {formatPercent(itemSummary.changePercent)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </section>
            </>
          ) : null}

          {tab === "compare" ? (
            <DateCompare scope={scope} allMonths={allMonths} rangeMonths={rangeMonths} />
          ) : null}

          {tab === "more" ? (
            <>
              <section className="card more-card">
                <p className="kicker">Currency</p>
                <p className="more-scope">{currency}</p>
                <div className="periods currency-choice" role="group" aria-label="Currency">
                  {displayCurrencies.map((code) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={currency === code}
                      onClick={() => setCurrency(code)}
                    >
                      {code}
                    </button>
                  ))}
                </div>
                <p className="caption">
                  {formatMoney(summary.latestValue)} on {dateLabel(summary.latestMonth)}
                </p>
              </section>
              <div className="tile-grid">
                <button type="button" className="tile" onClick={() => setMenuOpen(true)}>
                  <span className="tile-icon" aria-hidden="true">
                    <IconGrid />
                  </span>
                  <strong>Select any option</strong>
                  <span className="tile-meta">Banks and ETFs</span>
                </button>
                <button type="button" className="tile" onClick={onSignOut}>
                  <span className="tile-icon" aria-hidden="true">
                    <IconSignOut />
                  </span>
                  <strong>Sign out</strong>
                  <span className="tile-meta">Leave this dashboard</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <nav className="tabbar" aria-label="Sections">
        <TabButton id="overview" current={tab} icon={<IconHome />} label="Overview" onSelect={setTab} />
        <TabButton id="banks" current={tab} icon={<IconBank />} label="Banks" onSelect={setTab} />
        <TabButton id="etfs" current={tab} icon={<IconTrend />} label="ETFs" onSelect={setTab} />
        <TabButton id="compare" current={tab} icon={<IconCompare />} label="Compare" onSelect={setTab} />
        <TabButton id="more" current={tab} icon={<IconMore />} label="More" onSelect={setTab} />
      </nav>

      {menuOpen ? (
        <div className="menu-layer" id="option-menu" role="dialog" aria-modal="true" aria-label="Select any option">
          <div className="menu-scroll">
            <h2 className="menu-title">Select any option</h2>
            <p className="section-label">Banks</p>
            <div className="tile-grid">
              <button
                type="button"
                className="tile color-tile tile-span"
                style={tileTone(combinedTone)}
                aria-pressed={bank === "all"}
                onClick={() => selectBank("all")}
              >
                <strong>All banks</strong>
              </button>
              {banks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="tile color-tile"
                  style={tileTone(item.color)}
                  aria-pressed={bank === item.id}
                  onClick={() => selectBank(item.id)}
                >
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            <p className="section-label">ETFs</p>
            <div className="tile-grid">
              <button
                type="button"
                className="tile color-tile tile-span"
                style={tileTone(combinedTone)}
                aria-pressed={holding === "all"}
                onClick={() => setHolding("all")}
              >
                <strong>All ETFs</strong>
              </button>
              {holdingsInScope(bank).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="tile color-tile"
                  style={tileTone(item.color)}
                  aria-pressed={holding === item.id}
                  aria-label={`${item.ticker}, ${item.name}`}
                  onClick={() => setHolding(item.id)}
                >
                  <strong>{item.ticker}</strong>
                  <span className="tile-meta">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="continue" onClick={() => setMenuOpen(false)}>
            Continue
          </button>
        </div>
      ) : null}
    </main>
  );
}

const combinedTone = "#8a8176";

function performanceScope(
  bank: BankId | "all",
  holding: HoldingId | "all",
  lineKey: string,
): Scope {
  if (holding === "all") return { bank, holding: lineKey as HoldingId };
  if (banks.some((item) => item.id === lineKey)) return { bank: lineKey, holding };
  return { bank, holding };
}

function tileTone(color: string): CSSProperties {
  return { "--tile": color } as CSSProperties;
}

function BankTile({
  label,
  caption,
  color,
  pressed,
  summary,
  onClick,
  wide = false,
}: {
  label: string;
  caption: string;
  color: string;
  pressed: boolean;
  summary: { latestValue: number; changeAmount: number; changePercent: number | null };
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={wide ? "tile color-tile tile-span" : "tile color-tile"}
      style={tileTone(color)}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <strong>{label}</strong>
      <span className="tile-meta">{caption}</span>
      <span className="tile-value">{formatMoney(summary.latestValue)}</span>
      <span className={`tile-change ${tone(summary.changeAmount)}`}>
        {formatPercent(summary.changePercent)}
      </span>
    </button>
  );
}

function Breakdown({ lines, points }: { lines: ChartLine[]; points: ValuePoint[] }) {
  const last = points[points.length - 1];
  const parts = lines.filter((line) => line.key !== "total");
  if (!last || parts.length < 2) return null;
  const rows = parts.flatMap((line) => {
    const value = last[line.key];
    return typeof value === "number" ? [{ ...line, value }] : [];
  });
  if (rows.length < 2) return null;
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <p className="section-label">Breakdown</p>
      <section className="card" aria-label="Breakdown">
        <ul className="rows">
          {rows.map((row) => (
            <li key={row.key}>
              <span className="avatar" style={{ background: row.color }}>
                {row.label.slice(0, 1)}
              </span>
              <div className="row-copy">
                <div className="row-top">
                  <strong>{row.label}</strong>
                  <span>{formatMoney(row.value)}</span>
                </div>
                <div className="bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${total === 0 ? 0 : (row.value / total) * 100}%`,
                      background: row.color,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function TabButton({
  id,
  current,
  icon,
  label,
  onSelect,
}: {
  id: Tab;
  current: Tab;
  icon: ReactNode;
  label: string;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <button type="button" aria-current={current === id ? "page" : undefined} onClick={() => onSelect(id)}>
      {icon}
      {label}
    </button>
  );
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 6V5a1 1 0 0 1 1-1h8v16h-8a1 1 0 0 1-1-1v-1M4 12h11M12 8l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBank() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 10h16M6 10v7M10 10v7M14 10v7M18 10v7M4 17h16M12 4 4 9h16L12 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 16l5-5 3.5 3.5L20 7M14 7h6v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCompare() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 4v16M17 4v16M4 8h6M14 16h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7h14M5 12h14M5 17h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCoin() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
