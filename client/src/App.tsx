import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './views/LoginView';
import { MandatoryPasswordChange } from './components/MandatoryPasswordChange';
import { AdminLayout } from './views/admin/AdminLayout';
import { StudentLayout } from './views/student/StudentLayout';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '44px',
            height: '44px',
            border: '3px solid var(--border-medium)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Memuat CBTKU...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <>
      {user.must_change_password && <MandatoryPasswordChange />}
      {user.role === 'admin' ? <AdminLayout /> : <StudentLayout />}
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
