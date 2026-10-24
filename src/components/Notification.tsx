import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { useAppStore } from "../state/useAppStore";
export function Notification() {
  const message = useAppStore((s) => s.notification);
  const notify = useAppStore((s) => s.notify);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => notify(""), 4500);
    return () => clearTimeout(timer);
  }, [message, notify]);
  return (
    <div className="notification-region" role="status" aria-live="polite">
      {message && (
        <div className="notification">
          <Check size={17} />
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Dispensar notificação"
            onClick={() => notify("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
