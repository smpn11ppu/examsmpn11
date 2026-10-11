import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Exam, ExamAttempt, ViolationLog } from '../../types';
import {
  Radio, ShieldAlert, Users, Clock, CheckCircle2,
  AlertTriangle, RefreshCw, Eye, RotateCcw, Send, Download
} from 'lucide-react';

export const LiveProctorView: React.FC<{ initialExamId?: number }> = ({ initialExamId }) => {
  const { token } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number>(initialExamId || 0);

  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [violations, setViolations] = useState<ViolationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Inspector Modal
  const [inspectAttempt, setInspectAttempt] = useState<ExamAttempt | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/admin/exams', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setExams(json.exams);
        if (!selectedExamId && json.exams.length > 0) {
          setSelectedExamId(json.exams[0].id);
        }
      }
    } catch (_) {}
  };

  const fetchProctorData = async () => {
    if (!selectedExamId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/exams/${selectedExamId}/proctor`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setAttempts(json.attempts || []);
        setViolations(json.violations || []);
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchProctorData();
    }
  }, [selectedExamId]);

  // Real-time auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !selectedExamId) return;
    const interval = setInterval(fetchProctorData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedExamId]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleForceSubmit = async (attemptId: number, studentName: string) => {
    if (!confirm(`Paksa kumpulkan ujian untuk ${studentName}? Sesi siswa akan diakhiri dan jawaban tersimpan akan langsung dinilai.`)) return;

    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/force-submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        fetchProctorData();
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleResetAttempt = async (attemptId: number, studentName: string) => {
    if (!confirm(`PERINGATAN: Reset sesi pengerjaan untuk ${studentName}? Seluruh jawaban dan log sesi ini akan dihapus sehingga siswa dapat memulai ulang dari awal.`)) return;

    try {
      const res = await fetch(`/api/admin/attempts/${attemptId}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        fetchProctorData();
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const inProgressCount = attempts.filter(a => a.status === 'in_progress').length;
  const submittedCount = attempts.filter(a => a.status === 'submitted').length;
  const totalViolationsCount = violations.length;

  return (
    <div className="animate-fade-in">
      {/* Title & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)', animation: 'pulseGlow 2s infinite' }} />
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Live Monitoring & Pengawasan Integritas</h1>
          </div>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Pemantauan langsung siswa yang sedang ujian, autosave real-time, dan deteksi perpindahan tab/jendela.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="form-control"
            style={{ width: '260px' }}
            value={selectedExamId}
            onChange={e => setSelectedExamId(parseInt(e.target.value))}
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            title="Auto refresh setiap 5 detik"
          >
            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
            <span>{autoRefresh ? 'Live Sync (5s)' : 'Sync Manual'}</span>
          </button>

          <a
            href={`/api/export/violations?exam_id=${selectedExamId}`}
            className="btn btn-secondary btn-sm"
            title="Ekspor Log Pelanggaran ke Excel"
          >
            <Download size={14} />
            <span>Ekspor Log</span>
          </a>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: message.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${message.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          fontSize: '0.875rem'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* KPI Counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div className="glass-card">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sedang Mengerjakan</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.25rem' }}>
            {inProgressCount} Siswa
          </div>
        </div>

        <div className="glass-card">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sudah Mengumpulkan</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.25rem' }}>
            {submittedCount} Siswa
          </div>
        </div>

        <div className="glass-card">
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pelanggaran Integritas</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: totalViolationsCount > 0 ? 'var(--danger)' : 'var(--text-main)', marginTop: '0.25rem' }}>
            {totalViolationsCount} Kejadian
          </div>
        </div>
      </div>

      {/* Main Table: Active Attempts */}
      <div className="table-container" style={{ marginBottom: '2rem' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '50px' }}>No</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>Status Pengerjaan</th>
              <th>Waktu Mulai</th>
              <th>Autosave Terakhir</th>
              <th>Pelanggaran</th>
              <th style={{ textAlign: 'right' }}>Aksi Pengawas</th>
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
                  Belum ada peserta yang memulai sesi ujian ini.
                </td>
              </tr>
            ) : (
              attempts.map((att, idx) => {
                const isOnline = att.status === 'in_progress';
                const hasViolations = (att.violation_count || 0) > 0;

                return (
                  <tr key={att.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{att.student_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>NIS: {att.student_username}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{att.class_name || '-'}</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        att.status === 'in_progress' ? 'badge-warning' :
                        att.status === 'submitted' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {att.status === 'in_progress' ? 'Mengerjakan' :
                         att.status === 'submitted' ? 'Selesai Dikumpulkan' : 'Waktu Habis'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(att.started_at).toLocaleTimeString('id-ID')}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {att.last_autosave_at ? (
                        <span style={{ color: 'var(--success)' }}>
                          {new Date(att.last_autosave_at).toLocaleTimeString('id-ID')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>-</span>
                      )}
                    </td>
                    <td>
                      {hasViolations ? (
                        <button
                          onClick={() => setInspectAttempt(att)}
                          className="badge badge-danger"
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          <AlertTriangle size={12} />
                          <span>{att.violation_count} Pelanggaran</span>
                        </button>
                      ) : (
                        <span className="badge badge-success">
                          <CheckCircle2 size={12} />
                          <span>0 Bersih</span>
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => setInspectAttempt(att)}
                          className="btn btn-secondary btn-sm"
                          title="Periksa Catatan Pelanggaran"
                        >
                          <Eye size={13} />
                          <span>Detail</span>
                        </button>

                        {isOnline && (
                          <button
                            onClick={() => handleForceSubmit(att.id, att.student_name!)}
                            className="btn btn-danger btn-sm"
                            title="Paksa Kumpulkan Jawaban Siswa Sekarang"
                          >
                            <Send size={13} />
                            <span>Paksa Kumpul</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleResetAttempt(att.id, att.student_name!)}
                          className="btn btn-secondary btn-sm"
                          title="Reset Sesi Pengerjaan"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* --- INSPECTION MODAL (VIOLATION AUDIT TRAIL FOR STUDENT) --- */}
      {inspectAttempt && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Log Integritas & Pelanggaran</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Peserta: <strong>{inspectAttempt.student_name}</strong> ({inspectAttempt.class_name})
                </p>
              </div>
              <button onClick={() => setInspectAttempt(null)} className="modal-close">&times;</button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Kronologi Kejadian Terdeteksi:
              </div>

              {violations.filter(v => v.attempt_id === inspectAttempt.id).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={36} color="var(--success)" style={{ marginBottom: '0.5rem' }} />
                  <p>Tidak ada catatan pelanggaran yang tercatat untuk siswa ini.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {violations.filter(v => v.attempt_id === inspectAttempt.id).map(v => (
                    <div
                      key={v.id}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--danger-bg)',
                        border: '1px solid var(--danger-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8125rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle size={14} />
                          <span>{v.violation_type.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <div style={{ color: 'var(--text-main)', marginTop: '0.2rem' }}>
                          {v.message}
                        </div>
                        {v.metadata && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                            {v.metadata}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(v.created_at).toLocaleTimeString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setInspectAttempt(null)} className="btn btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
