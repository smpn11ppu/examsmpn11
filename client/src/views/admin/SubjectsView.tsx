import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SubjectItem } from '../../types';
import { BookOpen, Plus, Search, Edit2, Check, AlertCircle, Power, CheckCircle2, Trash2 } from 'lucide-react';

export const SubjectsView: React.FC = () => {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ id: 0, code: '', name: '', description: '' });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [togglingSubjectId, setTogglingSubjectId] = useState<number | null>(null);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);

  const fetchSubjects = async () => {
    try {
      const params = new URLSearchParams({ include_inactive: 'true' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/subjects?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSubjects(json.subjects);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchSubjects();
  }, [search]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = form.id ? `/api/admin/subjects/${form.id}` : '/api/admin/subjects';
    const method = form.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        setShowModal(false);
        setForm({ id: 0, code: '', name: '', description: '' });
        fetchSubjects();
      } else {
        showMsg(data.error || 'Gagal menyimpan mata pelajaran', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleDeleteSubject = async (subject: SubjectItem) => {
    const confirmation = window.confirm(
      `Hapus permanen mata pelajaran "${subject.name}"?\n\n` +
      'Penghapusan hanya berhasil jika mata pelajaran belum digunakan oleh soal atau ujian. ' +
      'Jika masih digunakan, nonaktifkan mata pelajaran agar tidak dipilih untuk penggunaan baru.'
    );
    if (!confirmation) return;

    setDeletingSubjectId(subject.id);
    try {
      const res = await fetch(`/api/admin/subjects/${subject.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMsg(data.error || 'Mata pelajaran tidak dapat dihapus', 'error');
        return;
      }
      showMsg(data.message || 'Mata pelajaran berhasil dihapus', 'success');
      await fetchSubjects();
    } catch (err: any) {
      showMsg('Error koneksi: ' + err.message, 'error');
    } finally {
      setDeletingSubjectId(null);
    }
  };

  const handleToggleStatus = async (subject: SubjectItem) => {
    const nextStatus = subject.status === 'active' ? 'inactive' : 'active';
    const action = nextStatus === 'inactive' ? 'menonaktifkan' : 'mengaktifkan';
    const extraInfo = nextStatus === 'inactive'
      ? '\n\nMata pelajaran ini tidak akan tersedia untuk pemilihan baru. Data soal dan riwayat ujian tidak dihapus.'
      : '\n\nMata pelajaran ini akan tersedia kembali untuk pemilihan baru.';

    if (!window.confirm(`Yakin ingin ${action} mata pelajaran "${subject.name}"?${extraInfo}`)) return;

    setTogglingSubjectId(subject.id);
    try {
      const res = await fetch(`/api/admin/subjects/${subject.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMsg(data.error || 'Gagal mengubah status mata pelajaran', 'error');
        return;
      }
      showMsg(data.message || 'Status mata pelajaran berhasil diperbarui', 'success');
      await fetchSubjects();
    } catch (err: any) {
      showMsg('Error koneksi: ' + err.message, 'error');
    } finally {
      setTogglingSubjectId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Mata Pelajaran</h1>
          <p style={{ fontSize: '0.875rem' }}>Kelola daftar kurikulum dan mata pelajaran yang diujikan.</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Mata pelajaran nonaktif tidak tersedia untuk pemilihan baru. Soal dan riwayat ujian yang sudah ada tetap disimpan.</p>
        </div>

        <button
          onClick={() => {
            setForm({ id: 0, code: '', name: '', description: '' });
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>Tambah Mata Pelajaran</span>
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

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '1.25rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
        <input
          type="text"
          className="form-control"
          style={{ paddingLeft: '2.4rem' }}
          placeholder="Cari kode atau nama mapel..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>No</th>
              <th>Kode Mapel</th>
              <th>Nama Mata Pelajaran</th>
              <th>Deskripsi</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  Tidak ada mata pelajaran ditemukan.
                </td>
              </tr>
            ) : (
              subjects.map((s, idx) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{s.code}</span></td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{s.description || '-'}</td>
                  <td>
                    <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {s.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          setForm({ id: s.id, code: s.code, name: s.name, description: s.description || '' });
                          setShowModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                        title={`Edit ${s.name}`}
                      >
                        <Edit2 size={14} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(s)}
                        disabled={togglingSubjectId === s.id || deletingSubjectId === s.id}
                        className="btn btn-secondary btn-sm"
                        title={s.status === 'active' ? 'Nonaktifkan mata pelajaran' : 'Aktifkan mata pelajaran'}
                        style={{ color: s.status === 'active' ? 'var(--danger)' : 'var(--success)', opacity: togglingSubjectId === s.id ? 0.65 : 1 }}
                      >
                        {s.status === 'active' ? <Power size={14} /> : <CheckCircle2 size={14} />}
                        <span>{togglingSubjectId === s.id ? 'Memproses...' : s.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(s)}
                        disabled={deletingSubjectId === s.id || togglingSubjectId === s.id}
                        className="btn btn-secondary btn-sm"
                        title={`Hapus permanen ${s.name}`}
                        style={{ color: 'var(--danger)', opacity: deletingSubjectId === s.id ? 0.65 : 1 }}
                      >
                        <Trash2 size={14} />
                        <span>{deletingSubjectId === s.id ? 'Menghapus...' : 'Hapus'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{form.id ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}</h2>
              <button onClick={() => setShowModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Kode Mata Pelajaran</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: MAT-10 / BIN-11"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Matematika Peminatan X"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi (Opsional)</label>
                <textarea
                  className="form-control"
                  placeholder="Penjelasan ringkas kurikulum atau materi"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
