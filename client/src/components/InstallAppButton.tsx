import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, Share, MoreVertical } from 'lucide-react';
import {
  canPromptInstallCBTKU,
  isCBTKUInstalled,
  promptInstallCBTKU
} from '../pwa';
import './InstallAppButton.css';

type InstallAppButtonProps = {
  variant?: 'header' | 'login';
};

function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({ variant = 'header' }) => {
  const [installed, setInstalled] = useState(isCBTKUInstalled());
  const [canInstall, setCanInstall] = useState(canPromptInstallCBTKU());
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const appleMobile = isAppleMobile();
  const android = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  useEffect(() => {
    const sync = () => {
      setInstalled(isCBTKUInstalled());
      setCanInstall(canPromptInstallCBTKU());
    };
    window.addEventListener('cbtku-pwa-state', sync);
    window.addEventListener('cbtku-pwa-installed', sync);
    sync();
    return () => {
      window.removeEventListener('cbtku-pwa-state', sync);
      window.removeEventListener('cbtku-pwa-installed', sync);
    };
  }, []);

  const handleInstall = async () => {
    if (canPromptInstallCBTKU()) {
      setInstalling(true);
      const result = await promptInstallCBTKU();
      setInstalling(false);
      setCanInstall(canPromptInstallCBTKU());
      if (result === 'accepted') {
        setInstalled(true);
        return;
      }
      if (result === 'dismissed') return;
    }
    setShowGuide(true);
  };

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        className={`pwa-install-button pwa-install-button--${variant}`}
        onClick={handleInstall}
        aria-label="Pasang CBTKU di layar utama"
        title="Pasang CBTKU di layar utama"
        disabled={installing}
      >
        <Download size={16} aria-hidden="true" />
        <span>{installing ? 'Menyiapkan…' : variant === 'login' ? 'Pasang CBTKU di HP' : 'Pasang aplikasi'}</span>
      </button>

      {showGuide && (
        <div
          className="pwa-install-overlay"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGuide(false); }}
        >
          <section className="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
            <button type="button" className="pwa-install-close" onClick={() => setShowGuide(false)} aria-label="Tutup petunjuk">
              <X size={18} />
            </button>
            <div className="pwa-install-dialog-icon"><Smartphone size={25} /></div>
            <h2 id="pwa-install-title">Pasang CBTKU di layar utama</h2>
            {appleMobile ? (
              <ol>
                <li>Buka CBTKU menggunakan <strong>Safari</strong>.</li>
                <li>Tekan tombol <strong>Bagikan</strong> <Share size={14} className="pwa-inline-icon" /> pada menu browser.</li>
                <li>Pilih <strong>Tambahkan ke Layar Utama</strong>, lalu tekan <strong>Tambahkan</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Buka CBTKU melalui <strong>Chrome</strong> di HP.</li>
                <li>Tekan menu tiga titik <MoreVertical size={14} className="pwa-inline-icon" /> di sudut browser.</li>
                <li>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>, lalu konfirmasi.</li>
              </ol>
            )}
            <p className="pwa-install-note">CBTKU tetap membutuhkan koneksi internet untuk login, memuat soal, menyimpan jawaban, memverifikasi token pengawas, dan mengumpulkan ujian. Mode pemasangan ini bukan APK native dan tidak membuat ujian bisa berjalan offline.</p>
            <button type="button" className="pwa-install-dismiss" onClick={() => setShowGuide(false)}>Mengerti</button>
          </section>
        </div>
      )}
    </>
  );
};
