import React from 'react';
import { Shield, Download, CheckCircle2, AlertTriangle, Key, ExternalLink } from 'lucide-react';

export const SebConfigView: React.FC = () => {
  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Konfigurasi Safe Exam Browser (SEB)</h1>
        <p style={{ fontSize: '0.875rem' }}>
          Panduan integrasi lingkungan aman untuk mencegah perpindahan aplikasi dan pembukaan browser luar selama ujian.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Shield size={26} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>Unduh Berkas Konfigurasi (.seb)</h2>
            <p style={{ fontSize: '0.875rem' }}>
              File konfigurasi ini dapat dibuka langsung oleh murid atau dipasang di komputer laboratorium sekolah. Aplikasi SEB akan otomatis membuka portal CBTKU dalam mode terkunci (kiosk mode).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a
            href="/api/admin/seb/generate-config"
            download="CBTKU_Default_Config.seb"
            className="btn btn-primary"
          >
            <Download size={16} />
            <span>Unduh File SEB (Client Default)</span>
          </a>

          <a
            href="https://safeexambrowser.org/download_en.html"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
          >
            <ExternalLink size={16} />
            <span>Website Resmi Safe Exam Browser</span>
          </a>
        </div>
      </div>

      {/* Security explanation checklist */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={18} color="var(--success)" />
            <h3 style={{ fontSize: '1rem' }}>Fitur Penguncian SEB</h3>
          </div>
          <ul style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.7, paddingLeft: '1.2rem' }}>
            <li>Menonaktifkan pintasan tombol (Alt+Tab, Windows Key, Ctrl+Esc).</li>
            <li>Memblokir tangkapan layar (Print Screen / Snipping Tool).</li>
            <li>Mengunci navigasi hanya ke domain server CBTKU.</li>
            <li>Mencegah pembukaan aplikasi lain di latar belakang.</li>
          </ul>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <h3 style={{ fontSize: '1rem' }}>Mode Browser Biasa</h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Jika ujian diatur menggunakan mode Browser Biasa, sistem CBTKU tetap aktif mendeteksi perpindahan tab, kehilangan fokus, dan fullscreen exit. Catatan tersebut dicatat di server sebagai log integritas untuk peninjauan pengawas.
          </p>
        </div>
      </div>
    </div>
  );
};
