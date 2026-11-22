import React, { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginScreen } from './components/LoginScreen';
import { api, clearStoredAuth, getStoredAuth } from './services/api';
import { ThemeMode, UserProfile } from './types/agenda';
import { S } from './engine/agendaCore';
import { render } from './engine/agendaRenderers';
import { initAgendaEngine } from './engine/agendaEvents';

const THEME_KEY = 'agenda-inteligente-theme';

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

  useEffect(() => {
    initAgendaEngine(onSetTheme);
    render();
  }, [onSetTheme]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(event.target as Node)) {
        utilityMenuRef.current.open = false;
      }
    };
    document.addEventListener('click', closeOnOutsideClick);
    return () => document.removeEventListener('click', closeOnOutsideClick);
  }, []);

  const closeUtilityMenu = () => {
    if (utilityMenuRef.current) utilityMenuRef.current.open = false;
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
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="mark">
            <svg className="i" viewBox="0 0 24 24">
              <rect x="3" y="4.5" width="18" height="16" rx="3" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3" />
            </svg>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '18px' }}>Agenda</span>
            <span className="brand-accent-text" style={{ fontSize: '18px', fontWeight: 700 }}>
              Inteligente
            </span>
            <span className="brand-pro-badge" style={{ fontSize: '9.5px', padding: '1.5px 6px' }}>
              PRO
            </span>
          </div>
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
              <button type="button" id="bell" onClick={closeUtilityMenu}>
                <svg className="i utility-item-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
                <span>Notificação</span>
                <span className="badge" id="bellcount"></span>
              </button>
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
