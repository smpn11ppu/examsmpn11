import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users, Layers, BookOpen, HelpCircle, FileText,
  AlertTriangle, Clock, CheckCircle2, ShieldAlert,
  ArrowUpRight, Activity, PlusCircle, Radio, Sparkles
} from 'lucide-react';

interface DashboardData {
  counts: {
    students: number;
    classes: number;
    subjects: number;
    questions: number;
    exams: number;
  };
  exams: {
    upcoming: number;
    ongoing: number;
    completed: number;
  };
  attempts: {
    in_progress: number;
    submitted: number;
    timed_out: number;
  };
  recentViolations: Array<{
    id: number;
    violation_type: string;
    message: string;
    created_at: string;
    student_name: string;
    exam_title: string;
  }>;
  recentAudit: Array<{
    id: number;
    action: string;
    details: string;
    created_at: string;
    username: string;
  }>;
}

export const AdminDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/dashboard', {
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

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10000); // Poll every 10s for live proctoring stats
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0' }}>
        <Activity className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ marginTop: '1rem' }}>Memuat statistik dashboard CBTKU...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Title & Quick Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Dashboard Pengawas & Administrator</h1>
          <p style={{ fontSize: '0.875rem' }}>
            Pantau status ujian real-time, aktivitas integritas murid, dan kelola ujian sekolah.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => onNavigate('exams')} className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Buat Ujian Baru</span>
          </button>
          <button onClick={() => onNavigate('proctor')} className="btn btn-secondary">
            <Radio size={16} color="var(--danger)" />
            <span>Live Monitoring</span>
          </button>
        </div>
      </div>

      {/* Main Stats Counter Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        <div className="glass-card" onClick={() => onNavigate('students')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Murid Terdaftar</span>
            <div style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
            {data.counts.students}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {data.counts.classes} Kelas aktif
          </div>
        </div>

        <div className="glass-card" onClick={() => onNavigate('subjects')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Mata Pelajaran</span>
            <div style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)', background: 'rgba(14, 165, 233, 0.15)', color: 'var(--info)' }}>
              <BookOpen size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
            {data.counts.subjects}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Kurikulum aktif
          </div>
        </div>

        <div className="glass-card" onClick={() => onNavigate('questions')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Bank Soal</span>
            <div style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
              <HelpCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
            {data.counts.questions}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            5 Jenis tipe soal
          </div>
        </div>

        <div className="glass-card" onClick={() => onNavigate('exams')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Jadwal Ujian</span>
            <div style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
              <FileText size={20} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
            {data.counts.exams}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {data.exams.ongoing} Sedang berlangsung
          </div>
        </div>
      </div>

      {/* Exam & Attempt Status Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Exam Schedule Breakdown */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--primary)" />
            <span>Status Jadwal Pelaksanaan Ujian</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: '0.875rem' }}>Sedang Berlangsung (Aktif)</span>
              </div>
              <span className="badge badge-success">{data.exams.ongoing} Ujian</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--info)' }} />
                <span style={{ fontSize: '0.875rem' }}>Mendatang (Upcoming)</span>
              </div>
              <span className="badge badge-info">{data.exams.upcoming} Ujian</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-faint)' }} />
                <span style={{ fontSize: '0.875rem' }}>Telah Berakhir / Arsip</span>
              </div>
              <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {data.exams.completed} Ujian
              </span>
            </div>
          </div>
        </div>

        {/* Student Session Progress */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--success)" />
            <span>Sesi Pengerjaan Peserta Didik</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--warning)', animation: 'pulseGlow 2s infinite' }} />
                <span style={{ fontSize: '0.875rem' }}>Sedang Mengerjakan di Ruang Ujian</span>
              </div>
              <span className="badge badge-warning">{data.attempts.in_progress} Siswa</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ fontSize: '0.875rem' }}>Sudah Dikumpulkan (Selesai)</span>
              </div>
              <span className="badge badge-success">{data.attempts.submitted} Siswa</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)' }} />
                <span style={{ fontSize: '0.875rem' }}>Waktu Habis (Auto Submitted)</span>
              </div>
              <span className="badge badge-danger">{data.attempts.timed_out} Siswa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Integrity & Violation Feed */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Violation Log stream */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} color="var(--danger)" />
              <span>Log Pelanggaran Integritas Terkini</span>
            </h3>
            <button onClick={() => onNavigate('proctor')} className="btn btn-outline btn-sm">
              <span>Semua Log</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {data.recentViolations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={32} color="var(--success)" style={{ marginBottom: '0.5rem' }} />
              <p>Belum ada rekaman pelanggaran. Ujian berlangsung kondusif.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.recentViolations.map(v => (
                <div key={v.id} style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8125rem'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {v.student_name} &bull; <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{v.exam_title}</span>
                    </div>
                    <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      {v.message}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(v.created_at).toLocaleTimeString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Log trail */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--primary)" />
              <span>Aktivitas Administratif Terkini</span>
            </h3>
            <button onClick={() => onNavigate('audit')} className="btn btn-outline btn-sm">
              <span>Audit Trail</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.recentAudit.map(a => (
              <div key={a.id} style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8125rem'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    <span className="badge badge-primary" style={{ marginRight: '0.4rem', fontSize: '0.65rem' }}>
                      {a.action}
                    </span>
                    {a.details}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>
                    Oleh: {a.username || 'System'}
                  </div>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(a.created_at).toLocaleTimeString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
