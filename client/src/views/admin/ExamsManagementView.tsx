import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Exam, SubjectItem, ClassItem, Question, ExamToken } from '../../types';
import {
  FileText, Plus, Key, Shield, Clock, Users,
  CheckCircle2, AlertCircle, Copy, Check, Download,
  ToggleLeft, ToggleRight, Edit2, Trash2, HelpCircle, Eye
} from 'lucide-react';

export const ExamsManagementView: React.FC<{ onNavigateToProctor: (examId: number) => void }> = ({ onNavigateToProctor }) => {
  const { token } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  // Modals
  const [showExamModal, setShowExamModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectedExamForTokens, setSelectedExamForTokens] = useState<Exam | null>(null);
  const [examTokens, setExamTokens] = useState<ExamToken[]>([]);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Exam Form
  const [form, setForm] = useState({
    id: 0,
    title: '',
    subject_id: '',
    instructions: '1. Kerjakan soal secara mandiri dan jujur.\n2. Dilarang berpindah tab atau keluar dari mode layar penuh (fullscreen).\n3. Jawaban tersimpan otomatis.',
    target_classes: 'all',
    selected_class_ids: [] as number[],
    start_time: '',
    end_time: '',
    duration_minutes: 60,
    max_attempts: 1,
    security_mode: 'standard' as 'standard' | 'seb',
    shuffle_questions: true,
    shuffle_options: true,
    publish_score: 'manual' as 'immediate' | 'manual',
    question_ids: [] as number[]
  });

  // Token Generator Form
  const [newTokenCustom, setNewTokenCustom] = useState('');
  const [newTokenMaxUsage, setNewTokenMaxUsage] = useState(0);
  const [recoveryTokenInfo, setRecoveryTokenInfo] = useState<{ token: string; rotation_minutes: number; seconds_remaining: number; valid_until: string } | null>(null);
  const [rotationMinutes, setRotationMinutes] = useState(5);
  const [savingRotation, setSavingRotation] = useState(false);
  const [recoveryTokenError, setRecoveryTokenError] = useState('');

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/admin/exams', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setExams(json.exams);
      }
    } catch (_) {}
  };

  const fetchPrerequisites = async () => {
    try {
      const [resSub, resCls, resQ] = await Promise.all([
        fetch('/api/admin/subjects', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/classes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/questions', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (resSub.ok) setSubjects((await resSub.json()).subjects);
      if (resCls.ok) setClasses((await resCls.json()).classes);
      if (resQ.ok) setAllQuestions((await resQ.json()).questions);
    } catch (_) {}
  };

  useEffect(() => {
    fetchExams();
    fetchPrerequisites();
  }, []);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleOpenCreate = () => {
    const now = new Date();
    const startStr = new Date(now.getTime() + 5 * 60 * 1000).toISOString().slice(0, 16);
    const endStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    setForm({
      id: 0,
      title: '',
      subject_id: subjects[0]?.id ? String(subjects[0].id) : '',
      instructions: '1. Kerjakan dengan teliti dan jujur.\n2. Sistem memantau perpindahan tab dan aktivitas mencurigakan.\n3. Tekan Kumpulkan jika telah selesai.',
      target_classes: 'all',
      selected_class_ids: [],
      start_time: startStr,
      end_time: endStr,
      duration_minutes: 60,
      max_attempts: 1,
      security_mode: 'standard',
      shuffle_questions: true,
      shuffle_options: true,
      publish_score: 'manual',
      question_ids: allQuestions.map(q => q.id) // default select available questions
    });
    setShowExamModal(true);
  };

  const handleEdit = async (exam: Exam) => {
    try {
      const res = await fetch(`/api/admin/exams/${exam.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const { exam: examData, questions } = await res.json();
        let targetClassIds: number[] = [];
        try {
          if (examData.target_classes !== 'all') {
            targetClassIds = JSON.parse(examData.target_classes);
          }
        } catch (_) {}

        setForm({
          id: examData.id,
          title: examData.title,
          subject_id: String(examData.subject_id),
          instructions: examData.instructions || '',
          target_classes: examData.target_classes === 'all' ? 'all' : 'custom',
          selected_class_ids: targetClassIds,
          start_time: examData.start_time.slice(0, 16),
          end_time: examData.end_time.slice(0, 16),
          duration_minutes: examData.duration_minutes,
          max_attempts: examData.max_attempts,
          security_mode: examData.security_mode,
          shuffle_questions: Boolean(examData.shuffle_questions),
          shuffle_options: Boolean(examData.shuffle_options),
          publish_score: examData.publish_score,
          question_ids: questions.map((q: any) => q.id)
        });
        setShowExamModal(true);
      }
    } catch (_) {}
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClassesValue = form.target_classes === 'all' ? 'all' : form.selected_class_ids;

    const payload = {
      title: form.title,
      subject_id: parseInt(form.subject_id),
      instructions: form.instructions,
      target_classes: targetClassesValue,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      duration_minutes: parseInt(String(form.duration_minutes)),
      max_attempts: parseInt(String(form.max_attempts)),
      security_mode: form.security_mode,
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      publish_score: form.publish_score,
      question_ids: form.question_ids
    };

    const url = form.id ? `/api/admin/exams/${form.id}` : '/api/admin/exams';
    const method = form.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        setShowExamModal(false);
        fetchExams();
      } else {
        showMsg(data.error || 'Gagal menyimpan ujian', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus jadwal ujian ini beserta relasi soalnya?')) return;
    try {
      const res = await fetch(`/api/admin/exams/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showMsg('Ujian berhasil dihapus', 'success');
        fetchExams();
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  // Supervisor recovery token is separate from the exam-entry token and rotates server-side.
  const fetchRecoveryTokenInfo = async (examId: number, syncRotation = false) => {
    try {
      const res = await fetch(`/api/admin/exams/${examId}/recovery-token`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat token pemulihan.');
      setRecoveryTokenInfo(data);
      setRecoveryTokenError('');
      if (syncRotation) setRotationMinutes(Number(data.rotation_minutes) || 5);
    } catch (err: any) {
      setRecoveryTokenError(err.message || 'Gagal memuat token pemulihan.');
    }
  };

  const saveRotationMinutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForTokens) return;
    setSavingRotation(true);
    setRecoveryTokenError('');
    try {
      const res = await fetch(`/api/admin/exams/${selectedExamForTokens.id}/recovery-token-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rotation_minutes: rotationMinutes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan interval.');
      setRecoveryTokenInfo(data);
      setRotationMinutes(Number(data.rotation_minutes) || 5);
      showMsg('Interval token pemulihan berhasil disimpan.', 'success');
    } catch (err: any) {
      setRecoveryTokenError(err.message || 'Gagal menyimpan interval.');
    } finally {
      setSavingRotation(false);
    }
  };

  useEffect(() => {
    if (!showTokenModal || !selectedExamForTokens) return;
    const examId = selectedExamForTokens.id;
    fetchRecoveryTokenInfo(examId, false);
    const refreshTimer = setInterval(() => { fetchRecoveryTokenInfo(examId, false); }, 3000);
    return () => clearInterval(refreshTimer);
  }, [showTokenModal, selectedExamForTokens?.id, token]);

  // Manage Tokens
  const openTokenModal = async (exam: Exam) => {
    setSelectedExamForTokens(exam);
    try {
      const res = await fetch(`/api/admin/exams/${exam.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const { tokens } = await res.json();
        setExamTokens(tokens || []);
        setRecoveryTokenInfo(null);
        setRecoveryTokenError('');
        setShowTokenModal(true);
        fetchRecoveryTokenInfo(exam.id, true);
      }
    } catch (_) {}
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForTokens) return;

    try {
      const res = await fetch(`/api/admin/exams/${selectedExamForTokens.id}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          custom_token: newTokenCustom || undefined,
          max_usage: newTokenMaxUsage || 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(`Token ${data.token} berhasil dibuat!`, 'success');
        setNewTokenCustom('');
        // refresh tokens
        openTokenModal(selectedExamForTokens);
        fetchExams();
      } else {
        showMsg(data.error || 'Gagal membuat token', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleToggleToken = async (tokenId: number) => {
    try {
      const res = await fetch(`/api/admin/tokens/${tokenId}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok && selectedExamForTokens) {
        openTokenModal(selectedExamForTokens);
        fetchExams();
      }
    } catch (_) {}
  };

  const copyToClipboard = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedToken(txt);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Manajemen Jadwal Ujian</h1>
          <p style={{ fontSize: '0.875rem' }}>Atur pelaksanaan ujian, rilis token pengerjaan, dan pilih mode keamanan (Browser / SEB).</p>
        </div>

        <button onClick={handleOpenCreate} className="btn btn-primary">
          <Plus size={16} />
          <span>Buat Jadwal Ujian</span>
        </button>
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
          {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Exams Grid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {exams.map(exam => {
          const now = new Date();
          const start = new Date(exam.start_time);
          const end = new Date(exam.end_time);
          const isOngoing = now >= start && now <= end;
          const isPast = now > end;

          return (
            <div key={exam.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span className="badge badge-info">{exam.subject_name || exam.subject_code}</span>
                <span className={`badge ${isOngoing ? 'badge-success' : isPast ? 'badge' : 'badge-warning'}`}>
                  {isOngoing ? 'Sedang Berlangsung' : isPast ? 'Telah Berakhir' : 'Mendatang'}
                </span>
              </div>

              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem', fontWeight: 700 }}>{exam.title}</h3>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} />
                  <span>Durasi: <strong>{exam.duration_minutes} Menit</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <HelpCircle size={14} />
                  <span>Jumlah Soal: <strong>{exam.question_count || 0} Butir</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={14} color={exam.security_mode === 'seb' ? 'var(--warning)' : 'var(--primary)'} />
                  <span>Keamanan: <strong>{exam.security_mode === 'seb' ? 'Safe Exam Browser (SEB)' : 'Browser Biasa Terproteksi'}</strong></span>
                </div>
              </div>

              {/* Token banner */}
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Token Aktif
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: exam.active_token ? 'var(--primary)' : 'var(--text-faint)' }}>
                    {exam.active_token || 'BELUM ADA'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {exam.active_token && (
                    <button
                      onClick={() => copyToClipboard(exam.active_token!)}
                      className="btn btn-secondary btn-sm"
                      title="Salin Token"
                    >
                      {copiedToken === exam.active_token ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                    </button>
                  )}
                  <button
                    onClick={() => openTokenModal(exam)}
                    className="btn btn-secondary btn-sm"
                    title="Kelola Token"
                  >
                    <Key size={14} />
                    <span>Kelola</span>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => onNavigateToProctor(exam.id)}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                >
                  <Eye size={14} />
                  <span>Monitoring</span>
                </button>

                <a
                  href={`/api/admin/seb/generate-config?exam_id=${exam.id}`}
                  download={`CBTKU_Exam_${exam.id}.seb`}
                  className="btn btn-secondary btn-sm"
                  title="Unduh Konfigurasi Safe Exam Browser (.seb)"
                >
                  <Download size={14} />
                  <span>.seb</span>
                </a>

                <button
                  onClick={() => handleEdit(exam)}
                  className="btn btn-secondary btn-sm"
                  title="Edit Ujian"
                >
                  <Edit2 size={14} />
                </button>

                <button
                  onClick={() => handleDelete(exam.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--danger)' }}
                  title="Hapus Ujian"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- MODAL ADD / EDIT EXAM --- */}
      {showExamModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{form.id ? 'Edit Pengaturan Ujian' : 'Buat Ujian Baru'}</h2>
              <button onClick={() => setShowExamModal(false)} className="modal-close">&times;</button>
            </div>

            <form onSubmit={handleSaveExam}>
              <div className="form-group">
                <label className="form-label">Judul Ujian</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Penilaian Tengah Semester Ganjil - Biologi X"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Mata Pelajaran</label>
                  <select
                    className="form-control"
                    value={form.subject_id}
                    onChange={e => setForm({ ...form, subject_id: e.target.value })}
                    required
                  >
                    <option value="">-- Pilih Mata Pelajaran --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Mode Keamanan Ujian</label>
                  <select
                    className="form-control"
                    value={form.security_mode}
                    onChange={e => setForm({ ...form, security_mode: e.target.value as any })}
                  >
                    <option value="standard">Browser Biasa (Proteksi Fullscreen & Tab Switch)</option>
                    <option value="seb">Safe Exam Browser (Wajib Aplikasi SEB)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Jadwal Mulai</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Jadwal Selesai</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Durasi (Mnt)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })}
                    required
                  />
                </div>
              </div>

              {/* Class target */}
              <div className="form-group">
                <label className="form-label">Target Peserta Didik / Kelas</label>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="target_cls"
                      checked={form.target_classes === 'all'}
                      onChange={() => setForm({ ...form, target_classes: 'all' })}
                    />
                    <span>Semua Kelas Terdaftar</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="target_cls"
                      checked={form.target_classes === 'custom'}
                      onChange={() => setForm({ ...form, target_classes: 'custom' })}
                    />
                    <span>Pilih Kelas Tertentu</span>
                  </label>
                </div>

                {form.target_classes === 'custom' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    {classes.map(c => {
                      const isChecked = form.selected_class_ids.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              let next = [...form.selected_class_ids];
                              if (e.target.checked) next.push(c.id);
                              else next = next.filter(id => id !== c.id);
                              setForm({ ...form, selected_class_ids: next });
                            }}
                          />
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Randomization & Score release switches */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={form.shuffle_questions}
                    onChange={e => setForm({ ...form, shuffle_questions: e.target.checked })}
                  />
                  <span>Acak Urutan Soal</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={form.shuffle_options}
                    onChange={e => setForm({ ...form, shuffle_options: e.target.checked })}
                  />
                  <span>Acak Opsi Pilihan Ganda</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <select
                    className="form-control"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    value={form.publish_score}
                    onChange={e => setForm({ ...form, publish_score: e.target.value as any })}
                  >
                    <option value="manual">Publikasi Nilai: Manual (Oleh Guru)</option>
                    <option value="immediate">Publikasi Nilai: Otomatis Langsung</option>
                  </select>
                </label>
              </div>

              {/* Question Selection Checklist */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Pilih Soal dari Bank Soal ({form.question_ids.length} dipilih)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (form.question_ids.length === allQuestions.length) {
                        setForm({ ...form, question_ids: [] });
                      } else {
                        setForm({ ...form, question_ids: allQuestions.map(q => q.id) });
                      }
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    {form.question_ids.length === allQuestions.length ? 'Batal Pilih Semua' : 'Pilih Semua Soal'}
                  </button>
                </div>

                <div style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  padding: '0.5rem'
                }}>
                  {allQuestions.map(q => {
                    const isSelected = form.question_ids.includes(q.id);
                    return (
                      <label
                        key={q.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.4rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          marginBottom: '0.2rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            let next = [...form.question_ids];
                            if (e.target.checked) next.push(q.id);
                            else next = next.filter(id => id !== q.id);
                            setForm({ ...form, question_ids: next });
                          }}
                        />
                        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{q.type}</span>
                        <span style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {q.question_text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowExamModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Jadwal Ujian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL MANAGE TOKENS --- */}
      {showTokenModal && selectedExamForTokens && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Kelola Token Ujian</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedExamForTokens.title}</p>
              </div>
              <button onClick={() => setShowTokenModal(false)} className="modal-close">&times;</button>
            </div>

            {/* Automatically rotating token used only to unlock a student after an integrity violation. */}
            <section style={{ marginBottom: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border, var(--border-subtle))', background: 'var(--bg-secondary)' }}>
              <div style={{ fontWeight: 750, fontSize: '0.9rem', marginBottom: '0.35rem' }}>Token Pemulihan dari Pengawas</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Token terpisah dari token masuk ujian. Token ini berubah otomatis mengikuti interval di bawah dan hanya boleh diberikan oleh pengawas ruangan.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', letterSpacing: '0.18em', fontWeight: 850 }}>
                  {recoveryTokenInfo?.token || '------'}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={!recoveryTokenInfo?.token} onClick={() => copyToClipboard(recoveryTokenInfo!.token)}>
                  {copiedToken === recoveryTokenInfo?.token ? <Check size={14} /> : <Copy size={14} />} Salin token
                </button>
              </div>
              <form onSubmit={saveRotationMinutes} style={{ display: 'flex', alignItems: 'end', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 170px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Ganti token setiap (1–60 menit)</label>
                  <input type="number" className="form-control" min={1} max={60} step={1} value={rotationMinutes} onChange={e => setRotationMinutes(Number(e.target.value))} required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={savingRotation || rotationMinutes < 1 || rotationMinutes > 60}>
                  {savingRotation ? 'Menyimpan...' : 'Simpan interval'}
                </button>
              </form>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
                {recoveryTokenInfo ? `Token berganti dalam ${Math.floor(recoveryTokenInfo.seconds_remaining / 60).toString().padStart(2, '0')}:${(recoveryTokenInfo.seconds_remaining % 60).toString().padStart(2, '0')}.` : 'Memuat token saat ini...'}
              </div>
              {recoveryTokenError && <div style={{ marginTop: '0.5rem', color: 'var(--danger)', fontSize: '0.8rem' }}>{recoveryTokenError}</div>}
            </section>

            {/* Create new token form */}
            <form onSubmit={handleGenerateToken} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>Rilis Token Baru:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '0.75rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Kode Kustom (Opsional)"
                  value={newTokenCustom}
                  onChange={e => setNewTokenCustom(e.target.value.toUpperCase())}
                  maxLength={10}
                />
                <input
                  type="number"
                  className="form-control"
                  placeholder="Maks Pakai (0=bebas)"
                  value={newTokenMaxUsage || ''}
                  onChange={e => setNewTokenMaxUsage(parseInt(e.target.value) || 0)}
                />
                <button type="submit" className="btn btn-primary">
                  <Key size={14} />
                  <span>Rilis</span>
                </button>
              </div>
            </form>

            {/* Existing tokens list */}
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>Riwayat Token:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
              {examTokens.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                  Belum ada token yang dirilis.
                </div>
              ) : (
                examTokens.map(tok => (
                  <div
                    key={tok.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800 }}>
                          {tok.token}
                        </span>
                        <span className={`badge ${tok.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                          {tok.status === 'active' ? 'Aktif' : 'Dicabut'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Dipakai: {tok.usage_count} kali {tok.max_usage > 0 ? `(Maks: ${tok.max_usage})` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => copyToClipboard(tok.token)}
                        className="btn btn-secondary btn-sm"
                        title="Salin Token"
                      >
                        {copiedToken === tok.token ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => handleToggleToken(tok.id)}
                        className={`btn btn-sm ${tok.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                      >
                        {tok.status === 'active' ? 'Cabut' : 'Aktifkan'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowTokenModal(false)} className="btn btn-secondary">
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
