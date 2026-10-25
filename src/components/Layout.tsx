import { CatalogSidebar } from "./native/CatalogSidebar";
import type { PageId } from "../domain/types";
import { useMediaNavigation } from "../state/useMediaNavigation";
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
  Bookmark,
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
  const [mainMenuFor, setMainMenuFor] = useState<PageId | null>(null);
  const context =
    !demo && mainMenuFor !== page && (page === "movies" || page === "series")
      ? page === "movies"
        ? "movie"
        : "series"
      : null;
  const compact = useCompactLayout();
  const [compactExpanded, setCompactExpanded] = useState(false);
  const menuCollapsed = compact ? !compactExpanded : collapsed;
  function toggleMenu() {
    if (compact) setCompactExpanded((value) => !value);
    else toggleSidebar();
  }
  const navItems = demo
    ? navigation
    : [
        ...navigation.slice(0, 5),
        { id: "watchlist" as const, label: "Minha Lista", icon: Bookmark },
        ...navigation.slice(5),
      ].map((item) => ({
        ...item,
        label:
          item.id === "sources"
            ? "Minhas fontes"
            : item.id === "history"
              ? "Continuar assistindo"
              : item.label,
      }));
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
      <div
        className={`app-shell ${!demo ? "cinema-shell" : ""} ${menuCollapsed ? "sidebar-collapsed" : ""}`}
      >
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
            onClick={() => {
              useMediaNavigation.getState().close();
              navigate("settings");
            }}
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
            <span>{context ? "CATEGORIAS" : "EXPLORAR"}</span>
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
            className={context ? "contextual-navigation" : undefined}
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
            {context ? (
              <CatalogSidebar
                key={context}
                section={context}
                collapsed={menuCollapsed}
                onBack={() => {
                  setMainMenuFor(page);
                  requestAnimationFrame(() =>
                    navRef.current
                      ?.querySelector<HTMLButtonElement>(
                        '[aria-current="page"]',
                      )
                      ?.focus(),
                  );
                }}
                onHome={() => {
                  setMainMenuFor(null);
                  useMediaNavigation.getState().close();
                  navigate("home");
                }}
                onExpand={() => {
                  if (compact) setCompactExpanded(true);
                  else if (collapsed) toggleSidebar();
                }}
              />
            ) : (
              navItems.map(({ id, label, icon: Icon }, i) => (
                <Tip key={id} label={label} enabled={menuCollapsed}>
                  <button
                    className={`nav-item ${page === id ? "active" : ""} ${i === 4 ? "nav-divider" : ""}`}
                    aria-current={page === id ? "page" : undefined}
                    aria-label={label}
                    onClick={() => {
                      useMediaNavigation.getState().close();
                      setMainMenuFor(null);
                      navigate(id);
                      if (!demo && (id === "movies" || id === "series")) {
                        if (compact) setCompactExpanded(true);
                        else if (collapsed) toggleSidebar();
                      } else if (compact) setCompactExpanded(false);
                    }}
                  >
                    <Icon size={19} />
                    <span>{label}</span>
                  </button>
                </Tip>
              ))
            )}
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
