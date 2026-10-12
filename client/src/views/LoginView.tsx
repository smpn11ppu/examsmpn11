import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LockKeyhole, UserRound, AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react';
import './LoginView.css';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.success) setError(res.error || 'Login gagal. Periksa kembali username dan kata sandi Anda.');
    } catch {
      setError('Tidak dapat menghubungi server. Periksa koneksi internet, lalu coba kembali.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="school-login-page">
      <section className="school-login-card" aria-label="Login portal ujian sekolah">
        <aside className="school-login-brand-panel">
          <div className="school-login-brand">
            <div className="school-login-logo-frame">
              <img
                src="/logo-smpn11-ppu.jpg"
                alt="Logo SMP Negeri 11 PPU"
                className="school-login-logo"
              />
            </div>
            <p className="school-login-kicker">PORTAL RESMI SEKOLAH</p>
            <h1 className="school-login-school-name">SMP NEGERI 11 PPU</h1>
            <span className="school-login-gold-rule" aria-hidden="true" />
            <p className="school-login-brand-description">
              Sistem Ujian Berbasis Komputer
            </p>
            <p className="school-login-brand-note">
              Layanan ujian sekolah untuk peserta didik dan tenaga pendidik.
            </p>
          </div>
          <div className="school-login-brand-footer">
            <span className="school-login-footer-dot" aria-hidden="true" />
            Ujian tertib, jujur, dan bertanggung jawab
          </div>
        </aside>

        <div className="school-login-form-panel">
          <div className="school-login-form-heading">
            <span className="school-login-form-eyebrow">SELAMAT DATANG</span>
            <h2>Masuk ke akun Anda</h2>
            <p>Gunakan username/NIS dan kata sandi yang diberikan oleh sekolah.</p>
          </div>

          {error && (
            <div className="school-login-error" role="alert" aria-live="polite">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="school-login-form">
            <div className="school-login-field">
              <label htmlFor="school-login-username">Username / NIS</label>
              <div className="school-login-input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input
                  id="school-login-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="Masukkan username atau NIS"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="school-login-field">
              <label htmlFor="school-login-password">Kata sandi</label>
              <div className="school-login-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="school-login-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="school-login-submit" disabled={loading}>
              <span>{loading ? 'Memverifikasi akun…' : 'Masuk ke portal'}</span>
              {loading ? <LoaderCircle className="school-login-spinner" size={18} /> : <ArrowRight size={18} />}
            </button>
          </form>

          <div className="school-login-security-note">
            <LockKeyhole size={15} aria-hidden="true" />
            <span>Akses terbatas untuk akun sekolah yang terdaftar.</span>
          </div>
          <footer className="school-login-form-footer">
            © SMP Negeri 11 PPU · Portal Ujian Sekolah
          </footer>
        </div>
      </section>
      <p className="school-login-page-footer">Jika mengalami kendala login, hubungi administrator atau pengawas sekolah.</p>
    </main>
  );
};
