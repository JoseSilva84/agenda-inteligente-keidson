import React, { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginScreen } from './components/LoginScreen';
import { AiAssistantModal } from './components/AiAssistantModal';
import { api, clearStoredAuth, getStoredAuth } from './services/api';
import { ThemeMode, UserProfile } from './types/agenda';
import { S } from './engine/agendaCore';
import { render, renderNotifSubmenu } from './engine/agendaRenderers';
import { openNotifHistory } from './engine/agendaModals';
import { initAgendaEngine } from './engine/agendaEvents';

const THEME_KEY = 'agenda-inteligente-theme';
const AI_FAB_POS_KEY = 'agenda-inteligente-ai-fab-pos';
const FAB_SIZE = 52;
const FAB_MARGIN = 12;

export interface FabPosition {
  x: number;
  y: number;
}

function getViewportSize() {
  if (typeof window === 'undefined') return { vw: 1280, vh: 800 };
  const vv = window.visualViewport;
  return {
    vw: vv ? vv.width : window.innerWidth,
    vh: vv ? vv.height : window.innerHeight
  };
}

function clampFabPosition(x: number, y: number): FabPosition {
  const { vw, vh } = getViewportSize();
  const minX = FAB_MARGIN;
  const minY = FAB_MARGIN;
  const maxX = Math.max(minX, vw - FAB_SIZE - FAB_MARGIN);
  const maxY = Math.max(minY, vh - FAB_SIZE - FAB_MARGIN);
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, x))),
    y: Math.round(Math.min(maxY, Math.max(minY, y)))
  };
}

interface AgendaShellProps {
  user: UserProfile;
  effectiveDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onSetTheme: (mode: 'dark' | 'light') => void;
}

