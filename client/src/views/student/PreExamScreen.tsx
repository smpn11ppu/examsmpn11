import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Exam } from '../../types';
import {
  Shield, AlertTriangle, CheckCircle2, Clock, Maximize2,
  Lock, ArrowRight, ArrowLeft
} from 'lucide-react';

export const PreExamScreen: React.FC<{
  exam: Exam;
  onBack: () => void;
  onProceedToWorkstation: (attemptId: number) => void;
}> = ({ exam, onBack, onProceedToWorkstation }) => {
  const { token } = useAuth();
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const handleStartAttempt = async () => {
    if (!pledgeChecked) {
      setError('Anda harus menyetujui pakta integritas kejujuran ujian.');
      return;
    }

    setStarting(true);
    setError('');

    try {
      // Try entering fullscreen mode before starting
      if (document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (_) {
          // ignore if denied by user or iframe
        }
      }

      const res = await fetch(`/api/student/exams/${exam.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: exam.active_token })
      });
      const data = await res.json();
      setStarting(false);

      if (res.ok) {
        onProceedToWorkstation(data.attempt_id);
      } else {
        setError(data.error || 'Gagal memulai ujian.');
      }
    } catch (err: any) {
      setStarting(false);
      setError('Error koneksi ke server: ' + err.message);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '3rem 1.5rem', maxWidth: '800px' }}>
      <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} />
        <span>Kembali ke Portal</span>
      </button>

      <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: 'var(--radius-xl)' }}>
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
            <Shield size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{exam.title}</h1>
          <p style={{ fontSize: '0.9rem' }}>
            Mata Pelajaran: <strong>{exam.subject_name || exam.subject_code}</strong> &bull; Durasi: <strong>{exam.duration_minutes} Menit</strong>
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Instructions */}
        <div style={{
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} color="var(--primary)" />
            <span>Petunjuk & Tata Tertib Pengerjaan:</span>
          </h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {exam.instructions || '1. Kerjakan dengan mandiri dan jujur.\n2. Jawaban tersimpan otomatis secara berkala.'}
          </div>
        </div>

        {/* Anti-cheat Notice */}
        <div style={{
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid var(--danger-border)',
          marginBottom: '1.75rem'
        }}>
          <h3 style={{ fontSize: '0.95rem', color: 'var(--danger)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={16} />
            <span>Pemberitahuan Sistem Integritas Terproteksi:</span>
          </h3>
          <ul style={{ fontSize: '0.8125rem', color: 'var(--text-main)', lineHeight: 1.6, paddingLeft: '1.2rem' }}>
            <li>Ujian akan berjalan dalam mode <strong>layar penuh (fullscreen)</strong>.</li>
            <li>Sistem merekam setiap perpindahan tab, pembukaan aplikasi lain, atau kehilangan fokus jendela.</li>
            <li>Pelanggaran yang terdeteksi dicatat secara real-time di server pengawas.</li>
            <li>Jika koneksi internet terputus sementara, jawaban tetap tersimpan secara aman di peramban dan disinkronkan kembali saat terhubung.</li>
          </ul>
        </div>

        {/* Integrity Pledge */}
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          cursor: 'pointer',
          marginBottom: '2rem'
        }}>
          <input
            type="checkbox"
            checked={pledgeChecked}
            onChange={e => setPledgeChecked(e.target.checked)}
            style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
            <strong>Saya berjanji</strong> akan mengerjakan ujian ini dengan jujur atas kemampuan diri sendiri tanpa bantuan orang lain atau sumber lain di luar ketentuan ujian.
          </span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleStartAttempt}
            disabled={!pledgeChecked || starting}
            className="btn btn-primary btn-lg"
            style={{ minWidth: '240px' }}
          >
            <Maximize2 size={18} />
            <span>{starting ? 'Menyiapkan Lembar Soal...' : 'Masuk ke Ruang Ujian'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
