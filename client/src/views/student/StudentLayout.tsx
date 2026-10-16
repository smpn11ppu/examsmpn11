import React, { useState, lazy, Suspense } from 'react';
import { Header } from '../../components/Header';




import { Exam } from '../../types';

const StudentPortal = lazy(() => import('./StudentPortal').then(m => ({ default: m.StudentPortal })));
const PreExamScreen = lazy(() => import('./PreExamScreen').then(m => ({ default: m.PreExamScreen })));
const ExamWorkstation = lazy(() => import('./ExamWorkstation').then(m => ({ default: m.ExamWorkstation })));
const ExamResultScreen = lazy(() => import('./ExamResultScreen').then(m => ({ default: m.ExamResultScreen })));
export const StudentLayout: React.FC = () => {
  const [currentStage, setCurrentStage] = useState<'portal' | 'pre_exam' | 'workstation' | 'result'>('portal');
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeAttemptId, setActiveAttemptId] = useState<number | null>(null);

  const handleStartExam = (exam: Exam, resumeAttemptId?: number) => {
    setActiveExam(exam);
    if (resumeAttemptId) {
      setActiveAttemptId(resumeAttemptId);
      setCurrentStage('workstation');
    } else {
      setCurrentStage('pre_exam');
    }
  };

  const handleProceedToWorkstation = (attemptId: number) => {
    setActiveAttemptId(attemptId);
    setCurrentStage('workstation');
  };

  const handleFinishExam = (attemptId: number) => {
    setActiveAttemptId(attemptId);
    setCurrentStage('result');
  };

  const handleViewResult = (attemptId: number) => {
    setActiveAttemptId(attemptId);
    setCurrentStage('result');
  };

  const handleBackToPortal = () => {
    setActiveExam(null);
    setActiveAttemptId(null);
    setCurrentStage('portal');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Workstation has its own minimal distraction-free topbar, so only render Header in portal / pre-exam / result */}
      {currentStage !== 'workstation' && <Header />}

      <main style={{ flex: 1 }}>
        <Suspense fallback={<div role="status" aria-live="polite" style={{ padding: '1.5rem' }}>Memuat halaman...</div>}>
          {currentStage === 'portal' && (
            <StudentPortal
              onStartExam={handleStartExam}
              onViewResult={handleViewResult}
            />
          )}

          {currentStage === 'pre_exam' && activeExam && (
            <PreExamScreen
              exam={activeExam}
              onBack={handleBackToPortal}
              onProceedToWorkstation={handleProceedToWorkstation}
            />
          )}

          {currentStage === 'workstation' && activeAttemptId && (
            <ExamWorkstation
              attemptId={activeAttemptId}
              onFinishExam={handleFinishExam}
            />
          )}

          {currentStage === 'result' && activeAttemptId && (
            <ExamResultScreen
              attemptId={activeAttemptId}
              onBackToPortal={handleBackToPortal}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
};
