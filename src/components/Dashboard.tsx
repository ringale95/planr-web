import { useState } from "react";
import type { Store } from "../store";
import type { ScheduledBlock, SkipReason } from "../types";
import { computeScore } from "../engine/score";
import { todayYmd, nowMinutes, minutes, DAY_FULL, parseYmd, energyLevel } from "../engine/dates";
import { NotNowSheet } from "./NotNowSheet";

export const TYPE_EMOJI: Record<string, string> = {
  DSA: "🧠", LeetCode: "💻", Class: "🎓", Work: "💼",
  Gym: "🏋️", Walk: "🚶", Painting: "🎨", Reading: "📖",
  Social: "🥂", Cook: "🍳", Clean: "🧹", Errand: "🛒",
  Appointment: "📌", Rest: "🌙",
};

export function Dashboard({ store, viewedDate }: { store: Store; viewedDate: string }) {
  const { state } = store;
  const score = computeScore(state);
  const isToday = viewedDate === todayYmd();
  const now = nowMinutes();

  const day = store.blocksByDate(viewedDate);
  const nowBlock = isToday
    ? day.find((b) => minutes(b.startTime) <= now && now < minutes(b.startTime) + b.durationMin) ?? null
    : null;
  const nextBlock = isToday
    ? day.find((b) => minutes(b.startTime) > now && b.status === "planned") ?? null
    : null;
  const hero = nowBlock ?? nextBlock;
  const rest = day.filter((b) => b.id !== hero?.id);

  const [sheetFor, setSheetFor] = useState<ScheduledBlock | null>(null);

  const onSkip = (reason: SkipReason) => {
    if (sheetFor) store.skip(sheetFor.id, reason);
    setSheetFor(null);
  };

  return (
    <div className="dash">
      {/* On-track score */}
      <section className="track">
        <p className="track-q">Are you on track to your goals?</p>
        <div className="bar">
          <div className={`bar-fill band-${score.band.replace(/\s/g, "")}`} style={{ width: `${score.score}%` }} />
        </div>
        <div className="track-meta">
          <span className="band">{score.band}</span>
          <span className="score-num">{score.score}%</span>
        </div>
        <div className="factors">
          {score.factors.map((f) => (
            <span key={f.key} className={`factor sym-${f.symbol === "✓" ? "ok" : f.symbol === "◑" ? "mid" : "low"}`}>
              <b>{f.symbol}</b> {f.label}
            </span>
          ))}
        </div>
      </section>

      {/* Coaching line */}
      {isToday && score.coachState === "nudge" && (
        <div className="coach nudge">
          Your future needs you. <b>{score.coachFocus}</b> is slipping — give it time today before anything else.
        </div>
      )}
      {isToday && score.coachState === "reward" && (
        <div className="coach reward">
          You're ahead on the things that matter. Go enjoy something — guilt-free. You earned it. ✦
        </div>
      )}

      {/* Hero: now / up next */}
      {hero ? (
        <HeroCard block={hero} now={nowBlock?.id === hero.id} store={store} onNotNow={() => setSheetFor(hero)} />
      ) : (
        <div className="empty-hero">
          {isToday ? "Nothing scheduled right now — breathe. 🌿" : `Plan for ${DAY_FULL[parseYmd(viewedDate).getDay()]}`}
        </div>
      )}

      {/* Rest of the day */}
      {rest.length > 0 && (
        <section className="rest">
          <h3>{isToday ? "Later today" : "The day"}</h3>
          {rest.map((b) => (
            <RowCard key={b.id} block={b} store={store} onNotNow={() => setSheetFor(b)} />
          ))}
        </section>
      )}

      {isToday && <DayTools store={store} />}

      {sheetFor && (
        <NotNowSheet title={sheetFor.title} onPick={onSkip} onClose={() => setSheetFor(null)} />
      )}
    </div>
  );
}

