import { useState } from "react";
import type { Store } from "../store";
import type { ReviewAnswer } from "../types";
import { DIMENSIONS, leetcodeProjection } from "../engine/score";
import { daysUntil } from "../engine/dates";

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
    </div>
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
