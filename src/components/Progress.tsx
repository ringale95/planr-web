import { useState } from "react";
import type { Store } from "../store";
import type { ReviewAnswer } from "../types";
import { DIMENSIONS, leetcodeProjection } from "../engine/score";
import { daysUntil } from "../engine/dates";
import { getClientId, setClientId, connect, isConnected } from "../gcal";
import { apiBase, setApiBase, health, lastSyncedAt } from "../sync";

const PATTERNS = [
  "Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack", "Binary Search",
  "Linked List", "Trees", "Tries", "Heap", "Backtracking", "Graphs",
  "Adv. Graphs", "1-D DP", "2-D DP", "Intervals / Greedy",
];

export function Progress({ store }: { store: Store }) {
  const { state } = store;
  const days = daysUntil(state.goalDeadline);
  const weeks = Math.floor(days / 7);
  const proj = leetcodeProjection(state);
  const lc = state.leetcode;
  const lcTotal = lc.easy + lc.medium + lc.hard;
  const weight = state.weightLog[state.weightLog.length - 1]?.kg ?? 58;
  const weightPct = Math.min(100, Math.max(0, ((58 - weight) / (58 - 54)) * 100));

  return (
    <div className="goals">
      <h2 className="view-title">The road to Feb 2027</h2>

      <div className="countdown">
        <div className="cd-num">{days}</div>
        <div className="cd-label">days left · <b>{weeks} weeks</b> to the offer</div>
      </div>

      {/* LeetCode */}
      <section className="goal-card">
        <div className="goal-head"><span>LeetCode</span><span>{lcTotal}/300</span></div>
        <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, (lcTotal / 300) * 100)}%` }} /></div>
        <div className="lc-split">
          <span className="easy">E {lc.easy}</span>
          <span className="medium">M {lc.medium}</span>
          <span className="hard">H {lc.hard}</span>
        </div>
        <div className={`pace rag-${proj.rag}`}>
          ~{proj.perWeekNeeded}/week to hit 300 by Feb · {proj.rag === "green" ? "on pace" : proj.rag === "amber" ? "push a bit" : "behind pace"}
        </div>
      </section>

      {/* Weight */}
      <section className="goal-card">
        <div className="goal-head"><span>Weight → 54kg</span><span>{weight}kg</span></div>
        <div className="bar"><div className="bar-fill warm" style={{ width: `${weightPct}%` }} /></div>
        <WeightLogger store={store} />
      </section>

      {/* Pattern coverage */}
      <section className="goal-card">
        <div className="goal-head"><span>DSA pattern coverage</span></div>
        <div className="patterns">
          {PATTERNS.map((p) => {
            const n = state.patterns[p] ?? 0;
            return (
              <span key={p} className={`pat ${n === 0 ? "weak" : n < 5 ? "thin" : "solid"}`}>
                {p} <b>{n}</b>
              </span>
            );
          })}
        </div>
      </section>

      <WeeklyCheckin store={store} />

      <HomeSync />
      <GoogleCalendar />
    </div>
  );
}

function HomeSync() {
  const [base, setBase] = useState(apiBase());
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [info, setInfo] = useState("");

  const test = async () => {
    setApiBase(base);
    setStatus("checking");
    const h = await health();
    if (h?.ok) {
      setStatus("ok");
      setInfo(h.updatedAt ? `Last synced ${new Date(h.updatedAt).toLocaleString()}` : "Connected — no data yet");
    } else {
      setStatus("fail");
    }
  };

  return (
    <section className="goal-card">
      <div className="goal-head"><span>Home sync</span></div>
      <p className="gcal-sub">
        Syncs your data to the Planr backend on your laptop when you're on the same Wi-Fi.
        Leave the address blank to turn sync off.
      </p>
      <input className="gcal-input" placeholder="https://10.0.0.151:8443" value={base} onChange={(e) => setBase(e.target.value)} />
      <button className="btn primary wide" disabled={status === "checking"} onClick={test}>
        {status === "checking" ? "Checking…" : "Test connection"}
      </button>
      <p className="gcal-sub" style={{ marginTop: 10 }}>
        {lastSyncedAt() ? `Last pushed to backend: ${new Date(lastSyncedAt()).toLocaleString()}` : "Not synced yet this device."}
      </p>
      {status === "ok" && <p className="gcal-ok">Reachable ✓ {info}</p>}
      {status === "fail" && (
        <p className="gcal-fail">
          Can't reach it. On the same Wi-Fi? Started the backend? And visit the address once in this browser to trust its certificate.
        </p>
      )}
    </section>
  );
}

function GoogleCalendar() {
  const [cid, setCid] = useState(getClientId());
  const [status, setStatus] = useState<"idle" | "connecting" | "ok" | "fail">(
    isConnected() ? "ok" : "idle"
  );

  const onConnect = async () => {
    setClientId(cid);
    setStatus("connecting");
    try {
      const ok = await connect();
      setStatus(ok ? "ok" : "fail");
    } catch {
      setStatus("fail");
    }
  };

  return (
    <section className="goal-card gcal">
      <div className="goal-head"><span>Google Calendar</span></div>
      <p className="gcal-sub">
        Connect once to mirror appointments you add into your Google Calendar.
        Paste your OAuth client ID (setup steps are in the README).
      </p>
      <input
        className="gcal-input"
        placeholder="xxxx.apps.googleusercontent.com"
        value={cid}
        onChange={(e) => setCid(e.target.value)}
      />
      <button className="btn primary wide" disabled={!cid || status === "connecting"} onClick={onConnect}>
        {status === "ok" ? "Connected ✓ — reconnect" : status === "connecting" ? "Connecting…" : "Connect Google Calendar"}
      </button>
      {status === "fail" && <p className="gcal-fail">Couldn't connect — check the client ID and authorized origin.</p>}
      {status === "ok" && <p className="gcal-ok">Connected. New appointments will sync to Google Calendar.</p>}
    </section>
  );
}

function WeightLogger({ store }: { store: Store }) {
  const [kg, setKg] = useState("");
  return (
    <div className="weight-log">
      <input type="number" step="0.1" placeholder="log today's weight" value={kg} onChange={(e) => setKg(e.target.value)} />
      <button className="btn primary" disabled={!kg} onClick={() => { store.logWeight(Number(kg)); setKg(""); }}>
        Log
      </button>
    </div>
  );
}

function WeeklyCheckin({ store }: { store: Store }) {
  const existing = store.state.reviews[store.state.weekStart]?.answers ?? {};
  const [answers, setAnswers] = useState<Record<string, ReviewAnswer>>(existing);

  return (
    <section className="checkin">
      <h3>Sunday check-in</h3>
      <p className="checkin-sub">Honest gut answers — this drives your on-track score.</p>
      {DIMENSIONS.map((d) => (
        <div key={d.key} className="qrow">
          <p className="q">{d.question}</p>
          <div className="opts">
            {(["yes", "partly", "no"] as const).map((a) => (
              <button
                key={a}
                className={answers[d.key] === a ? `opt active ${a}` : "opt"}
                onClick={() => setAnswers((s) => ({ ...s, [d.key]: a }))}
              >
                {a === "yes" ? "Yes" : a === "partly" ? "Partly" : "No"}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button className="btn primary wide" onClick={() => store.saveReview(answers)}>
        Save check-in
      </button>
    </section>
  );
}
