import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import './Header.css';
import { InstallAppButton } from './InstallAppButton';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = (localStorage.getItem('cbtku_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('cbtku_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <header className="school-app-header">
      <div className="school-app-brand">
        <span className="school-app-logo-frame">
          <img src="/logo-smpn11-ppu.jpg" alt="" className="school-app-logo" />
        </span>
        <div className="school-app-brand-copy">
          <span className="school-app-brand-name">SMP Negeri 11 PPU</span>
          <span className="school-app-brand-caption">Portal Ujian Sekolah</span>
        </div>
      </div>

      <div className="school-app-header-actions">
        <InstallAppButton variant="header" />
        {user && (
          <div className="school-app-user-chip">
            <span className="school-app-user-avatar"><UserIcon size={15} aria-hidden="true" /></span>
            <span className="school-app-user-copy">
              <span className="school-app-user-name">{user.full_name}</span>
              <span className="school-app-user-role">{user.role === 'admin' ? 'Administrator' : (user.class_name ? `Siswa (${user.class_name})` : 'Siswa')}</span>
            </span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="school-app-icon-button"
          title={`Ubah ke ${theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}`}
          aria-label={`Ubah ke ${theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {user && (
          <button onClick={logout} className="school-app-logout" title="Keluar dari akun">
            <LogOut size={15} aria-hidden="true" />
            <span>Keluar</span>
          </button>
        )}
      </div>
    </header>
  );
};
