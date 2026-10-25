import { useState, useRef, type ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Minus,
  Square,
  X,
  Triangle,
  Monitor,
} from "lucide-react";
import { useAppStore } from "../state/useAppStore";
import { navigation } from "../app/navigation";
import { controlWindow, nativeWindowAvailable } from "../integrations/window";
import { Tooltip } from "radix-ui";
import { Tip } from "../ui/Tooltip";
import { GlobalSearch } from "./GlobalSearch";
import { Notification } from "./Notification";
import { useCompactLayout } from "../ui/useCompactLayout";
export function Layout({ children }: { children: ReactNode }) {
  const { page, navigate, collapsed, toggleSidebar, demo } = useAppStore();
  const [error, setError] = useState("");
  const compact = useCompactLayout();
  const [compactExpanded, setCompactExpanded] = useState(false);
  const menuCollapsed = compact ? !compactExpanded : collapsed;
  function toggleMenu() {
    if (compact) setCompactExpanded((value) => !value);
    else toggleSidebar();
  }
  const navRef = useRef<HTMLElement>(null);
  async function windowAction(action: "minimize" | "maximize" | "close") {
    try {
      await controlWindow(action);
    } catch {
      setError("Não foi possível controlar a janela.");
    }
  }
  return (
    <Tooltip.Provider delayDuration={350}>
      <div className={`app-shell ${menuCollapsed ? "sidebar-collapsed" : ""}`}>
        <a className="skip-link" href="#main-content">
          Ir para o conteúdo
        </a>
        <header className="titlebar">
          <div className="brand">
            <span className="brand-symbol">
              <Triangle size={18} fill="currentColor" />
            </span>
            <span>
              NOVA <b>PLAYER</b>
            </span>
          </div>
          <GlobalSearch />
          <button
            className="icon-button"
            aria-label="Abrir configurações"
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
          </button>
          <div className="window-controls" aria-label="Controles da janela">
            {(
              [
                { id: "minimize", label: "Minimizar", icon: Minus },
                {
                  id: "maximize",
                  label: "Maximizar ou restaurar",
                  icon: Square,
                },
                { id: "close", label: "Fechar janela", icon: X },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                disabled={!nativeWindowAvailable}
                title={
                  nativeWindowAvailable
                    ? label
                    : "Disponível no aplicativo Windows"
                }
                aria-label={label}
                onClick={() => void windowAction(id)}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </header>
        <aside className="sidebar">
          <div className="sidebar-label">
            <span>EXPLORAR</span>
            <button
              className="icon-button"
              aria-label={menuCollapsed ? "Expandir menu" : "Recolher menu"}
              aria-expanded={!menuCollapsed}
              onClick={toggleMenu}
            >
              {menuCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
          </div>
          <nav
            aria-label="Navegação principal"
            ref={navRef}
            onKeyDown={(e) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
                return;
              const buttons = Array.from(
                navRef.current?.querySelectorAll<HTMLButtonElement>("button") ??
                  [],
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (index < 0) return;
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? buttons.length - 1
                    : e.key === "ArrowDown"
                      ? (index + 1) % buttons.length
                      : (index - 1 + buttons.length) % buttons.length;
              buttons[next]?.focus();
            }}
          >
            {navigation.map(({ id, label, icon: Icon }, i) => (
              <Tip key={id} label={label} enabled={menuCollapsed}>
                <button
                  className={`nav-item ${page === id ? "active" : ""} ${i === 4 ? "nav-divider" : ""}`}
                  aria-current={page === id ? "page" : undefined}
                  aria-label={label}
                  onClick={() => {
                    navigate(id);
                    if (compact) setCompactExpanded(false);
                  }}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </button>
              </Tip>
            ))}
          </nav>
          <div className="sidebar-footer">
            <Monitor size={18} />
            <div>
              <strong>Seu espaço. Seu conteúdo.</strong>
              <p>Windows · Fundação 0.1</p>
            </div>
          </div>
        </aside>
        <main id="main-content" tabIndex={-1}>
          <div className="mode-strip">
            <span>
              <span className="status-dot" />
              {demo
                ? "AMBIENTE DEMONSTRATIVO"
                : "CATÁLOGO REAL · RECURSOS NATIVOS"}
            </span>
            <span>
              {demo
                ? "Conteúdos fictícios · Sem reprodução"
                : "Fontes do usuário · Player Windows"}
            </span>
          </div>
          {error && <p role="alert">{error}</p>}
          {children}
          <footer className="content-footer">
            NOVA PLAYER <span>Uma nova forma de explorar.</span>
            <span>Seu conteúdo. Sua experiência.</span>
          </footer>
        </main>
        <Notification />
      </div>
    </Tooltip.Provider>
  );
}
