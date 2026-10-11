import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Exam } from '../../types';
import {
  FileText, Clock, Key, Shield, PlayCircle, CheckCircle2,
  AlertCircle, Lock, Award, ArrowRight
} from 'lucide-react';

export const StudentPortal: React.FC<{
  onStartExam: (exam: Exam, attemptId?: number) => void;
  onViewResult: (attemptId: number) => void;
}> = ({ onStartExam, onViewResult }) => {
  const { user, token } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Token Entry Modal
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/student/exams', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setExams(json.exams || []);
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleOpenTokenModal = (exam: Exam) => {
    setSelectedExam(exam);
    setInputToken('');
    setTokenError('');
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam || !inputToken) return;

    setVerifying(true);
    setTokenError('');

    try {
      const res = await fetch(`/api/student/exams/${selectedExam.id}/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: inputToken.trim().toUpperCase() })
      });
      const data = await res.json();
      setVerifying(false);

      if (res.ok) {
        // Proceed to PreExamScreen with verified token
        onStartExam({ ...selectedExam, active_token: inputToken.trim().toUpperCase() });
      } else {
        setTokenError(data.error || 'Token tidak valid.');
      }
    } catch (err: any) {
      setVerifying(false);
      setTokenError('Gagal menghubungi server: ' + err.message);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '2.5rem 1.5rem', maxWidth: '1080px' }}>
      {/* Welcome Banner */}
      <div className="glass-panel" style={{
        padding: '2rem 2.25rem',
        marginBottom: '2.5rem',
        background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(31, 41, 55, 0.7) 100%)',
        border: '1px solid var(--border-glow)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge badge-primary">Portal Siswa</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Kelas: {user?.class_name || 'Reguler'}
              </span>
            </div>
            <h1 style={{ fontSize: '1.85rem', marginBottom: '0.35rem' }}>
              Halo, {user?.full_name}!
            </h1>
            <p style={{ fontSize: '0.9rem', maxWidth: '580px' }}>
              Pastikan Anda terhubung ke jaringan yang stabil dan siapkan token ujian yang diberikan oleh guru pengawas.
            </p>
          </div>

          <div style={{
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ujian Tersedia</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{exams.length}</div>
          </div>
        </div>
      </div>

      {/* Available Exams Section */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <FileText size={22} color="var(--primary)" />
          <span>Daftar Ujian Anda</span>
        </h2>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          Memuat jadwal ujian...
        </div>
      ) : exams.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <CheckCircle2 size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Tidak Ada Ujian Aktif</h3>
          <p style={{ fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto' }}>
            Saat ini belum ada jadwal ujian yang ditugaskan untuk kelas Anda. Silakan hubungi guru jika ada ujian yang dijadwalkan.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {exams.map(exam => {
            const hasActiveAttempt = Boolean(exam.activeAttempt);
            const latestAttempt = exam.attempts?.[0];
            const isCompleted = latestAttempt && latestAttempt.status === 'submitted';
            const isPast = exam.isPast;

            return (
              <div key={exam.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                  <span className="badge badge-info">{exam.subject_name || exam.subject_code}</span>
                  <span className={`badge ${
                    hasActiveAttempt ? 'badge-warning' :
                    isCompleted ? 'badge-success' :
                    exam.isOngoing ? 'badge-primary' : 'badge'
                  }`}>
                    {hasActiveAttempt ? 'Sedang Dikerjakan' :
                     isCompleted ? 'Sudah Selesai' :
                     exam.isOngoing ? 'Tersedia Sekarang' : 'Mendatang'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.125rem', marginBottom: '0.6rem' }}>{exam.title}</h3>

                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={14} />
                    <span>Durasi: <strong>{exam.duration_minutes} Menit</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={14} color={exam.security_mode === 'seb' ? 'var(--warning)' : 'var(--primary)'} />
                    <span>Keamanan: <strong>{exam.security_mode === 'seb' ? 'Safe Exam Browser' : 'Browser Terproteksi'}</strong></span>
                  </div>
                  {latestAttempt && latestAttempt.total_score !== null && latestAttempt.is_published ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                      <Award size={14} />
                      <span>Nilai Akhir: <strong>{latestAttempt.total_score}</strong></span>
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  {hasActiveAttempt ? (
                    <button
                      onClick={() => onStartExam(exam, exam.activeAttempt!.id)}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      <PlayCircle size={16} />
                      <span>Lanjutkan Ujian</span>
                    </button>
                  ) : isCompleted ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => onViewResult(latestAttempt!.id)}
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                      >
                        <CheckCircle2 size={16} color="var(--success)" />
                        <span>Lihat Hasil Ujian</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenTokenModal(exam)}
                      disabled={isPast}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      <Key size={16} />
                      <span>Masukkan Token & Mulai</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- TOKEN ENTRY MODAL --- */}
      {selectedExam && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Masukkan Token Ujian</h2>
              <button onClick={() => setSelectedExam(null)} className="modal-close">&times;</button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                {selectedExam.title}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Mintalah 6 digit kode token kepada guru atau pengawas ruang ujian.
              </p>
            </div>

            {tokenError && (
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
                <AlertCircle size={16} />
                <span>{tokenError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyToken}>
              <div className="form-group">
                <label className="form-label">Kode Token Ujian</label>
                <input
                  type="text"
                  className="form-control"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    textAlign: 'center',
                    letterSpacing: '0.25em'
                  }}
                  placeholder="Contoh: CBT2026"
                  value={inputToken}
                  onChange={e => setInputToken(e.target.value.toUpperCase())}
                  required
                  maxLength={10}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setSelectedExam(null)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={verifying || !inputToken} className="btn btn-primary">
                  {verifying ? 'Memvalidasi...' : 'Verifikasi & Lanjut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
