import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { loginApi } from '../services/api';
import { ThemeMode, UserProfile } from '../types/agenda';

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
  const [email, setEmail] = useState('keidson@agendainteligente.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginApi(email.trim(), password);
      toast.success(`Bem-vindo à Agenda Inteligente, ${res.user.name}!`);
      onSuccess(res.user, res.token);
    } catch (err: any) {
      const msg = err?.message || 'Não foi possível autenticar.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickUnlock = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await loginApi('keidson@agendainteligente.com', '123456');
      toast.success('Permissão concedida · Agenda Inteligente desbloqueada.');
      onSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err?.message || 'Erro ao desbloquear.');
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
        padding: '20px 16px'
      }}
    >
      {/* Ambient Apple Mesh Glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-18%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '680px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(40px)'
        }}
      />

      {/* Top Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1040px',
          width: '100%',
          margin: '0 auto',
          position: 'relative',
          zIndex: 2
        }}
      >
        <div className="brand">
          <div className="mark">
            <svg className="i" viewBox="0 0 24 24">
              <rect x="3" y="4.5" width="18" height="16" rx="3" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M13.5 13.5h3M7.5 17h3" />
            </svg>
          </div>
          <span>AGENDA INTELIGENTE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="iconbtn"
            onClick={onToggleTheme}
            title={effectiveDark ? 'Mudar para modo claro (Light)' : 'Mudar para modo escuro (Dark)'}
            aria-label="Alternar tema claro e escuro"
          >
            {effectiveDark ? (
              <svg className="i" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg className="i" viewBox="0 0 24 24">
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
          padding: '24px 0'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            width: 'min(440px, 100%)',
            padding: '32px 28px',
            borderRadius: '24px',
            background: 'var(--surface-glass)',
            backdropFilter: 'var(--apple-blur)',
            WebkitBackdropFilter: 'var(--apple-blur)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--line)'
          }}
        >
          {/* Pastor Photo Destaque */}
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
              style={{
                position: 'relative',
                width: '112px',
                height: '112px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                padding: '4px',
                background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 40%, transparent) 100%)',
                boxShadow: '0 12px 32px color-mix(in srgb, var(--accent) 35%, transparent)'
              }}
            >
              <img
                src="/pastor.jpg"
                alt="Pastor Keidson"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                  border: '2px solid var(--surface)'
                }}
              />
            </motion.div>

            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Acesso à Agenda
            </h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label className="field">
              E-mail de acesso
              <input
                type="email"
                placeholder="keidson@agendainteligente.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="field">
              Senha de permissão
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            {error && (
              <div className="info bad" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                height: '44px',
                fontSize: '15px',
                fontWeight: 600,
                marginTop: '4px',
                borderRadius: '12px'
              }}
            >
              <svg className="i" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              {loading ? 'Autenticando…' : 'Liberar Acesso à Agenda'}
            </button>

            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={handleQuickUnlock}
              style={{
                width: '100%',
                justifyContent: 'center',
                height: '40px',
                fontSize: '13.5px',
                borderRadius: '12px'
              }}
            >
              <svg className="i" viewBox="0 0 24 24">
                <path d="M12 2a4 4 0 0 1 4 4v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z" />
              </svg>
              Desbloqueio Rápido Apple (Keidson)
            </button>
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
              color: 'var(--muted)'
            }}
          >
            <span>PWA · MacBook · iPhone · iPad</span>
          </div>
        </motion.div>
      </main>

      {/* Bottom Info */}
      <footer
        style={{
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--muted)',
          position: 'relative',
          zIndex: 2,
          padding: '8px 0'
        }}
      >
        Conexão protegida
      </footer>
    </div>
  );
};
