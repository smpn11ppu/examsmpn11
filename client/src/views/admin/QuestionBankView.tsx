import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Question, SubjectItem, QuestionType, QuestionOption } from '../../types';
import {
  HelpCircle, Plus, Search, Filter, Edit2, Trash2,
  Eye, Upload, Download, Check, AlertCircle, FileSpreadsheet,
  CheckCircle2, XCircle, ArrowRight
} from 'lucide-react';

export const QuestionBankView: React.FC = () => {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Question Form State
  const [form, setForm] = useState({
    id: 0,
    subject_id: '',
    type: 'single_choice' as QuestionType,
    question_text: '',
    image_url: '',
    weight: 20,
    answer_key: 'A',
    rubric: '',
    options: [
      { option_key: 'A', option_text: '' },
      { option_key: 'B', option_text: '' },
      { option_key: 'C', option_text: '' },
      { option_key: 'D', option_text: '' }
    ] as QuestionOption[],
    // For matching
    matchingPairs: [
      { left: '', right: '' },
      { left: '', right: '' }
    ],
    // For multi choice
    multiKeys: [] as string[]
  });

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/admin/subjects', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setSubjects(json.subjects);
      }
    } catch (_) {}
  };

  const fetchQuestions = async () => {
    try {
      const q = new URLSearchParams();
      if (selectedSubject) q.append('subject_id', selectedSubject);
      if (selectedType) q.append('type', selectedType);
      if (search) q.append('search', search);

      const res = await fetch(`/api/admin/questions?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setQuestions(json.questions);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [selectedSubject, selectedType, search]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleOpenNew = () => {
    setForm({
      id: 0,
      subject_id: subjects[0]?.id ? String(subjects[0].id) : '',
      type: 'single_choice',
      question_text: '',
      image_url: '',
      weight: 20,
      answer_key: 'A',
      rubric: '',
      options: [
        { option_key: 'A', option_text: '' },
        { option_key: 'B', option_text: '' },
        { option_key: 'C', option_text: '' },
        { option_key: 'D', option_text: '' }
      ],
      matchingPairs: [
        { left: '', right: '' },
        { left: '', right: '' }
      ],
      multiKeys: []
    });
    setShowEditorModal(true);
  };

  const handleEdit = (q: Question) => {
    let multiKeys: string[] = [];
    let matchingPairs: Array<{ left: string; right: string }> = [];

    if (q.type === 'multiple_choice') {
      try {
        multiKeys = JSON.parse(q.answer_key);
      } catch (_) {
        multiKeys = [q.answer_key];
      }
    } else if (q.type === 'matching') {
      try {
        const obj = JSON.parse(q.answer_key);
        matchingPairs = Object.entries(obj).map(([left, right]) => ({ left, right: String(right) }));
      } catch (_) {}
    }

    setForm({
      id: q.id,
      subject_id: String(q.subject_id),
      type: q.type,
      question_text: q.question_text,
      image_url: q.image_url || '',
      weight: q.weight,
      answer_key: q.answer_key,
      rubric: q.rubric || '',
      options: q.options && q.options.length > 0 ? q.options : [
        { option_key: 'A', option_text: '' },
        { option_key: 'B', option_text: '' }
      ],
      matchingPairs: matchingPairs.length > 0 ? matchingPairs : [{ left: '', right: '' }, { left: '', right: '' }],
      multiKeys
    });
    setShowEditorModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus soal ini dari bank soal?')) return;
    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showMsg('Soal berhasil dihapus', 'success');
        fetchQuestions();
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalAnswerKey: any = form.answer_key;
    let finalOptions = form.options;

    if (form.type === 'multiple_choice') {
      finalAnswerKey = form.multiKeys;
    } else if (form.type === 'matching') {
      const pairObj: Record<string, string> = {};
      form.matchingPairs.forEach(p => {
        if (p.left && p.right) pairObj[p.left.trim()] = p.right.trim();
      });
      finalAnswerKey = pairObj;
      finalOptions = [];
    } else if (form.type === 'essay' || form.type === 'true_false') {
      finalOptions = [];
    }

    const payload = {
      subject_id: parseInt(form.subject_id),
      type: form.type,
      question_text: form.question_text,
      image_url: form.image_url || null,
      weight: parseFloat(String(form.weight)) || 1.0,
      answer_key: finalAnswerKey,
      rubric: form.rubric || null,
      options: finalOptions
    };

    const url = form.id ? `/api/admin/questions/${form.id}` : '/api/admin/questions';
    const method = form.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        setShowEditorModal(false);
        fetchQuestions();
      } else {
        showMsg(data.error || 'Gagal menyimpan soal', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const typeLabels: Record<QuestionType, string> = {
    single_choice: 'Pilihan Ganda',
    multiple_choice: 'Pilihan Ganda Kompleks',
    essay: 'Esai / Uraian',
    matching: 'Menjodohkan',
    true_false: 'Benar / Salah'
  };

  return (
    <div className="animate-fade-in">
      {/* Title & Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Bank Soal Terpusat</h1>
          <p style={{ fontSize: '0.875rem' }}>
            Kelola soal ujian: Pilihan Ganda, Pilihan Ganda Kompleks, Esai, Menjodohkan, dan Benar/Salah.
          </p>
        </div>

        <button onClick={handleOpenNew} className="btn btn-primary">
          <Plus size={16} />
          <span>Buat Soal Baru</span>
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

      {/* Filter Toolbar */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Cari teks soal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: '200px' }}
          value={selectedSubject}
          onChange={e => setSelectedSubject(e.target.value)}
        >
          <option value="">Semua Mapel</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: '200px' }}
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
        >
          <option value="">Semua Jenis Soal</option>
          <option value="single_choice">Pilihan Ganda</option>
          <option value="multiple_choice">Pilihan Ganda Kompleks</option>
          <option value="true_false">Benar / Salah</option>
          <option value="matching">Menjodohkan</option>
          <option value="essay">Esai</option>
        </select>
      </div>

      {/* Questions Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>No</th>
              <th>Mata Pelajaran</th>
              <th>Jenis Soal</th>
              <th>Pratinjau Pertanyaan</th>
              <th>Bobot</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
                  Tidak ada soal yang sesuai dengan kriteria filter.
                </td>
              </tr>
            ) : (
              questions.map((q, idx) => (
                <tr key={q.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td>
                    <span className="badge badge-info">{q.subject_name || q.subject_code}</span>
                  </td>
                  <td>
                    <span className={`badge ${
                      q.type === 'single_choice' ? 'badge-primary' :
                      q.type === 'multiple_choice' ? 'badge-warning' :
                      q.type === 'true_false' ? 'badge-info' :
                      q.type === 'matching' ? 'badge-success' : 'badge'
                    }`}>
                      {typeLabels[q.type]}
                    </span>
                  </td>
                  <td style={{ maxWidth: '380px' }}>
                    <div style={{
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {q.question_text}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{q.weight} pt</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        className="btn btn-secondary btn-sm"
                        title="Pratinjau Soal"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleEdit(q)}
                        className="btn btn-secondary btn-sm"
                        title="Edit Soal"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger)' }}
                        title="Hapus Soal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- QUESTION EDITOR MODAL --- */}
      {showEditorModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{form.id ? 'Edit Soal' : 'Buat Soal Baru'}</h2>
              <button onClick={() => setShowEditorModal(false)} className="modal-close">&times;</button>
            </div>

            <form onSubmit={handleSaveQuestion}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Mata Pelajaran</label>
                  <select
                    className="form-control"
                    value={form.subject_id}
                    onChange={e => setForm({ ...form, subject_id: e.target.value })}
                    required
                  >
                    <option value="">-- Pilih Mapel --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Jenis Soal</label>
                  <select
                    className="form-control"
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as QuestionType })}
                  >
                    <option value="single_choice">Pilihan Ganda (1 Jawaban)</option>
                    <option value="multiple_choice">Pilihan Ganda Banyak Jawaban</option>
                    <option value="true_false">Benar / Salah</option>
                    <option value="matching">Menjodohkan (Matching)</option>
                    <option value="essay">Esai / Uraian</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Bobot</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-control"
                    value={form.weight}
                    onChange={e => setForm({ ...form, weight: parseFloat(e.target.value) || 1 })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Teks Pertanyaan / Soal</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '110px' }}
                  placeholder="Tuliskan butir soal secara lengkap dan jelas..."
                  value={form.question_text}
                  onChange={e => setForm({ ...form, question_text: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">URL Gambar Ilustrasi (Opsional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="https://... atau /uploads/gambar.png"
                  value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                />
              </div>

              {/* Dynamic Answer Key & Options based on type */}

              {/* 1. SINGLE CHOICE */}
              {form.type === 'single_choice' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                    Opsi Jawaban & Kunci Benar (Pilih satu radio untuk kunci):
                  </label>
                  {form.options.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <input
                        type="radio"
                        name="correct_single"
                        checked={form.answer_key === opt.option_key}
                        onChange={() => setForm({ ...form, answer_key: opt.option_key })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span className="badge badge-primary" style={{ width: '28px', justifyContent: 'center' }}>
                        {opt.option_key}
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Teks opsi ${opt.option_key}`}
                        value={opt.option_text}
                        onChange={e => {
                          const newOpts = [...form.options];
                          newOpts[idx].option_text = e.target.value;
                          setForm({ ...form, options: newOpts });
                        }}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 2. MULTIPLE CHOICE */}
              {form.type === 'multiple_choice' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                    Opsi Jawaban & Kunci Benar (Centang semua opsi yang benar):
                  </label>
                  {form.options.map((opt, idx) => {
                    const isChecked = form.multiKeys.includes(opt.option_key);
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            let updated = [...form.multiKeys];
                            if (e.target.checked) updated.push(opt.option_key);
                            else updated = updated.filter(k => k !== opt.option_key);
                            setForm({ ...form, multiKeys: updated });
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span className="badge badge-warning" style={{ width: '28px', justifyContent: 'center' }}>
                          {opt.option_key}
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          placeholder={`Teks opsi ${opt.option_key}`}
                          value={opt.option_text}
                          onChange={e => {
                            const newOpts = [...form.options];
                            newOpts[idx].option_text = e.target.value;
                            setForm({ ...form, options: newOpts });
                          }}
                          required
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. TRUE / FALSE */}
              {form.type === 'true_false' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                    Kunci Jawaban Pernyataan:
                  </label>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tf_key"
                        checked={form.answer_key === 'true'}
                        onChange={() => setForm({ ...form, answer_key: 'true' })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>BENAR (True)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tf_key"
                        checked={form.answer_key === 'false'}
                        onChange={() => setForm({ ...form, answer_key: 'false' })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span className="badge badge-danger" style={{ fontSize: '0.85rem' }}>SALAH (False)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 4. MATCHING */}
              {form.type === 'matching' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Pasangan Menjodohkan (Premis Kiri & Target Kanan):
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        matchingPairs: [...form.matchingPairs, { left: '', right: '' }]
                      })}
                      className="btn btn-secondary btn-sm"
                    >
                      + Tambah Pasangan
                    </button>
                  </div>

                  {form.matchingPairs.map((pair, idx) => (
                    <div key={idx} className="matching-pair-row">
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Premis #${idx + 1}`}
                        value={pair.left}
                        onChange={e => {
                          const updated = [...form.matchingPairs];
                          updated[idx].left = e.target.value;
                          setForm({ ...form, matchingPairs: updated });
                        }}
                        required
                      />
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <ArrowRight size={18} />
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Jawaban pasangannya`}
                        value={pair.right}
                        onChange={e => {
                          const updated = [...form.matchingPairs];
                          updated[idx].right = e.target.value;
                          setForm({ ...form, matchingPairs: updated });
                        }}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 5. ESSAY */}
              {form.type === 'essay' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">Kunci Jawaban Esai / Pedoman Koreksi</label>
                    <textarea
                      className="form-control"
                      placeholder="Poin-poin jawaban yang diharapkan dari siswa..."
                      value={form.answer_key}
                      onChange={e => setForm({ ...form, answer_key: e.target.value })}
                      rows={3}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rubrik Penilaian (Pedoman Pembobotan Poin)</label>
                    <textarea
                      className="form-control"
                      placeholder="Contoh: Jawaban lengkap (10 pt), Sebagian benar (5 pt)"
                      value={form.rubric}
                      onChange={e => setForm({ ...form, rubric: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setShowEditorModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PREVIEW MODAL --- */}
      {previewQuestion && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-primary">{typeLabels[previewQuestion.type]}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Bobot: {previewQuestion.weight} pt</span>
              </div>
              <button onClick={() => setPreviewQuestion(null)} className="modal-close">&times;</button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                {previewQuestion.question_text}
              </div>

              {previewQuestion.image_url && (
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                  <img
                    src={previewQuestion.image_url}
                    alt="Ilustrasi soal"
                    style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
              )}

              {/* Options Preview */}
              {previewQuestion.options && previewQuestion.options.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {previewQuestion.options.map(opt => {
                    const isKey = previewQuestion.answer_key.includes(opt.option_key);
                    return (
                      <div
                        key={opt.id || opt.option_key}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          background: isKey ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                          border: `1px solid ${isKey ? 'var(--success)' : 'var(--border-subtle)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          fontSize: '0.875rem'
                        }}
                      >
                        <span className="badge" style={{ background: isKey ? 'var(--success)' : 'var(--bg-secondary)', color: isKey ? '#fff' : 'var(--text-main)' }}>
                          {opt.option_key}
                        </span>
                        <span>{opt.option_text}</span>
                        {isKey && <CheckCircle2 size={16} color="var(--success)" style={{ marginLeft: 'auto' }} />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* True False preview */}
              {previewQuestion.type === 'true_false' && (
                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
                  Kunci Jawaban: <span className="badge badge-success">{previewQuestion.answer_key.toUpperCase()}</span>
                </div>
              )}

              {/* Matching preview */}
              {previewQuestion.type === 'matching' && (
                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Kunci Pasangan Menjodohkan:</div>
                  <pre style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{previewQuestion.answer_key}</pre>
                </div>
              )}

              {/* Essay preview */}
              {previewQuestion.type === 'essay' && (
                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Pedoman Jawaban Esai:</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{previewQuestion.answer_key}</div>
                  {previewQuestion.rubric && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Rubrik: {previewQuestion.rubric}</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreviewQuestion(null)} className="btn btn-secondary">
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
