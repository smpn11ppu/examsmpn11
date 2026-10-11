import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuditLog } from '../../types';
import { Layers, Search, Shield, Clock } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/admin/audit-logs${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || []);
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search]);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Audit Aktivitas Administratif</h1>
          <p style={{ fontSize: '0.875rem' }}>
            Rekaman jejak seluruh tindakan penting admin, perubahan jadwal, reset password, dan rilis token.
          </p>
        </div>

        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Cari aktivitas atau username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>No</th>
              <th>Waktu</th>
              <th>Pelaksana</th>
              <th>Jenis Tindakan</th>
              <th>Rincian Aktivitas</th>
              <th>Alamat IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
                  Tidak ada rekam jejak audit ditemukan.
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr key={log.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('id-ID')}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{log.username || 'System'}</span>
                  </td>
                  <td>
                    <span className="badge badge-primary">{log.action}</span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{log.details}</td>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
