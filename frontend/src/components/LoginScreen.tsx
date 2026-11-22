import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { loginApi } from '../services/api';
import { ThemeMode, UserProfile } from '../types/agenda';
import { getPastorAvatar } from '../engine/agendaStorage';

interface LoginScreenProps {
  onSuccess: (user: UserProfile, token: string) => void;
  theme: ThemeMode;
  effectiveDark: boolean;
  onToggleTheme: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSuccess,
  effectiveDark,
  onToggleTheme
}) => {
  const [login, setLogin] = useState(() => {
    try {
      return localStorage.getItem('agenda-last-login') || localStorage.getItem('agenda-last-email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarSrc, setAvatarSrc] = useState(getPastorAvatar());

  useEffect(() => {
    const handleAvatarChanged = (e: any) => {
      setAvatarSrc(e?.detail || getPastorAvatar());
    };
    window.addEventListener('pastor-avatar-changed', handleAvatarChanged);
    return () => window.removeEventListener('pastor-avatar-changed', handleAvatarChanged);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError('Por favor, informe seu login e senha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await loginApi(login.trim(), password);
      try {
        localStorage.setItem('agenda-last-login', login.trim());
      } catch {}
      toast.success(`Bem-vindo, ${res.user.name}!`);
      onSuccess(res.user, res.token);
    } catch (err: any) {
      const msg = err?.message || 'Login ou senha inválidos.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-screen"
    >
      {/* Ambient Apple Mesh Glow */}
      <div
        className="login-ambient-glow"
        aria-hidden="true"
        style={{
          background: effectiveDark
            ? 'radial-gradient(circle, color-mix(in srgb, var(--accent) 26%, transparent) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(42, 76, 219, 0.08) 0%, transparent 70%)'
        }}
      />

      {/* Keep the brand and theme control on the same row at every viewport width. */}
      <header className="login-header">
        {/* Centered Brand: Beautiful Glowing Icon + Title with NO background card */}
        <div
          className="login-brand"
        >
          <div
            className="login-brand-mark"
            style={{ width: 44, height: 44, borderRadius: 13 }}
          >
            <svg
              className="i"
              viewBox="0 0 24 24"
              style={{ width: 24, height: 24, stroke: '#ffffff', strokeWidth: 1.8 }}
            >
              <rect x="3" y="4.5" width="18" height="16" rx="3" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3" />
            </svg>
          </div>
          <div className="login-brand-title" style={{ gap: '8px' }}>
            <span
              className="login-brand-agenda"
              style={{
                color: effectiveDark ? '#ffffff' : '#0f172a',
                fontSize: '26px',
                fontWeight: 800,
                letterSpacing: '-0.025em'
              }}
            >
              Smart
            </span>
            <span className="brand-accent-text" style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.025em' }}>
              Vida
            </span>
          </div>
        </div>

        <div className="login-theme-slot">
          <button
            type="button"
            className="iconbtn login-theme-toggle"
            onClick={onToggleTheme}
            title={effectiveDark ? 'Mudar para modo claro (Light)' : 'Mudar para modo escuro (Dark)'}
            aria-label="Alternar tema claro e escuro"
          >
            {effectiveDark ? (
              <svg className="i" viewBox="0 0 24 24" style={{ width: 19, height: 19 }}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg className="i" viewBox="0 0 24 24" style={{ width: 19, height: 19 }}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="login-main">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="card login-card"
          style={{
            boxShadow: effectiveDark
              ? '0 24px 60px rgba(0, 0, 0, 0.42)'
              : '0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 8px 16px -6px rgba(15, 23, 42, 0.06)'
          }}
        >
          {/* Pastor Photo with Continuous Looping Border Effect */}
          <div className="login-identity">
            <div
              className="login-avatar-frame"
            >
              {/* Outer Glowing Breathing Aura (Loop) */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-5px',
                  borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, #2A4CDB, #8B5CF6, #38BDF8, #2A4CDB)',
                  animation: 'auraSpin 4s linear infinite, auraPulse 3s ease-in-out infinite',
                  pointerEvents: 'none'
                }}
              />

              {/* Rotating Sharp Conic Ring (Loop) */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-2.5px',
                  borderRadius: '50%',
                  background: 'conic-gradient(from 180deg, #3B82F6, #A855F7, #06B6D4, #3B82F6)',
                  animation: 'auraSpin 3s linear infinite reverse',
                  pointerEvents: 'none'
                }}
              />

              {/* Inner Avatar Image */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid var(--surface)',
                  background: 'var(--surface)',
                  zIndex: 2,
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)'
                }}
              >
                <img
                  src={avatarSrc}
                  alt="Pastor Keidson"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
              </div>
            </div>

            {/* Title: Acesso */}
            <h1 className="login-person-name">
              Pr. Keidson Rodrigues
            </h1>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              Login:
              <input
                type="text"
                placeholder="Seu nome de usuário"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label className="field">
              Senha:
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ width: '100%', paddingRight: '46px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '30px',
                    height: '30px',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 0,
                    border: 0,
                    borderRadius: '8px',
                    background: 'transparent',
                    color: 'var(--muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? (
                    <svg className="i" viewBox="0 0 24 24" style={{ width: 19, height: 19 }}>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9 5 9 5a15.4 15.4 0 0 1-2.1 2.7M6.6 6.6C4.3 8.1 3 10 3 10s3.5 5 9 5c1 0 1.9-.2 2.7-.5" />
                    </svg>
                  ) : (
                    <svg className="i" viewBox="0 0 24 24" style={{ width: 19, height: 19 }}>
                      <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className="info bad" role="alert">
                {error}
              </div>
            )}

            {/* Primary Login Button with Looping Pulse & Shimmer */}
            <motion.button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                height: '46px',
                fontSize: '15px',
                fontWeight: 600,
                marginTop: '6px',
                borderRadius: '13px',
                position: 'relative',
                overflow: 'hidden',
                animation: 'buttonPulseGlow 2.5s ease-in-out infinite'
              }}
            >
              {/* Looping Light Shimmer Sweep */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '60%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent)',
                  animation: 'buttonShimmer 2.6s ease-in-out infinite',
                  pointerEvents: 'none'
                }}
              />

              <svg className="i" viewBox="0 0 24 24" style={{ width: 17, height: 17, position: 'relative', zIndex: 2 }}>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span style={{ position: 'relative', zIndex: 2 }}>
                {loading ? 'Entrando…' : 'Entrar'}
              </span>
            </motion.button>
          </form>

          {/* Apple Devices Footer Badge */}
          <div className="login-device-note" style={{ color: 'var(--muted)' }}>
            <span>MacBook · iPhone · iPad</span>
          </div>
        </motion.div>
      </main>

      {/* Bottom Info - Copyright Pr. Keidson Rodrigues */}
      <footer className="login-footer">
        © 2026 Pr. Keidson Rodrigues. Todos os direitos reservados.
      </footer>
    </div>
  );
};