function Actions({ block, store, onNotNow }: { block: ScheduledBlock; store: Store; onNotNow: () => void }) {
  if (block.status === "done") return <div className="done-chip">✓ Done</div>;
  return (
    <div className="actions">
      <button className="btn primary" onClick={() => store.complete(block.id)}>
        Complete
      </button>
      <button className="btn ghost" onClick={onNotNow}>
        Not now
      </button>
    </div>
  );
}

function LeetLog({ store }: { store: Store }) {
  const [pattern, setPattern] = useState("");
  return (
    <div className="leetlog">
      <span>Log a solve:</span>
      {(["easy", "medium", "hard"] as const).map((d) => (
        <button key={d} className={`leet ${d}`} onClick={() => store.logLeetcode(d, pattern || undefined)}>
          {d[0].toUpperCase()}
        </button>
      ))}
      <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
        <option value="">pattern…</option>
        {PATTERNS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}

function HeroCard({ block, now, store, onNotNow }: { block: ScheduledBlock; now: boolean; store: Store; onNotNow: () => void }) {
  const isDSA = block.type === "DSA" || block.type === "LeetCode";
  return (
    <section className={`hero-card ${now ? "is-now breathe" : "is-next"} tier-${block.tier}`}>
      <div className="hero-label">{now ? "NOW" : "UP NEXT"} · {block.startTime}</div>
      <div className="hero-title">
        <span className="emoji">{TYPE_EMOJI[block.type]}</span> {block.title}
      </div>
      <div className="hero-sub">
        {block.durationMin} min
        {block.commitment === "must" && <span className="lock">🔒 non-negotiable</span>}
      </div>
      <Actions block={block} store={store} onNotNow={onNotNow} />
      {isDSA && block.status !== "done" && <LeetLog store={store} />}
    </section>
  );
}

function RowCard({ block, store, onNotNow }: { block: ScheduledBlock; store: Store; onNotNow: () => void }) {
  return (
    <div className={`row tier-${block.tier} ${block.status}`}>
      <span className="row-time">{block.startTime}</span>
      <span className="row-title">
        {TYPE_EMOJI[block.type]} {block.title}
        {block.commitment === "must" && <span className="dot-lock">🔒</span>}
      </span>
      <Actions block={block} store={store} onNotNow={onNotNow} />
    </div>
  );
}

function DayTools({ store }: { store: Store }) {
  const [open, setOpen] = useState<"none" | "appt">("none");
  const [title, setTitle] = useState("");
  const today = todayYmd();
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("12:00");
  const [dur, setDur] = useState(60);
  const energy = energyLevel(store.state.energyByDate[today]);

  return (
    <section className="tools">
      <div className="energy">
        <span>How's your energy?</span>
        <div className="energy-opts">
          {(["full", "low", "exhausted"] as const).map((e) => (
            <button key={e} className={energy === e ? "active" : ""} onClick={() => store.setEnergy(today, e)}>
              {e === "full" ? "Full" : e === "low" ? "Low" : "Exhausted"}
            </button>
          ))}
        </div>
      </div>

      {open === "appt" ? (
        <div className="appt-form">
          <input placeholder="Appointment title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          <div className="appt-row">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <input type="number" min={15} step={15} value={dur} onChange={(e) => setDur(Number(e.target.value))} />
            <button
              className="btn primary"
              onClick={() => {
                if (title.trim()) {
                  store.addAppt(title.trim(), date, time, dur);
                  setTitle("");
                  setDate(today);
                  setOpen("none");
                }
              }}
            >
              Add
            </button>
          </div>
          <button className="link" onClick={() => setOpen("none")}>cancel</button>
        </div>
      ) : (
        <button className="add-appt" onClick={() => setOpen("appt")}>
          + Add an appointment
        </button>
      )}
    </section>
  );
}

const PATTERNS = [
  "Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack", "Binary Search",
  "Linked List", "Trees", "Tries", "Heap", "Backtracking", "Graphs",
  "Adv. Graphs", "1-D DP", "2-D DP", "Intervals / Greedy",
];
