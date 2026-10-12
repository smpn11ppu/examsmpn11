import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users, BookOpen, CircleHelp, CalendarDays, AlertTriangle,
  Clock3, CheckCircle2, ShieldAlert, ArrowUpRight, Activity,
  Plus, Radio, Layers3, RefreshCw, GraduationCap, ClipboardCheck
} from 'lucide-react';
import './AdminDashboard.css';

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

interface DashboardMetricProps {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  tone: 'blue' | 'gold' | 'green' | 'slate';
  onClick: () => void;
}

const DashboardMetric: React.FC<DashboardMetricProps> = ({ label, value, detail, icon, tone, onClick }) => (
  <button type="button" className={`school-dash-metric school-dash-metric--${tone}`} onClick={onClick}>
    <span className="school-dash-metric-top">
      <span className="school-dash-metric-label">{label}</span>
      <span className="school-dash-metric-icon" aria-hidden="true">{icon}</span>
    </span>
    <span className="school-dash-metric-value">{value.toLocaleString('id-ID')}</span>
    <span className="school-dash-metric-detail">{detail}</span>
    <span className="school-dash-metric-link">Buka bagian <ArrowUpRight size={14} aria-hidden="true" /></span>
  </button>
);

interface StatusRowProps {
  label: string;
  value: number;
  tone: 'green' | 'blue' | 'muted' | 'gold' | 'red';
  suffix: string;
}

const StatusRow: React.FC<StatusRowProps> = ({ label, value, tone, suffix }) => (
  <div className="school-dash-status-row">
    <span className={`school-dash-status-dot school-dash-status-dot--${tone}`} aria-hidden="true" />
    <span className="school-dash-status-label">{label}</span>
    <span className={`school-dash-status-count school-dash-status-count--${tone}`}>{value} {suffix}</span>
  </div>
);

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

