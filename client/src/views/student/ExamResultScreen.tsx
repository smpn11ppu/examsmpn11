import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, Award, Clock, ArrowLeft, ShieldCheck, Lock } from 'lucide-react';

export const ExamResultScreen: React.FC<{ attemptId: number; onBackToPortal: () => void }> = ({
  attemptId,
  onBackToPortal
}) => {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/student/attempts/${attemptId}/result`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (_) {}
      finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [attemptId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
        Memuat status hasil ujian...
      </div>
    );
  }

  const isPublished = Boolean(data?.is_published);
  const result = data?.result;
  const attempt = data?.attempt;

  return (
    <div className="container animate-fade-in" style={{ padding: '3.5rem 1.5rem', maxWidth: '640px' }}>
      <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: 'var(--radius-xl)' }}>
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: 'var(--success-bg)',
          border: '2px solid var(--success-border)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          <CheckCircle2 size={38} color="var(--success)" />
        </div>

        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Ujian Selesai Dikumpulkan!</h1>
        <p style={{ fontSize: '0.9rem', marginBottom: '2rem' }}>
          {attempt?.exam_title || 'Ujian Online Terproteksi'}
        </p>

        {isPublished && result ? (
          <div style={{
            padding: '1.75rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-medium)',
            marginBottom: '2rem'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nilai Akhir Ujian
            </div>
            <div style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: result.total_score >= 75 ? 'var(--success)' : 'var(--warning)',
              lineHeight: 1.1,
              margin: '0.5rem 0'
            }}>
              {result.total_score}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Skor Objektif: </span>
                <strong>{result.objective_score}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Skor Esai: </span>
                <strong>{result.essay_score || 0}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '2rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}>
            <Lock size={24} color="var(--info)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                Jawaban Berhasil Disimpan di Server
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Nilai Anda belum dirilis oleh guru/pengawas. Nilai akan ditampilkan setelah guru menyelesaikan seluruh penilaian esai dan verifikasi integritas.
              </div>
            </div>
          </div>
        )}

        <button onClick={onBackToPortal} className="btn btn-primary" style={{ width: '100%' }}>
          <ArrowLeft size={16} />
          <span>Kembali ke Portal Siswa</span>
        </button>
      </div>
    </div>
  );
};