const AgendaShell: React.FC<AgendaShellProps> = ({
  user,
  effectiveDark,
  onToggleTheme,
  onLogout,
  onSetTheme
}) => {
  const qTimerRef = useRef<any>(null);
  const utilityMenuRef = useRef<HTMLDetailsElement>(null);
  const utilityMenuTimerRef = useRef<any>(null);
  const notifSubTimerRef = useRef<any>(null);
  const [isNotifSubOpen, setIsNotifSubOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAiMaximized, setIsAiMaximized] = useState(false);

  const fabBtnRef = useRef<HTMLButtonElement>(null);
  const suppressFabClickRef = useRef(false);
  const lastFabDragEndRef = useRef(0);
  const fabDragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    currentX: number;
    currentY: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    moved: false,
    currentX: 0,
    currentY: 0
  });

  const [isFabDragging, setIsFabDragging] = useState(false);
  const [fabPos, setFabPos] = useState<FabPosition | null>(() => {
    try {
      const raw = localStorage.getItem(AI_FAB_POS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        return clampFabPosition(parsed.x, parsed.y);
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    const handleViewportResize = () => {
      setFabPos((prev) => {
        if (!prev) return null;
        const clamped = clampFabPosition(prev.x, prev.y);
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        return clamped;
      });
    };

    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', handleViewportResize);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('orientationchange', handleViewportResize);
      vv?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  useEffect(() => {
    const btn = fabBtnRef.current;
    if (!btn) return;

    // Previne scroll e rubber-band do Safari no iPhone / iPad durante o arraste por toque
    const handleTouchMove = (e: TouchEvent) => {
      if (fabDragRef.current.active) {
        e.preventDefault();
      }
    };

    btn.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      btn.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const handleFabPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();

    const btn = fabBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    fabDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      currentX: rect.left,
      currentY: rect.top
    };

    const handleWindowPointerMove = (ev: PointerEvent) => {
      const state = fabDragRef.current;
      if (!state.active || (state.pointerId !== null && ev.pointerId !== state.pointerId)) return;

      const dist = Math.hypot(ev.clientX - state.startX, ev.clientY - state.startY);
      if (!state.moved) {
        if (dist < 5) return;
        state.moved = true;
        suppressFabClickRef.current = true;
        setIsFabDragging(true);
        try {
          btn.setPointerCapture(ev.pointerId);
        } catch {}
      }

      ev.preventDefault();
      const clamped = clampFabPosition(ev.clientX - state.offsetX, ev.clientY - state.offsetY);
      state.currentX = clamped.x;
      state.currentY = clamped.y;

      btn.style.left = `${clamped.x}px`;
      btn.style.top = `${clamped.y}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    };

    const finishDrag = (ev: PointerEvent) => {
      const state = fabDragRef.current;
      if (!state.active || (state.pointerId !== null && ev.pointerId !== state.pointerId)) return;

      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);

      const wasMoved = state.moved;
      const finalPos = clampFabPosition(state.currentX, state.currentY);
      state.active = false;
      state.pointerId = null;
      state.moved = false;

      try {
        if (btn.hasPointerCapture?.(ev.pointerId)) {
          btn.releasePointerCapture(ev.pointerId);
        }
      } catch {}

      if (wasMoved) {
        lastFabDragEndRef.current = Date.now();
        suppressFabClickRef.current = true;
        setIsFabDragging(false);
        setFabPos(finalPos);
        try {
          localStorage.setItem(AI_FAB_POS_KEY, JSON.stringify(finalPos));
        } catch {}
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  const handleFabClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressFabClickRef.current || Date.now() - lastFabDragEndRef.current < 280) {
      suppressFabClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsAiOpen((prev) => !prev);
  };

  useEffect(() => {
    initAgendaEngine(onSetTheme);
    render();
  }, [onSetTheme]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(event.target as Node)) {
        if (utilityMenuTimerRef.current) {
          clearTimeout(utilityMenuTimerRef.current);
          utilityMenuTimerRef.current = null;
        }
        if (notifSubTimerRef.current) {
          clearTimeout(notifSubTimerRef.current);
          notifSubTimerRef.current = null;
        }
        setIsNotifSubOpen(false);
        utilityMenuRef.current.open = false;
      }
    };
    document.addEventListener('click', closeOnOutsideClick);
    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
      if (utilityMenuTimerRef.current) {
        clearTimeout(utilityMenuTimerRef.current);
      }
      if (notifSubTimerRef.current) {
        clearTimeout(notifSubTimerRef.current);
      }
    };
  }, []);

  const closeUtilityMenu = () => {
    if (utilityMenuTimerRef.current) {
      clearTimeout(utilityMenuTimerRef.current);
      utilityMenuTimerRef.current = null;
    }
    if (notifSubTimerRef.current) {
      clearTimeout(notifSubTimerRef.current);
      notifSubTimerRef.current = null;
    }
    setIsNotifSubOpen(false);
    if (utilityMenuRef.current) utilityMenuRef.current.open = false;
  };

  const handleNotifMouseEnter = () => {
    if (notifSubTimerRef.current) {
      clearTimeout(notifSubTimerRef.current);
      notifSubTimerRef.current = null;
    }
    setIsNotifSubOpen(true);
    renderNotifSubmenu();
  };

  const handleNotifMouseLeave = () => {
    if (notifSubTimerRef.current) {
      clearTimeout(notifSubTimerRef.current);
    }
    notifSubTimerRef.current = setTimeout(() => {
      setIsNotifSubOpen(false);
    }, 180);
  };

  const handleMenuMouseEnter = () => {
    if (utilityMenuTimerRef.current) {
      clearTimeout(utilityMenuTimerRef.current);
      utilityMenuTimerRef.current = null;
    }
    if (utilityMenuRef.current) {
      utilityMenuRef.current.open = true;
    }
  };

  const handleMenuMouseLeave = () => {
    if (utilityMenuTimerRef.current) {
      clearTimeout(utilityMenuTimerRef.current);
    }
    utilityMenuTimerRef.current = setTimeout(() => {
      if (utilityMenuRef.current) {
        utilityMenuRef.current.open = false;
      }
    }, 180);
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    clearTimeout(qTimerRef.current);
    qTimerRef.current = setTimeout(() => {
      S.q = val.trim();
      if (S.q) {
        S.tab = 'agenda';
        S.view = 'list';
      }
      render();
    }, 180);
  };

  return (
    <motion.div
      key="agenda-shell"
      id="app"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="top">
        <div className="brand">
          <div className="mark">
            <svg className="i" viewBox="0 0 24 24">
              <rect x="3" y="4.5" width="18" height="16" rx="3" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3" />
            </svg>
          </div>
          <span>AGENDA INTELIGENTE</span>
        </div>
        <nav className="tabs" id="tabs"></nav>
        <div className="top-r">
          <label className="search" htmlFor="q">
            <svg className="i" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
            <input
              id="q"
              type="search"
              placeholder="Pesquisar atividades"
              autoComplete="off"
              onChange={handleSearchInput}
            />
          </label>

          <details
            className="utility-menu"
            ref={utilityMenuRef}
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeUtilityMenu();
                utilityMenuRef.current?.querySelector('summary')?.focus();
              }
            }}
          >
            <summary className="iconbtn utility-trigger" aria-label="Mais opções: tema, notificações e bloquear agenda" title="Mais opções">
              <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
              </svg>
              <span className="badge" id="utility-count"></span>
            </summary>
            <div className="utility-panel" aria-label="Opções da agenda">
              <button type="button" onClick={() => { onToggleTheme(); closeUtilityMenu(); }}>
                <svg className="i utility-item-icon" viewBox="0 0 24 24" aria-hidden="true">
                  {effectiveDark ? (
                    <>
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
                    </>
                  ) : (
                    <path d="M20.3 15.4A8.5 8.5 0 0 1 8.6 3.7 8.5 8.5 0 1 0 20.3 15.4Z" />
                  )}
                </svg>
                <span>{effectiveDark ? 'Modo claro' : 'Modo dark'}</span>
              </button>
              <div
                className="utility-sub-wrap"
                onMouseEnter={handleNotifMouseEnter}
                onMouseLeave={handleNotifMouseLeave}
              >
                <button
                  type="button"
                  id="bell"
                  className="utility-sub-trigger"
                  onClick={() => {
                    setIsNotifSubOpen((prev) => !prev);
                    renderNotifSubmenu();
                  }}
                  aria-haspopup="true"
                  aria-expanded={isNotifSubOpen}
                >
                  <svg className="i utility-item-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                  </svg>
                  <span>Notificação</span>
                  <span className="badge" id="bellcount"></span>
                  <svg className="i utility-chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <div
                  className={`utility-sub-panel ${isNotifSubOpen ? 'is-open' : ''}`}
                  id="notif-sub-panel"
                  role="region"
                  aria-label="Notificações pendentes e histórico"
                >
                  <div className="utility-sub-header">
                    <div className="utility-sub-title">
                      <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--accent)' }}>
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                      </svg>
                      <b>Notificações</b>
                    </div>
                    <button
                      type="button"
                      className="btn-mark-all"
                      id="notif-sub-readall"
                      title="Marcar todas como lidas"
                    >
                      Marcar lidas
                    </button>
                  </div>

                  <div className="utility-sub-body" id="notif-sub-list">
                    {/* Renderizado dinamicamente por renderNotifSubmenu() */}
                  </div>

                  <div className="utility-sub-footer">
                    <button
                      type="button"
                      className="notif-history-action"
                      id="btn-open-notif-history"
                      data-act="open-notif-history"
                      onClick={() => {
                        closeUtilityMenu();
                        openNotifHistory();
                      }}
                    >
                      <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                      </svg>
                      <span>Ver histórico de notificações</span>
                    </button>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => { closeUtilityMenu(); onLogout(); }}>
                <svg className="i utility-item-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <span>Bloquear agenda</span>
              </button>
            </div>
          </details>

          <button className="btn btn-primary" data-act="new">
            <svg className="i" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="newlbl">Nova atividade</span>
          </button>
        </div>
      </header>
      <div className="banner" id="banner" role="status"></div>
      <main id="main"></main>
      <nav className="bottomnav" id="bnav"></nav>
      <div id="pop-root"></div>
      <div id="modal-root"></div>

      {/* Botão Flutuante da IA (Arrastável em MacBook, iPad e iPhone) */}
      <button
        ref={fabBtnRef}
        type="button"
        draggable={false}
        className={`ai-fab-button ${isAiOpen ? 'active' : ''} ${isFabDragging ? 'is-dragging' : ''}`}
        style={
          fabPos
            ? {
                left: `${fabPos.x}px`,
                top: `${fabPos.y}px`,
                right: 'auto',
                bottom: 'auto'
              }
            : undefined
        }
        onPointerDown={handleFabPointerDown}
        onClick={handleFabClick}
        onContextMenu={(e) => e.preventDefault()}
        title="Assistente IA Smart Vida (clique para abrir ou arraste para mover)"
        aria-label="Assistente IA Smart Vida — clique para abrir ou arraste para mover"
      >
        <svg className="i ai-fab-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
          <path d="M19 3l-.9 2.1a1 1 0 0 1-.6.6L15.4 6.6l2.1.9a1 1 0 0 1 .6.6L19 10.2l.9-2.1a1 1 0 0 1 .6-.6l2.1-.9-2.1-.9a1 1 0 0 1-.6-.6z" />
        </svg>
      </button>

      {/* Modal / Janela Flutuante da IA */}
      <AiAssistantModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        isMaximized={isAiMaximized}
        onToggleMaximize={() => setIsAiMaximized((prev) => !prev)}
        anchorPos={fabPos}
      />
    </motion.div>
  );
};

export const App: React.FC = () => {
  const initialAuth = getStoredAuth();
  const [user, setUser] = useState<UserProfile | null>(initialAuth.user);
  const [token, setToken] = useState<string | null>(initialAuth.token);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const effectiveDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const resolved = effectiveDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme, effectiveDark]);

  const handleSetTheme = (nextMode: 'dark' | 'light') => {
    setTheme(nextMode);
    if (token) {
      api.patch('/auth/theme', { theme: nextMode }).catch(() => {});
    }
  };

  const handleToggleTheme = () => {
    handleSetTheme(effectiveDark ? 'light' : 'dark');
  };

  const handleLogout = () => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
    toast('Agenda bloqueada com segurança.');
  };

  return (
    <>
      <Toaster
        position="bottom-right"
        theme={effectiveDark ? 'dark' : 'light'}
        toastOptions={{
          style: {
            background: 'var(--ink)',
            color: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px'
          }
        }}
      />

      <AnimatePresence mode="wait">
        {!user || !token ? (
          <motion.div
            key="login-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ height: '100%' }}
          >
            <LoginScreen
              onSuccess={(u, t) => {
                setUser(u);
                setToken(t);
                if (u.theme === 'light' || u.theme === 'dark') {
                  setTheme(u.theme);
                }
              }}
              theme={theme}
              effectiveDark={effectiveDark}
              onToggleTheme={handleToggleTheme}
            />
          </motion.div>
        ) : (
          <AgendaShell
            key="agenda-shell"
            user={user}
            effectiveDark={effectiveDark}
            onToggleTheme={handleToggleTheme}
            onLogout={handleLogout}
            onSetTheme={handleSetTheme}
          />
        )}
      </AnimatePresence>
    </>
  );
};