export const AdminDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async (quiet = false) => {
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`Dashboard request failed: ${res.status}`);
      const json = await res.json() as DashboardData;
      setData(json);
      setLoadError(false);
      setLastUpdated(new Date());
    } catch {
      if (!quiet) setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchDashboard();
    const interval = window.setInterval(() => void fetchDashboard(true), 10000);
    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="school-dash-state">
        <span className="school-dash-state-mark"><Activity size={23} /></span>
        <h2>Menyiapkan ringkasan sekolah</h2>
        <p>Mengambil data terbaru untuk dashboard administrator.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="school-dash-state school-dash-state--error">
        <span className="school-dash-state-mark"><AlertTriangle size={23} /></span>
        <h2>Ringkasan belum dapat dimuat</h2>
        <p>Periksa koneksi ke server, lalu coba muat ulang statistik.</p>
        <button type="button" className="school-dash-button school-dash-button--primary" onClick={() => { setLoading(true); void fetchDashboard(); }}>
          <RefreshCw size={16} /> Coba lagi
        </button>
      </div>
    );
  }

  const violations = data.recentViolations || [];
  const audit = data.recentAudit || [];

  return (
    <div className="school-dashboard animate-fade-in">
      <header className="school-dash-heading">
        <div className="school-dash-heading-copy">
          <div className="school-dash-eyebrow"><span /> RINGKASAN SEKOLAH</div>
          <h1>Dashboard Administrator</h1>
          <p>Pantau pelaksanaan ujian, kesiapan peserta didik, dan aktivitas sistem dari satu tempat.</p>
          <div className="school-dash-updated">
            <span className="school-dash-live-dot" />
            Diperbarui otomatis setiap 10 detik
            {lastUpdated && <span className="school-dash-updated-time">· Terakhir {formatTime(lastUpdated.toISOString())}</span>}
          </div>
        </div>
        <div className="school-dash-actions">
          <button type="button" className="school-dash-button school-dash-button--primary" onClick={() => onNavigate('exams')}>
            <Plus size={17} /> Buat ujian baru
          </button>
          <button type="button" className="school-dash-button school-dash-button--secondary" onClick={() => onNavigate('proctor')}>
            <Radio size={16} /> Live monitoring
          </button>
          <button type="button" className="school-dash-refresh" title="Perbarui statistik" aria-label="Perbarui statistik" onClick={() => { setLoading(true); void fetchDashboard(); }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {loadError && (
        <div className="school-dash-inline-warning" role="status">
          <AlertTriangle size={16} /> Data terakhir ditampilkan. Pembaruan terbaru belum berhasil diambil.
        </div>
      )}

      <section className="school-dash-metrics" aria-label="Statistik sekolah">
        <DashboardMetric label="Murid terdaftar" value={data.counts.students} detail={`${data.counts.classes} kelas aktif`} icon={<Users size={19} />} tone="blue" onClick={() => onNavigate('students')} />
        <DashboardMetric label="Mata pelajaran" value={data.counts.subjects} detail="Mata pelajaran terkelola" icon={<BookOpen size={19} />} tone="gold" onClick={() => onNavigate('subjects')} />
        <DashboardMetric label="Bank soal" value={data.counts.questions} detail="Kumpulan soal ujian" icon={<CircleHelp size={19} />} tone="green" onClick={() => onNavigate('questions')} />
        <DashboardMetric label="Jadwal ujian" value={data.counts.exams} detail={`${data.exams.ongoing} ujian berlangsung`} icon={<CalendarDays size={19} />} tone="slate" onClick={() => onNavigate('exams')} />
      </section>

      <section className="school-dash-status-grid" aria-label="Status pelaksanaan ujian">
        <article className="school-dash-panel">
          <div className="school-dash-panel-heading">
            <div className="school-dash-panel-title-icon school-dash-panel-title-icon--blue"><CalendarDays size={18} /></div>
            <div>
              <h2>Status jadwal ujian</h2>
              <p>Ringkasan jadwal pelaksanaan</p>
            </div>
          </div>
          <div className="school-dash-status-list">
            <StatusRow label="Sedang berlangsung" value={data.exams.ongoing} tone="green" suffix="ujian" />
            <StatusRow label="Mendatang" value={data.exams.upcoming} tone="blue" suffix="ujian" />
            <StatusRow label="Berakhir / arsip" value={data.exams.completed} tone="muted" suffix="ujian" />
          </div>
          <button type="button" className="school-dash-text-link" onClick={() => onNavigate('exams')}>Kelola jadwal ujian <ArrowUpRight size={15} /></button>
        </article>

        <article className="school-dash-panel">
          <div className="school-dash-panel-heading">
            <div className="school-dash-panel-title-icon school-dash-panel-title-icon--gold"><Activity size={18} /></div>
            <div>
              <h2>Aktivitas peserta didik</h2>
              <p>Status sesi pengerjaan saat ini</p>
            </div>
          </div>
          <div className="school-dash-status-list">
            <StatusRow label="Sedang mengerjakan" value={data.attempts.in_progress} tone="gold" suffix="siswa" />
            <StatusRow label="Sudah dikumpulkan" value={data.attempts.submitted} tone="green" suffix="siswa" />
            <StatusRow label="Waktu habis / otomatis terkumpul" value={data.attempts.timed_out} tone="red" suffix="siswa" />
          </div>
          <button type="button" className="school-dash-text-link" onClick={() => onNavigate('proctor')}>Buka live monitoring <ArrowUpRight size={15} /></button>
        </article>
      </section>

      <section className="school-dash-activity-grid" aria-label="Aktivitas sistem terbaru">
        <article className="school-dash-panel school-dash-panel--activity">
          <div className="school-dash-panel-heading school-dash-panel-heading--spread">
            <div className="school-dash-panel-heading-main">
              <div className="school-dash-panel-title-icon school-dash-panel-title-icon--red"><ShieldAlert size={18} /></div>
              <div>
                <h2>Catatan integritas ujian</h2>
                <p>Pelanggaran terbaru yang tercatat sistem</p>
              </div>
            </div>
            <button type="button" className="school-dash-small-link" onClick={() => onNavigate('proctor')}>Lihat semua <ArrowUpRight size={14} /></button>
          </div>
          {violations.length === 0 ? (
            <div className="school-dash-empty">
              <CheckCircle2 size={24} />
              <div><strong>Belum ada catatan pelanggaran</strong><span>Catatan integritas akan muncul di sini ketika ada aktivitas yang perlu ditinjau.</span></div>
            </div>
          ) : (
            <div className="school-dash-activity-list">
              {violations.slice(0, 5).map(item => (
                <div className="school-dash-activity-item" key={item.id}>
                  <span className="school-dash-activity-indicator school-dash-activity-indicator--red" />
                  <div className="school-dash-activity-copy">
                    <strong>{item.student_name} <span>· {item.exam_title}</span></strong>
                    <p>{item.message}</p>
                  </div>
                  <time>{formatTime(item.created_at)}</time>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="school-dash-panel school-dash-panel--activity">
          <div className="school-dash-panel-heading school-dash-panel-heading--spread">
            <div className="school-dash-panel-heading-main">
              <div className="school-dash-panel-title-icon school-dash-panel-title-icon--slate"><Layers3 size={18} /></div>
              <div>
                <h2>Aktivitas administratif</h2>
                <p>Perubahan dan akses terbaru pada sistem</p>
              </div>
            </div>
            <button type="button" className="school-dash-small-link" onClick={() => onNavigate('audit')}>Audit trail <ArrowUpRight size={14} /></button>
          </div>
          {audit.length === 0 ? (
            <div className="school-dash-empty">
              <ClipboardCheck size={24} />
              <div><strong>Belum ada aktivitas terbaru</strong><span>Riwayat administrasi akan tercatat di bagian ini.</span></div>
            </div>
          ) : (
            <div className="school-dash-activity-list">
              {audit.slice(0, 5).map(item => (
                <div className="school-dash-activity-item" key={item.id}>
                  <span className="school-dash-activity-indicator school-dash-activity-indicator--blue" />
                  <div className="school-dash-activity-copy">
                    <strong>{item.action} <span>· {item.username || 'Sistem'}</span></strong>
                    <p>{item.details}</p>
                  </div>
                  <time>{formatTime(item.created_at)}</time>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <footer className="school-dash-footer">
        <div><GraduationCap size={16} /> <span>SMP Negeri 11 PPU</span></div>
        <span>Ringkasan sistem ujian sekolah</span>
        <button type="button" onClick={() => { setLoading(true); void fetchDashboard(); }}><RefreshCw size={13} /> Perbarui data</button>
      </footer>
    </div>
  );
};
