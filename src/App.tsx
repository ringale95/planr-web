import { useState } from "react";
import { useStore } from "./store";
import { Dashboard } from "./components/Dashboard";
import { Week } from "./components/Week";
import { Progress } from "./components/Progress";
import { prettyDate, todayYmd, addDays } from "./engine/dates";

type Tab = "home" | "week" | "progress";

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [viewedDate, setViewedDate] = useState<string>(todayYmd());

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="star">✦</span> Planr
        </div>
        {tab === "home" && (
          <div className="datenav">
            <button aria-label="Previous day" onClick={() => setViewedDate((d) => addDays(d, -1))}>
              ‹
            </button>
            <span className="date" onClick={() => setViewedDate(todayYmd())}>
              {prettyDate(viewedDate)}
            </span>
            <button aria-label="Next day" onClick={() => setViewedDate((d) => addDays(d, 1))}>
              ›
            </button>
          </div>
        )}
      </header>

      <main className="content">
        {tab === "home" && <Dashboard store={store} viewedDate={viewedDate} />}
        {tab === "week" && <Week store={store} />}
        {tab === "progress" && <Progress store={store} />}
      </main>

      {store.toast && <div className="toast">{store.toast}</div>}

      <nav className="tabbar">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>
          <span>◎</span>Today
        </button>
        <button className={tab === "week" ? "active" : ""} onClick={() => setTab("week")}>
          <span>▦</span>Week
        </button>
        <button className={tab === "progress" ? "active" : ""} onClick={() => setTab("progress")}>
          <span>↗</span>Goals
        </button>
      </nav>
    </div>
  );
}
