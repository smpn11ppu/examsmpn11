import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, AlertCircle, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Login gagal.');
    }
  };

  const fillQuick = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative'
    }}>
      <div className="glass-panel animate-scale-in" style={{
        width: '100%',
        maxWidth: '460px',
        padding: '2.5rem',
        borderRadius: 'var(--radius-xl)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--primary-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: 'var(--primary-glow)'
          }}>
            <Shield size={34} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>
            CBT<span style={{ color: 'var(--primary)' }}>KU</span>
          </h1>
          <p style={{ fontSize: '0.875rem' }}>
            Portal Ujian Online Terproteksi & Safe Exam Browser
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username / NIS</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}>
                <User size={18} />
              </span>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Contoh: admin atau siswa01"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}>
                <Lock size={18} />
              </span>
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Masukkan kata sandi akun"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginBottom: '1.5rem' }}
          >
            <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick Credentials Box for Easy Testing */}
        <div style={{
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
            <Sparkles size={14} color="var(--primary)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Akun Demonstrasi / Demo Login
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => fillQuick('admin', 'admin')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start', padding: '0.5rem 0.65rem', textAlign: 'left' }}
            >
              <CheckCircle2 size={13} color="var(--primary)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.75rem' }}>Admin</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>admin / admin</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => fillQuick('siswa01', 'siswa11')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start', padding: '0.5rem 0.65rem', textAlign: 'left' }}
            >
              <CheckCircle2 size={13} color="var(--success)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.75rem' }}>Siswa (Budi)</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>siswa01 / siswa11</div>
              </div>
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
          CBTKU Engine v1.0 &bull; Dilindungi Enkripsi Sesi & SEB Detection
        </div>
      </div>
    </div>
  );
};
