import type { SkipReason } from "../types";

const REASONS: { key: SkipReason; label: string; emoji: string }[] = [
  { key: "tired", label: "Tired", emoji: "😮‍💨" },
  { key: "notime", label: "No time", emoji: "⏳" },
  { key: "notfeeling", label: "Not feeling it", emoji: "🤍" },
  { key: "cameup", label: "Something came up", emoji: "📌" },
];

export function NotNowSheet({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (reason: SkipReason) => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <p className="sheet-title">Not now — what's up?</p>
        <p className="sheet-sub">{title}. I'll find it another home.</p>
        <div className="reason-grid">
          {REASONS.map((r) => (
            <button key={r.key} className="reason" onClick={() => onPick(r.key)}>
              <span className="reason-emoji">{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>
        <button className="sheet-cancel" onClick={onClose}>
          Keep it
        </button>
      </div>
    </div>
  );
}
