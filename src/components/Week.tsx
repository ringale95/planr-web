import type { Store } from "../store";
import { TYPE_EMOJI } from "./Dashboard";
import { capacityCheck } from "../engine/scheduler";
import { addDays, DAY_NAMES, todayYmd } from "../engine/dates";

export function Week({ store }: { store: Store }) {
  const { state } = store;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
  const today = todayYmd();
  const warnings = capacityCheck(Object.values(state.blocks), state.weekStart);

  return (
    <div className="weekview">
      <h2 className="view-title">This week</h2>
      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i} className="warn">⚠ {w.message}</div>
          ))}
        </div>
      )}
      <div className="week-grid">
        {dates.map((date, i) => {
          const blocks = Object.values(state.blocks)
            .filter((b) => b.date === date && b.status !== "moved")
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={date} className={`wcol ${date === today ? "today" : ""}`}>
              <div className="wday">{DAY_NAMES[i]}</div>
              {blocks.map((b) => (
                <div key={b.id} className={`wblock tier-${b.tier} ${b.status}`} title={b.title}>
                  <span className="wt">{b.startTime}</span>
                  <span className="wl">{TYPE_EMOJI[b.type]} {b.title}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
