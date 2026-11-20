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
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'var(--bg)',
        color: 'var(--ink)',
        position: 'relative',
        overflow: 'hidden',
        padding: '16px'
      }}
    >
      {/* Ambient Apple Mesh Glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-16%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '740px',
          height: '420px',
          borderRadius: '50%',
          background: effectiveDark
            ? 'radial-gradient(circle, color-mix(in srgb, var(--accent) 26%, transparent) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(42, 76, 219, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(50px)'
        }}
      />

      {/* Top Header Bar - Centered Brand with theme toggle pinned to far right */}
      <header
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '14px 16px',
          zIndex: 10
        }}
      >
        {/* Centered Brand: Beautiful Glowing Icon + Title with NO background card */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            userSelect: 'none'
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #2A4CDB 0%, #7C3AED 100%)',
              boxShadow: '0 4px 18px rgba(42, 76, 219, 0.45)',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              flexShrink: 0
            }}
          >
            <svg
              className="i"
              viewBox="0 0 24 24"
              style={{ width: 20, height: 20, stroke: '#ffffff', strokeWidth: 1.8 }}
            >
              <rect x="3" y="4.5" width="18" height="16" rx="3" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3" />
            </svg>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: "var(--font-display, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Figtree', sans-serif)",
                fontSize: '18px',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: 'var(--ink)'
              }}
            >
              Agenda
            </span>
            <span className="brand-accent-text">
              Inteligente
            </span>
            <span className="brand-pro-badge">
              PRO
            </span>
          </div>
        </div>

        {/* Theme Toggle Button - Pinned to the Far Right of the screen */}
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }}>
          <button
            type="button"
            className="iconbtn"
            onClick={onToggleTheme}
            title={effectiveDark ? 'Mudar para modo claro (Light)' : 'Mudar para modo escuro (Dark)'}
            aria-label="Alternar tema claro e escuro"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'var(--surface-glass)',
              border: '1px solid var(--line)',
              backdropFilter: 'var(--apple-blur)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)'
            }}
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
      <main
        style={{
          display: 'grid',
          placeItems: 'center',
          flex: 1,
          position: 'relative',
          zIndex: 2,
          padding: '20px 0'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            width: 'min(430px, 100%)',
            padding: '34px 30px',
            borderRadius: '26px',
            background: 'var(--surface-glass)',
            backdropFilter: 'var(--apple-blur)',
            WebkitBackdropFilter: 'var(--apple-blur)',
            boxShadow: effectiveDark
              ? '0 24px 60px rgba(0, 0, 0, 0.42)'
              : '0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 8px 16px -6px rgba(15, 23, 42, 0.06)',
            border: '1px solid var(--line)'
          }}
        >
          {/* Pastor Photo with Continuous Looping Border Effect */}
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div
              style={{
                position: 'relative',
                width: '124px',
                height: '124px',
                margin: '0 auto 16px',
                display: 'grid',
                placeItems: 'center'
              }}
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
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Pr. Keidson Rodrigues
            </h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
          <div
            style={{
              marginTop: '22px',
              paddingTop: '16px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: 'var(--muted)',
              letterSpacing: '0.02em'
            }}
          >
            <span>MacBook · iPhone · iPad</span>
          </div>
        </motion.div>
      </main>

      {/* Bottom Info - Copyright Pr. Keidson Rodrigues */}
      <footer
        style={{
          textAlign: 'center',
          fontSize: '12.5px',
          color: 'var(--muted)',
          position: 'relative',
          zIndex: 2,
          padding: '8px 0'
        }}
      >
        © 2026 Pr. Keidson Rodrigues. Todos os direitos reservados.
      </footer>
    </div>
  );
};
