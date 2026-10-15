import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ClassItem, User } from '../../types';
import {
  Users, Layers, Plus, Upload, Search, Filter,
  KeyRound, Edit2, Trash2, Check, AlertCircle, FileSpreadsheet, Download
} from 'lucide-react';

export const ClassesAndStudents: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'classes'>('students');

  // Classes state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [classForm, setClassForm] = useState({ id: 0, code: '', name: '' });

  // Students state
  const [students, setStudents] = useState<User[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({ id: 0, username: '', full_name: '', class_id: '' });

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ successCount: number; errorCount: number; errors: any[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Status message
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/admin/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setClasses(json.classes);
      }
    } catch (_) {}
  };

  const fetchStudents = async () => {
    try {
      const query = new URLSearchParams();
      if (selectedClassId) query.append('class_id', selectedClassId);
      if (searchQuery) query.append('search', searchQuery);

      const res = await fetch(`/api/admin/students?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setStudents(json.students);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
    }
  }, [selectedClassId, searchQuery, activeTab]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Class Actions
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = classForm.id ? `/api/admin/classes/${classForm.id}` : '/api/admin/classes';
    const method = classForm.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(classForm)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        setShowClassModal(false);
        setClassForm({ id: 0, code: '', name: '' });
        fetchClasses();
      } else {
        showMsg(data.error || 'Gagal menyimpan kelas', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  // Student Actions
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = studentForm.id ? `/api/admin/students/${studentForm.id}` : '/api/admin/students';
    const method = studentForm.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(studentForm)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        setShowStudentModal(false);
        setStudentForm({ id: 0, username: '', full_name: '', class_id: '' });
        fetchStudents();
        fetchClasses();
      } else {
        showMsg(data.error || 'Gagal menyimpan data murid', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleDeleteStudent = async (student: User) => {
    const confirmed = confirm(
      `Hapus murid ${student.full_name} (${student.username})? Penghapusan permanen hanya diizinkan jika murid belum memiliki riwayat ujian. Jika sudah memiliki riwayat, sistem akan menolak penghapusan untuk melindungi nilai dan jawaban.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showMsg(data.message || 'Data murid berhasil dihapus.', 'success');
        await fetchStudents();
        await fetchClasses();
      } else {
        showMsg(data.error || 'Murid tidak dapat dihapus.', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleResetPassword = async (id: number, username: string) => {
    if (!confirm(`Reset password untuk murid ${username} ke "siswa11"? Siswa akan diwajibkan mengganti password saat login berikutnya.`)) return;

    try {
      const res = await fetch(`/api/admin/students/${id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(data.message, 'success');
        fetchStudents();
      } else {
        showMsg(data.error || 'Gagal reset password', 'error');
      }
    } catch (err: any) {
      showMsg('Error: ' + err.message, 'error');
    }
  };

  // Import Excel/CSV
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImportLoading(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      setImportLoading(false);
      if (res.ok) {
        setImportResult(data);
        fetchStudents();
        fetchClasses();
      } else {
        showMsg(data.error || 'Gagal mengimpor file', 'error');
      }
    } catch (err: any) {
      setImportLoading(false);
      showMsg('Error koneksi: ' + err.message, 'error');
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = 'data:text/csv;charset=utf-8,username,nama_lengkap,kode_kelas\nsiswa06,Rahmat Hidayat,X-IPA-1\nsiswa07,Nurul Annisa,X-IPS-1\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'template_import_murid.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in">
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Manajemen Murid & Kelas</h1>
          <p style={{ fontSize: '0.875rem' }}>Kelola daftar rombongan belajar (kelas), akun peserta didik, serta impor massal.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('students')}
            className={`btn btn-sm ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Users size={15} />
            <span>Daftar Murid</span>
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`btn btn-sm ${activeTab === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Layers size={15} />
            <span>Daftar Kelas</span>
          </button>
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
          {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* --- TAB 1: MURID --- */}
      {activeTab === 'students' && (
        <div>
          {/* Filter & Action bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.25rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Cari berdasarkan NIS / Nama murid..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="form-control"
                style={{ width: '180px' }}
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
              >
                <option value="">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={() => {
                  setImportFile(null);
                  setImportResult(null);
                  setShowImportModal(true);
                }}
                className="btn btn-secondary"
              >
                <Upload size={16} />
                <span>Impor Excel/CSV</span>
              </button>
              <button
                onClick={() => {
                  setStudentForm({ id: 0, username: '', full_name: '', class_id: '' });
                  setShowStudentModal(true);
                }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Tambah Murid</span>
              </button>
            </div>
          </div>

          {/* Students Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>No</th>
                  <th>Username / NIS</th>
                  <th>Nama Lengkap</th>
                  <th>Kelas</th>
                  <th>Status Akun</th>
                  <th>Wajib Ganti Password</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      Tidak ada data murid yang sesuai.
                    </td>
                  </tr>
                ) : (
                  students.map((s, idx) => (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.username}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                      <td>
                        {s.class_name ? (
                          <span className="badge badge-info">{s.class_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>Belum ada kelas</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                          {s.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        {s.must_change_password ? (
                          <span className="badge badge-warning">Ya (siswa11)</span>
                        ) : (
                          <span className="badge badge-success">Sudah Diganti</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleResetPassword(s.id, s.username)}
                            className="btn btn-secondary btn-sm"
                            title="Reset password ke 'siswa11'"
                          >
                            <KeyRound size={14} color="var(--warning)" />
                            <span>Reset</span>
                          </button>
                          <button
                            onClick={() => {
                              setStudentForm({
                                id: s.id,
                                username: s.username,
                                full_name: s.full_name,
                                class_id: s.class_id ? String(s.class_id) : ''
                              });
                              setShowStudentModal(true);
                            }}
                            className="btn btn-secondary btn-sm"
                            title="Edit Murid"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--danger)' }}
                            title="Hapus Murid"
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
        </div>
      )}

      {/* --- TAB 2: KELAS --- */}
      {activeTab === 'classes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
            <button
              onClick={() => {
                setClassForm({ id: 0, code: '', name: '' });
                setShowClassModal(true);
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Tambah Kelas Baru</span>
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>No</th>
                  <th>Kode Kelas</th>
                  <th>Nama Kelas</th>
                  <th>Jumlah Siswa</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c, idx) => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{c.code}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <span className="badge badge-primary">{c.student_count || 0} Siswa</span>
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {c.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setClassForm({ id: c.id, code: c.code, name: c.name });
                          setShowClassModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Edit2 size={14} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL ADD/EDIT STUDENT --- */}
      {showStudentModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div className="modal-header">
              <h2 className="modal-title">{studentForm.id ? 'Edit Data Murid' : 'Tambah Murid Baru'}</h2>
              <button onClick={() => setShowStudentModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleSaveStudent}>
              <div className="form-group">
                <label className="form-label">Username / NIS</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: siswa01 / 102938"
                  value={studentForm.username}
                  onChange={e => setStudentForm({ ...studentForm, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Lengkap Murid</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nama lengkap sesuai data sekolah"
                  value={studentForm.full_name}
                  onChange={e => setStudentForm({ ...studentForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kelas</label>
                <select
                  className="form-control"
                  value={studentForm.class_id}
                  onChange={e => setStudentForm({ ...studentForm, class_id: e.target.value })}
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {!studentForm.id && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '1.25rem'
                }}>
                  Password awal default adalah <strong>siswa11</strong>. Murid akan diwajibkan mengganti password saat login pertama kali.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowStudentModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ADD/EDIT CLASS --- */}
      {showClassModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{classForm.id ? 'Edit Kelas' : 'Tambah Kelas Baru'}</h2>
              <button onClick={() => setShowClassModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleSaveClass}>
              <div className="form-group">
                <label className="form-label">Kode Kelas</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: X-IPA-1 atau XII-MIPA-2"
                  value={classForm.code}
                  onChange={e => setClassForm({ ...classForm, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Kelas</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Kelas X IPA 1"
                  value={classForm.name}
                  onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowClassModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL BULK IMPORT EXCEL/CSV --- */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Impor Data Murid (Excel / CSV)</h2>
              <button onClick={() => setShowImportModal(false)} className="modal-close">&times;</button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Unggah file Spreadsheet (.xlsx / .csv) berisi daftar murid. Kolom yang didukung:
                <code> username</code>, <code>nama_lengkap</code>, dan <code>kode_kelas</code>.
              </p>
              <button onClick={downloadSampleCsv} className="btn btn-outline btn-sm">
                <Download size={14} />
                <span>Unduh Contoh Template CSV</span>
              </button>
            </div>

            <form onSubmit={handleImportSubmit}>
              <div style={{
                border: '2px dashed var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                textAlign: 'center',
                background: 'var(--bg-tertiary)',
                marginBottom: '1.25rem',
                cursor: 'pointer'
              }}>
                <FileSpreadsheet size={40} color="var(--primary)" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {importFile ? importFile.name : 'Pilih file .xlsx atau .csv'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Ukuran maksimal 5MB
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  required
                />
              </div>

              {importResult && (
                <div style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Hasil Impor:
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                    <span className="badge badge-success">{importResult.successCount} Berhasil</span>
                    <span className="badge badge-danger">{importResult.errorCount} Gagal</span>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem', color: 'var(--danger)' }}>
                      {importResult.errors.map((err, i) => (
                        <div key={i}>Baris {err.row}: {err.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowImportModal(false)} className="btn btn-secondary">
                  Tutup
                </button>
                <button type="submit" disabled={!importFile || importLoading} className="btn btn-primary">
                  {importLoading ? 'Memproses...' : 'Mulai Impor Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
