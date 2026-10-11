import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, AlertTriangle, CheckCircle, Shield } from 'lucide-react';

export const MandatoryPasswordChange: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 5) {
      setError('Password baru minimal 5 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Password baru tidak boleh sama dengan password default saat ini.');
      return;
    }

    setLoading(true);
    const res = await changePassword(newPassword, currentPassword);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
    } else {
      setError(res.error || 'Gagal mengubah password');
    }
  };

  const defaultPassHint = user?.role === 'admin' ? 'admin' : 'siswa11';

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-scale-in" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--warning-bg)',
            border: '2px solid var(--warning-border)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <KeyRound size={26} color="var(--warning)" />
          </div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Wajib Ganti Password</h2>
          <p style={{ fontSize: '0.85rem' }}>
            Demi keamanan akun Anda ({user?.username}), kebijakan sistem CBTKU mewajibkan penggantian password bawaan saat pertama kali login.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            fontSize: '0.8125rem',
            marginBottom: '1rem'
          }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Password Berhasil Diperbarui!</h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Anda sekarang dapat menggunakan seluruh fitur CBTKU dengan aman.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Lanjutkan ke Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Password Saat Ini (Default: <code>{defaultPassHint}</code>)</label>
              <input
                type="password"
                className="form-control"
                placeholder={`Masukkan password default (${defaultPassHint})`}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password Baru</label>
              <input
                type="password"
                className="form-control"
                placeholder="Minimal 5 karakter"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Konfirmasi Password Baru</label>
              <input
                type="password"
                className="form-control"
                placeholder="Ketik ulang password baru"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={logout}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Batal & Keluar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                <Shield size={16} />
                <span>{loading ? 'Menyimpan...' : 'Perbarui Password'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
