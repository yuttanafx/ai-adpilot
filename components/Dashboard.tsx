"use client";

import { useState } from "react";
import TrendChart from "./TrendChart";
import {
  APPROVAL_QUEUE,
  BASE_SALES,
  BASE_SPEND,
  CAMPAIGNS,
  CREATIVES,
  DECISION_LOG,
  NOTIFICATIONS,
  PLATFORMS,
  PLATFORM_DATA,
  type Platform,
} from "@/lib/data";

type QueueState = "pending" | "approved" | "editing";

const baht = (n: number) => "฿" + Math.round(n).toLocaleString("en-US");
const grad = (a: string, b: string) => ({ background: `linear-gradient(135deg, ${a}, ${b})` });

function qualityColor(q: number) {
  return q >= 70 ? "#3ddc84" : q >= 45 ? "#ffb830" : "#ff6b6b";
}

export default function Dashboard() {
  const [platform, setPlatform] = useState<Platform>("all");
  const [aiOn, setAiOn] = useState(true);
  const [stopped, setStopped] = useState(false);
  const [queue, setQueue] = useState<Record<string, QueueState>>({});

  const d = PLATFORM_DATA[platform];
  const spend = BASE_SPEND.map((v) => v * d.shareSpend);
  const sales = BASE_SALES.map((v) => v * d.shareSales);
  const campaigns = CAMPAIGNS.filter((c) => platform === "all" || c.platform === platform);

  const active = aiOn && !stopped;
  const statusText = stopped ? "STOPPED" : aiOn ? "ACTIVE" : "OFF";
  const statusClass = active ? "on" : stopped ? "stopped" : "off";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <path d="M3 27L14 3l5 11" stroke="#4c8dff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 27l8-14 8 14" stroke="#7fe0a8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          AI AD PILOT
        </div>
        <nav className="nav" aria-label="Main">
          <a href="#dashboard" aria-current="page">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
            Dashboard
          </a>
          <a href="#rules">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
            Rules
          </a>
          <a href="#creatives">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></svg>
            Creatives
          </a>
          <a href="#accounts">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.7.7 2.8 2.3 3 5.2" /></svg>
            Accounts
          </a>
          <a href="#settings">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
            Settings
          </a>
        </nav>
      </aside>

      <main id="dashboard" className="main">
        <header className="topbar">
          <label>
            <span className="sr-only">Date range</span>
            <select className="select" defaultValue="7">
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Compare to</span>
            <select className="select" defaultValue="prev">
              <option value="prev">vs previous 7 Days</option>
              <option value="month">vs previous month</option>
            </select>
          </label>
          <div className="chips" role="group" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={platform === p.id} onClick={() => setPlatform(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <div className="status">
            <span>AI STATUS: <b className={statusClass}>{statusText}</b></span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="AI autopilot"
              className="switch"
              onClick={() => { setAiOn(!aiOn); setStopped(false); }}
            >
              <span />
            </button>
          </div>
          <button
            type="button"
            className={stopped ? "stop resume" : "stop"}
            onClick={() => { setStopped(!stopped); if (stopped) setAiOn(true); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {stopped ? "Resume" : "Emergency stop"}
          </button>
        </header>

        {stopped && (
          <div role="status" className="banner">
            Emergency stop is on. The AI has paused every budget change, bid change and ad launch. Press Resume to hand control back.
          </div>
        )}

        <section aria-label="Key metrics" className="kpis">
          {d.kpis.map((k) => (
            <div key={k.label} className="kpi">
              <div className="kpi-head">
                <span className="kpi-label">{k.label}</span>
                <span className={"delta " + (k.good ? "good" : "bad")}>
                  {k.delta >= 0 ? "▲ +" : "▼ "}{k.delta}%
                </span>
              </div>
              <div className="kpi-value">{k.value}</div>
            </div>
          ))}
        </section>

        <section aria-label="Trend graph" className="panel">
          <div className="chart-head">
            <h2>TREND GRAPH</h2>
            <span className="legend"><i style={{ background: "#4c8dff" }} />Spend (฿)</span>
            <span className="legend"><i style={{ background: "#3ddc84" }} />Sales (฿)</span>
          </div>
          <TrendChart spend={spend} sales={sales} />
        </section>

        <section id="rules" aria-label="Campaign performance" className="panel">
          <h2>CAMPAIGN PERFORMANCE TABLE</h2>
          <div className="scroll">
            <table style={{ minWidth: 640 }}>
              <thead>
                <tr><th>Name</th><th>Status</th><th>Budget / day</th><th>Results</th><th>ROAS</th><th>Quality</th></tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.name}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td><span className={"pill " + c.status}>{c.status}</span></td>
                    <td>{baht(c.budget)}</td>
                    <td>{c.results} sales</td>
                    <td style={{ fontWeight: 600, color: qualityColor(c.quality) }}>{c.roas.toFixed(2)}</td>
                    <td>
                      <div className="bar" role="img" aria-label={`Quality ${c.quality} out of 100`}>
                        <div style={{ width: c.quality + "%", background: qualityColor(c.quality) }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="creatives" aria-label="Creative winners and losers" className="panel">
          <h2>CREATIVE WINNERS &amp; LOSERS</h2>
          <div className="cards">
            {CREATIVES.map((c) => (
              <div key={c.name} className="card">
                <div className="thumb" style={grad(c.from, c.to)} aria-hidden="true">{c.initial}</div>
                <div className="card-body">
                  <span className="card-title">{c.name}</span>
                  <span className="card-note">{c.note}</span>
                  <div className="wl"><span className="w">{c.winners} Winners</span><span className="l">{c.losers} Losers</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="AI decision log" className="panel">
          <h2>AI DECISION LOG</h2>
          <div className="scroll">
            <table style={{ minWidth: 560 }}>
              <thead><tr><th>Date</th><th>Action</th><th>Reason</th></tr></thead>
              <tbody>
                {DECISION_LOG.map((l) => (
                  <tr key={l.date}>
                    <td style={{ whiteSpace: "nowrap" }}>{l.date}</td>
                    <td>{l.action}</td>
                    <td style={{ color: "#c4cada" }}>{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="split">
          <section aria-label="Ad approval queue" className="panel queue">
            <h2>AD APPROVAL QUEUE</h2>
            <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {APPROVAL_QUEUE.map((q) => {
                const s = queue[q.id] ?? "pending";
                return (
                  <div key={q.id} className="card col">
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div className="thumb" style={grad(q.from, q.to)} aria-hidden="true">{q.initial}</div>
                      <div className="card-body">
                        <span className="card-title">{q.title}</span>
                        <span className={"state " + s}>{s === "approved" ? "Approved" : s === "editing" ? "In edit" : "Pending review"}</span>
                      </div>
                    </div>
                    <div className="row">
                      <button type="button" className="btn approve" onClick={() => setQueue({ ...queue, [q.id]: "approved" })}>Approve</button>
                      <button type="button" className="btn edit" onClick={() => setQueue({ ...queue, [q.id]: "editing" })}>Edit</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-label="Notifications" className="panel notes">
            <h2>NOTIFICATIONS</h2>
            <ul className="list">
              {NOTIFICATIONS.map((n) => (
                <li key={n.text}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d="M12 3L2 21h20L12 3z" /><path d="M12 10v5M12 18v.01" /></svg>
                  <span className="t">{n.text}</span>
                  <span className="time">{n.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
