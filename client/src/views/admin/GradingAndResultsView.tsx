import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Exam } from '../../types';
import {
  Award, CheckCircle2, Download, Eye, FileSpreadsheet,
  Check, AlertCircle, Share2, Shield, Lock, Unlock, Edit3
} from 'lucide-react';

export const GradingAndResultsView: React.FC = () => {
  const { token } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number>(0);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Essay grading modal state
  const [gradingAttempt, setGradingAttempt] = useState<any | null>(null);
  const [gradingAnswers, setGradingAnswers] = useState<any[]>([]);
  const [essayGrades, setEssayGrades] = useState<Record<number, { score: number; feedback: string }>>({});
  const [gradingLoading, setGradingLoading] = useState(false);

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

  const fetchSubmissions = async () => {
    if (!selectedExamId) return;
    try {
      const res = await fetch(`/api/admin/exams/${selectedExamId}/proctor`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSubmissions(json.attempts || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchSubmissions();
    }
  }, [selectedExamId]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const openGradingModal = async (attemptId: number) => {
    try {
      setGradingLoading(true);
      const res = await fetch(`/api/admin/attempts/${attemptId}/grading`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGradingAttempt(data.attempt);
        setGradingAnswers(data.answers || []);

        const initialGrades: Record<number, { score: number; feedback: string }> = {};
        data.answers.forEach((ans: any) => {
          initialGrades[ans.question_id] = {
            score: ans.score_awarded !== null ? ans.score_awarded : 0,
            feedback: ans.essay_feedback || ''
          };
        });
        setEssayGrades(initialGrades);
      }
    } catch (_) {}
    finally {
      setGradingLoading(false);
    }
  };

  const handleSaveGrades = async () => {
    if (!gradingAttempt) return;
    const gradesArray = Object.entries(essayGrades).map(([qId, val]) => ({
      question_id: parseInt(qId),
      score_awarded: val.score,
      essay_feedback: val.feedback
    }));

    try {
      const res = await fetch(`/api/admin/attempts/${gradingAttempt.id}/grading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ grades: gradesArray })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message + ` (Total Nilai: ${data.totalScore})`, 'success');
        setGradingAttempt(null);
        fetchSubmissions();
      } else {
        showMsg(data.error || 'Gagal menyimpan nilai esai', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleReleaseScores = async (publish: boolean) => {
    if (!selectedExamId) return;
    try {
      const res = await fetch(`/api/admin/exams/${selectedExamId}/release-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ publish })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        fetchSubmissions();
      } else {
        showMsg(data.error || 'Gagal mengubah publikasi nilai', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="animate-fade-in">
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Koreksi Esai & Hasil Ujian</h1>
          <p style={{ fontSize: '0.875rem' }}>
            Koreksi jawaban esai, pantau nilai akhir murid, publikasikan hasil, dan unduh laporan resmi.
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

          <a
            href={`/api/export/results?exam_id=${selectedExamId}&format=xlsx`}
            className="btn btn-primary btn-sm"
            title="Download Laporan Nilai Excel (.xlsx)"
          >
            <Download size={14} />
            <span>Ekspor Excel (.xlsx)</span>
          </a>

          <a
            href={`/api/export/results?exam_id=${selectedExamId}&format=csv`}
            className="btn btn-secondary btn-sm"
            title="Download Laporan CSV"
          >
            <Download size={14} />
            <span>CSV</span>
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
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Control Banner for Score Release */}
      <div style={{
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-medium)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            Status Publikasi Nilai ke Siswa
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Jika belum dirilis, siswa hanya melihat konfirmasi pengumpulan tanpa rincian skor.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handleReleaseScores(true)}
            className="btn btn-success btn-sm"
          >
            <Unlock size={14} />
            <span>Rilis / Publikasikan Nilai</span>
          </button>

          <button
            onClick={() => handleReleaseScores(false)}
            className="btn btn-secondary btn-sm"
          >
            <Lock size={14} />
            <span>Tarik / Sembunyikan Nilai</span>
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '50px' }}>No</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>Status Ujian</th>
              <th>Nilai Objektif</th>
              <th>Nilai Akhir</th>
              <th>Status Nilai</th>
              <th style={{ textAlign: 'right' }}>Koreksi & Aksi</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
                  Belum ada pengerjaan yang tercatat pada ujian ini.
                </td>
              </tr>
            ) : (
              submissions.map((sub, idx) => (
                <tr key={sub.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{sub.student_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{sub.student_username}</div>
                  </td>
                  <td>
                    <span className="badge badge-info">{sub.class_name || '-'}</span>
                  </td>
                  <td>
                    <span className={`badge ${sub.status === 'submitted' ? 'badge-success' : 'badge-warning'}`}>
                      {sub.status === 'submitted' ? 'Selesai' : 'Mengerjakan'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {sub.objective_score !== null && sub.objective_score !== undefined ? sub.objective_score : '-'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: sub.total_score >= 75 ? 'var(--success)' : (sub.total_score !== null ? 'var(--warning)' : 'var(--text-muted)')
                    }}>
                      {sub.total_score !== null && sub.total_score !== undefined ? sub.total_score : '-'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${sub.is_published ? 'badge-success' : 'badge'}`}>
                      {sub.is_published ? 'Dirilis' : 'Tersimpan (Tertutup)'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => openGradingModal(sub.id)}
                      className="btn btn-secondary btn-sm"
                      title="Koreksi Jawaban Esai & Periksa Rincian"
                    >
                      <Edit3 size={13} />
                      <span>Koreksi Esai</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- ESSAY GRADING MODAL --- */}
      {gradingAttempt && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Lembar Koreksi & Penilaian Siswa</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Siswa: <strong>{gradingAttempt.student_name}</strong> &bull; {gradingAttempt.exam_title}
                </p>
              </div>
              <button onClick={() => setGradingAttempt(null)} className="modal-close">&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '60vh', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {gradingAnswers.map((ans, idx) => {
                const isEssay = ans.type === 'essay';
                const cur = essayGrades[ans.question_id] || { score: 0, feedback: '' };

                return (
                  <div
                    key={ans.question_id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)',
                      border: `1px solid ${isEssay ? 'var(--primary)' : 'var(--border-subtle)'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span className="badge badge-primary">Soal #{idx + 1} ({ans.type})</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bobot Soal: {ans.weight} pt</span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {ans.question_text}
                    </div>

                    <div style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Jawaban Siswa:
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                        {ans.answer_value ? String(ans.answer_value) : <em style={{ color: 'var(--text-faint)' }}>Tidak dijawab</em>}
                      </div>
                    </div>

                    {/* Admin grading guide */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      <strong>Kunci Acuan:</strong> {ans.answer_key}
                      {ans.rubric && <div style={{ color: 'var(--info)', marginTop: '0.2rem' }}>Rubrik: {ans.rubric}</div>}
                    </div>

                    {/* Grading input fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                          Nilai Diberikan (Maks {ans.weight}):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          max={ans.weight}
                          min={0}
                          className="form-control"
                          value={cur.score}
                          onChange={e => {
                            setEssayGrades({
                              ...essayGrades,
                              [ans.question_id]: { ...cur, score: parseFloat(e.target.value) || 0 }
                            });
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                          Catatan Koreksi / Feedback (Opsional):
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Komentar koreksi untuk siswa..."
                          value={cur.feedback}
                          onChange={e => {
                            setEssayGrades({
                              ...essayGrades,
                              [ans.question_id]: { ...cur, feedback: e.target.value }
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setGradingAttempt(null)} className="btn btn-secondary">
                Batal
              </button>
              <button onClick={handleSaveGrades} className="btn btn-primary">
                Simpan & Hitung Nilai Akhir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
