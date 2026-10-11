import React, { useState } from 'react';
import { Header } from '../../components/Header';
import { AdminDashboard } from './AdminDashboard';
import { ClassesAndStudents } from './ClassesAndStudents';
import { SubjectsView } from './SubjectsView';
import { QuestionBankView } from './QuestionBankView';
import { ExamsManagementView } from './ExamsManagementView';
import { LiveProctorView } from './LiveProctorView';
import { GradingAndResultsView } from './GradingAndResultsView';
import { SebConfigView } from './SebConfigView';
import { AuditLogsView } from './AuditLogsView';
import {
  LayoutDashboard, Users, BookOpen, HelpCircle,
  FileText, Radio, Award, Shield, Layers
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [proctorExamId, setProctorExamId] = useState<number | undefined>(undefined);

  const handleNavigateToProctor = (examId: number) => {
    setProctorExamId(examId);
    setActiveTab('proctor');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', padding: '0.5rem 0.85rem' }}>
            Menu Utama
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div
              className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={17} />
              <span>Dashboard</span>
            </div>

            <div
              className={`nav-link ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <Users size={17} />
              <span>Murid & Kelas</span>
            </div>

            <div
              className={`nav-link ${activeTab === 'subjects' ? 'active' : ''}`}
              onClick={() => setActiveTab('subjects')}
            >
              <BookOpen size={17} />
              <span>Mata Pelajaran</span>
            </div>

            <div
              className={`nav-link ${activeTab === 'questions' ? 'active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              <HelpCircle size={17} />
              <span>Bank Soal (5 Tipe)</span>
            </div>

            <div
              className={`nav-link ${activeTab === 'exams' ? 'active' : ''}`}
              onClick={() => setActiveTab('exams')}
            >
              <FileText size={17} />
              <span>Jadwal & Token</span>
            </div>
          </nav>

          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', padding: '1.25rem 0.85rem 0.5rem' }}>
            Pengawasan & Hasil
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div
              className={`nav-link ${activeTab === 'proctor' ? 'active' : ''}`}
              onClick={() => {
                setProctorExamId(undefined);
                setActiveTab('proctor');
              }}
            >
              <Radio size={17} color={activeTab === 'proctor' ? '#fff' : 'var(--danger)'} />
              <span>Live Proctoring</span>
            </div>

            <div
              className={`nav-link ${activeTab === 'grading' ? 'active' : ''}`}
              onClick={() => setActiveTab('grading')}
            >
              <Award size={17} />
              <span>Koreksi & Nilai</span>
            </div>

            <div
              className={`nav-link ${activeTab === 'seb' ? 'active' : ''}`}
              onClick={() => setActiveTab('seb')}
            >
              <Shield size={17} />
              <span>Konfigurasi SEB</span>
            </div>

            <div
              className={`nav-link ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              <Layers size={17} />
              <span>Audit Trail</span>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
          {activeTab === 'students' && <ClassesAndStudents />}
          {activeTab === 'subjects' && <SubjectsView />}
          {activeTab === 'questions' && <QuestionBankView />}
          {activeTab === 'exams' && <ExamsManagementView onNavigateToProctor={handleNavigateToProctor} />}
          {activeTab === 'proctor' && <LiveProctorView initialExamId={proctorExamId} />}
          {activeTab === 'grading' && <GradingAndResultsView />}
          {activeTab === 'seb' && <SebConfigView />}
          {activeTab === 'audit' && <AuditLogsView />}
        </main>
      </div>
    </div>
  );
};
