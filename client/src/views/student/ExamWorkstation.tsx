import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Clock, CheckCircle2, AlertTriangle, ShieldAlert,
  ChevronLeft, ChevronRight, Bookmark, Send, WifiOff,
  Wifi, HelpCircle, ArrowRight, RotateCcw
} from 'lucide-react';

interface WorkstationProps {
  attemptId: number;
  onFinishExam: (attemptId: number) => void;
}

export const ExamWorkstation: React.FC<WorkstationProps> = ({ attemptId, onFinishExam }) => {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [examInfo, setExamInfo] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Student Answers state: { [qId]: { value: any, is_flagged: boolean, saved_at?: string } }
  const [answers, setAnswers] = useState<Record<number, { value: any; is_flagged: boolean }>>({});

  // Autosave status: 'idle' | 'saving' | 'saved' | 'offline'
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Server Synced Countdown Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Violation state & Modal
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [lastViolationMsg, setLastViolationMsg] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [unlockToken, setUnlockToken] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [lockSyncStatus, setLockSyncStatus] = useState<'idle' | 'syncing' | 'locked' | 'failed'>('idle');
  const violationLockRef = useRef(false);
  const violationPayloadRef = useRef<{ type: string; message: string } | null>(null);

  // Finish confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Debounce timer ref for autosave
  const autosaveTimeoutRef = useRef<any>(null);

  // 1. Fetch workstation data
  const fetchWorkstation = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/student/attempts/${attemptId}/workstation`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Gagal memuat ruang ujian.');
        onFinishExam(attemptId);
        return;
      }

      const data = await res.json();
      setExamInfo(data.attempt);
      setQuestions(data.questions || []);
      setRemainingSeconds(data.attempt.remaining_seconds || 0);
      setViolationCount(Number(data.attempt.violation_count) || 0);
      const lockStorageKey = `cbtku_lock_${attemptId}`;
      let storedLock: { type?: string; message?: string } | null = null;
      try {
        const rawLock = localStorage.getItem(lockStorageKey);
        if (rawLock) storedLock = JSON.parse(rawLock);
      } catch (_) {}

      if (data.attempt.status === 'locked') {
        violationLockRef.current = true;
        violationPayloadRef.current = storedLock ? {
          type: storedLock.type || 'restored_lock',
          message: storedLock.message || data.attempt.lock_message || 'Sesi ujian dikunci setelah pelanggaran integritas terdeteksi.'
        } : {
          type: 'restored_lock',
          message: data.attempt.lock_message || 'Sesi ujian dikunci setelah pelanggaran integritas terdeteksi.'
        };
        try { localStorage.setItem(lockStorageKey, JSON.stringify(violationPayloadRef.current)); } catch (_) {}
        setIsLocked(true);
        setShowViolationModal(true);
        setLockSyncStatus('locked');
        setLastViolationMsg(data.attempt.lock_message || storedLock?.message || 'Sesi ujian dikunci setelah pelanggaran integritas terdeteksi.');
      } else if (data.attempt.status === 'in_progress' && storedLock) {
        // A previous tab-switch lock is kept locally across reloads until server confirms it.
        // This closes the refresh-before-request-completes bypass.
        const payload = {
          type: storedLock.type || 'restored_lock',
          message: storedLock.message || 'Sesi tetap dikunci setelah halaman ujian ditinggalkan.'
        };
        violationPayloadRef.current = payload;
        violationLockRef.current = true;
        setIsLocked(true);
        setShowViolationModal(true);
        setLockSyncStatus('syncing');
        setLastViolationMsg(payload.message);
        await syncViolationLock(payload.type, payload.message);
      } else {
        if (data.attempt.status === 'submitted' || data.attempt.status === 'timed_out') {
          try { localStorage.removeItem(lockStorageKey); } catch (_) {}
        }
        violationLockRef.current = false;
        violationPayloadRef.current = null;
        setIsLocked(false);
        setShowViolationModal(false);
        setLockSyncStatus('idle');
      }

      // Restore saved answers from server + local storage fallback
      const localBackupKey = `cbtku_backup_${attemptId}`;
      let localBackup: any = {};
      try {
        const rawLocal = localStorage.getItem(localBackupKey);
        if (rawLocal) localBackup = JSON.parse(rawLocal);
      } catch (_) {}

      const mergedAnswers: Record<number, { value: any; is_flagged: boolean }> = {};
      data.questions.forEach((q: any) => {
        if (data.savedAnswers?.[q.id]) {
          mergedAnswers[q.id] = {
            value: data.savedAnswers[q.id].value,
            is_flagged: data.savedAnswers[q.id].is_flagged
          };
        } else if (localBackup[q.id]) {
          mergedAnswers[q.id] = localBackup[q.id];
        }
      });

      setAnswers(mergedAnswers);
      setAutosaveStatus('saved');
    } catch (err: any) {
      alert('Koneksi gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkstation();
  }, [attemptId]);

  // 2. Countdown Timer ticking every second
  useEffect(() => {
    if (loading || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, remainingSeconds]);

  // 3. Format HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 4. Autosave Engine with debounce
  const triggerAutosave = (qId: number, val: any, flagged: boolean) => {
    // A locked attempt cannot be edited or queued for another save.
    if (violationLockRef.current) return;
    // 1. Save immediately to LocalStorage as offline backup
    const updatedAnswers = {
      ...answers,
      [qId]: { value: val, is_flagged: flagged }
    };
    setAnswers(updatedAnswers);
    try {
      localStorage.setItem(`cbtku_backup_${attemptId}`, JSON.stringify(updatedAnswers));
    } catch (_) {}

    // 2. Debounce server sync
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);

    setAutosaveStatus('saving');

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/student/attempts/${attemptId}/autosave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question_id: qId, answer_value: val, is_flagged: flagged })
        });

        if (res.ok) {
          const data = await res.json();
          setAutosaveStatus('saved');
          setLastSavedTime(new Date(data.saved_at).toLocaleTimeString('id-ID'));
        } else {
          setAutosaveStatus('offline');
        }
      } catch (_) {
        setAutosaveStatus('offline');
      }
    }, 600);
  };

  // Persist lock server-side. The full-screen lock screen remains active if the request fails.
  const syncViolationLock = async (type: string, message: string) => {
    setLockSyncStatus('syncing');
    try {
      const res = await fetch(`/api/student/attempts/${attemptId}/violation`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          violation_type: type,
          message,
          metadata: { timestamp: new Date().toISOString(), url: window.location.href }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.locked !== true) {
        setLockSyncStatus('failed');
        setUnlockError(data.error || 'Server belum mengonfirmasi penguncian. Ujian tetap terkunci di perangkat; tekan Coba sinkronkan lagi.');
        return false;
      }
      setLockSyncStatus('locked');
      setUnlockError('');
      return true;
    } catch (_) {
      setLockSyncStatus('failed');
      setUnlockError('Koneksi ke server terputus. Ujian tetap terkunci di perangkat; periksa jaringan lalu coba sinkronkan lagi.');
      return false;
    }
  };

  // 5. Any focus/tab/fullscreen violation requires a supervisor recovery token.
  const recordViolation = async (type: string, message: string) => {
    // Multiple browser events can be raised for the same tab switch. Lock only once per cycle.
    if (violationLockRef.current) return;
    violationLockRef.current = true;
    violationPayloadRef.current = { type, message };
    try { localStorage.setItem(`cbtku_lock_${attemptId}`, JSON.stringify({ type, message })); } catch (_) {}
    setIsLocked(true);
    setViolationCount(prev => prev + 1);
    setLastViolationMsg(message);
    setUnlockError('');
    setUnlockToken('');
    setShowViolationModal(true);
    await syncViolationLock(type, message);
  };

  const retryViolationLock = async () => {
    const payload = violationPayloadRef.current;
    if (!payload) {
      setUnlockError('Status pelanggaran tidak tersedia. Hubungi pengawas untuk memeriksa sesi ini.');
      return;
    }
    await syncViolationLock(payload.type, payload.message);
  };

  const handleUnlockAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockToken.trim() || unlocking) return;
    if (lockSyncStatus !== 'locked') {
      setUnlockError('Tunggu sampai server mengonfirmasi bahwa ujian terkunci. Jika sinkronisasi gagal, tekan Coba sinkronkan lagi.');
      return;
    }
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch(`/api/student/attempts/${attemptId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: unlockToken.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.unlocked !== true) {
        setUnlockError(data.error || 'Token pemulihan ditolak. Minta token yang sedang aktif kepada pengawas.');
        return;
      }
      violationLockRef.current = false;
      violationPayloadRef.current = null;
      try { localStorage.removeItem(`cbtku_lock_${attemptId}`); } catch (_) {}
      setLockSyncStatus('idle');
      setIsLocked(false);
      setShowViolationModal(false);
      setUnlockToken('');
      setLastViolationMsg('');
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (err: any) {
      setUnlockError('Tidak dapat memverifikasi token: ' + (err?.message || 'koneksi gagal'));
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('tab_switch', 'Terdeteksi berpindah tab atau meminimalkan jendela ujian.');
      }
    };

    const handleWindowBlur = () => {
      recordViolation('window_blur', 'Jendela ujian kehilangan fokus (berpindah ke aplikasi lain).');
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('fullscreen_exit', 'Terdeteksi keluar dari mode layar penuh (fullscreen).');
      }
    };

    const handlePageHide = () => {
      recordViolation('page_hide', 'Halaman ujian ditinggalkan atau dinavigasi saat sesi berlangsung.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+C, Ctrl+V, Ctrl+U, F12, Alt+Tab if caught
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'a')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    const handleOnline = () => {
      // Never queue or replay answers while locked, even after network recovery.
      if (violationLockRef.current) return;
      // Re-sync all answers when internet connection is restored
      setAutosaveStatus('saving');
      Object.entries(answers).forEach(([qId, item]) => {
        fetch(`/api/student/attempts/${attemptId}/autosave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question_id: parseInt(qId), answer_value: item.value, is_flagged: item.is_flagged })
        }).catch(() => {});
      });
      setAutosaveStatus('saved');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('online', handleOnline);
    };
  }, [attemptId, answers]);

  // 6. Submit Actions
  const handleAutoSubmitTimeOut = async () => {
    if (violationLockRef.current) return;
    alert('Waktu ujian telah berakhir! Sistem otomatis mengumpulkan seluruh jawaban Anda.');
    try {
      await fetch(`/api/student/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (_) {}
    onFinishExam(attemptId);
  };

  const handleManualSubmit = async () => {
    if (violationLockRef.current) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubmitting(false);
      setShowSubmitModal(false);
      onFinishExam(attemptId);
    } catch (err: any) {
      setSubmitting(false);
      alert('Gagal mengumpulkan: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
        <p>Memuat lembar soal dan menyinkronkan status dengan server...</p>
      </div>
    );
  }

  // Render a standalone, full-viewport lock page instead of leaving the exam UI interactive underneath.
  // This is intentionally returned before all question controls are rendered.
  if (isLocked || showViolationModal) {
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="integrity-lock-title" style={{
        position: 'fixed', inset: 0, zIndex: 2147483000, background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        overflowY: 'auto', userSelect: 'none'
      }}>
        <div style={{ width: '100%', maxWidth: '520px', borderRadius: '1rem', padding: '2rem',
          background: 'var(--bg-secondary)', border: '1px solid var(--danger-border)',
          boxShadow: '0 20px 70px rgba(0,0,0,.35)', textAlign: 'center' }}>
          <ShieldAlert size={44} color="var(--danger)" style={{ marginBottom: '1rem' }} />
          <h1 id="integrity-lock-title" style={{ color: 'var(--danger)', fontSize: '1.35rem', marginBottom: '.75rem' }}>
            Ujian Dikunci — Perlu Token Pengawas
          </h1>
          <p style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>{lastViolationMsg || 'Pelanggaran integritas terdeteksi.'}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', marginBottom: '1.25rem' }}>
            Anda tidak dapat melihat atau mengerjakan soal, menyimpan jawaban, atau mengumpulkan ujian sampai pengawas memberikan token pemulihan yang masih aktif. Waktu ujian tetap berjalan.
          </p>
          {lockSyncStatus === 'syncing' && <p role="status" style={{ color: 'var(--warning)' }}>Mengunci sesi di server...</p>}
          {lockSyncStatus === 'failed' && <button type="button" onClick={retryViolationLock} className="btn btn-secondary" style={{ width: '100%', marginBottom: '1rem' }}>Coba sinkronkan kunci ke server</button>}
          {unlockError && <div role="alert" style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: '1rem' }}>{unlockError}</div>}
          {lockSyncStatus === 'locked' && (
            <form onSubmit={handleUnlockAttempt}>
              <label htmlFor="supervisor-recovery-token" className="form-label" style={{ display: 'block', textAlign: 'left' }}>Token pemulihan dari pengawas</label>
              <input id="supervisor-recovery-token" type="text" className="form-control" value={unlockToken}
                onChange={e => setUnlockToken(e.target.value.replace(/\s+/g, '').slice(0, 6).toUpperCase())}
                placeholder="Masukkan 6 digit token" maxLength={6} autoComplete="one-time-code" autoFocus disabled={unlocking}
                style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '1.35rem', letterSpacing: '.3em', marginBottom: '.75rem' }} />
              <button type="submit" disabled={unlocking || unlockToken.trim().length !== 6} className="btn btn-primary" style={{ width: '100%' }}>
                {unlocking ? 'Memverifikasi token...' : 'Verifikasi token & lanjutkan'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  if (!currentQ) return <div>Soal tidak tersedia.</div>;

  const currentAnswer = answers[currentQ.id]?.value;
  const isFlagged = Boolean(answers[currentQ.id]?.is_flagged);

  // Statistics for submission modal
  let answeredCount = 0;
  let flaggedCount = 0;
  questions.forEach(q => {
    const a = answers[q.id];
    if (a && a.value !== undefined && a.value !== null && a.value !== '' && (Array.isArray(a.value) ? a.value.length > 0 : true)) {
      answeredCount++;
    }
    if (a?.is_flagged) flaggedCount++;
  });
  const unansweredCount = questions.length - answeredCount;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      userSelect: 'none'
    }}>
      {/* Top Workstation Header Bar */}
      <header style={{
        padding: '0.75rem 1.75rem',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
              {examInfo?.exam_title}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {examInfo?.subject_name} &bull; Soal {currentIndex + 1} dari {questions.length}
            </div>
          </div>
        </div>

        {/* Center: Autosave Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {autosaveStatus === 'saving' && (
            <div className="autosave-pill autosave-saving">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', animation: 'spin 1s infinite' }} />
              <span>Menyimpan...</span>
            </div>
          )}
          {autosaveStatus === 'saved' && (
            <div className="autosave-pill autosave-saved">
              <CheckCircle2 size={13} color="var(--success)" />
              <span>Tersimpan {lastSavedTime ? `(${lastSavedTime})` : 'di server'}</span>
            </div>
          )}
          {autosaveStatus === 'offline' && (
            <div className="autosave-pill autosave-offline" title="Jawaban aman tersimpan di perangkat lokal dan akan disinkronkan saat terhubung">
              <WifiOff size={13} color="var(--danger)" />
              <span>Offline (Disimpan Lokal)</span>
            </div>
          )}
        </div>

        {/* Right: Server Countdown Timer & Finish Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className={`timer-box ${remainingSeconds < 300 ? 'urgent' : ''}`} title="Waktu tersisa divalidasi oleh server">
            <Clock size={18} color={remainingSeconds < 300 ? 'var(--danger)' : 'var(--primary)'} />
            <span>{formatTime(remainingSeconds)}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 700 }}
          >
            <Send size={14} />
            <span>Kumpulkan Ujian</span>
          </button>
        </div>
      </header>

      {/* Main Examination Layout: Question View + Side Navigator */}
      <div style={{
        flex: 1,
        display: 'flex',
        padding: '1.5rem',
        gap: '1.5rem',
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Left: Question Card & Answering Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="glass-panel" style={{
            flex: 1,
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            {/* Question Header */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-gradient)',
                    color: '#ffffff',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem'
                  }}>
                    {currentIndex + 1}
                  </span>
                  <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                    {currentQ.type.replace('_', ' ')}
                  </span>
                </div>

                {/* Flag Question (Ragu-ragu) */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  background: isFlagged ? 'var(--warning-bg)' : 'var(--bg-tertiary)',
                  border: `1px solid ${isFlagged ? 'var(--warning-border)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="checkbox"
                    checked={isFlagged}
                    onChange={e => triggerAutosave(currentQ.id, currentAnswer, e.target.checked)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <Bookmark size={14} color={isFlagged ? 'var(--warning)' : 'var(--text-muted)'} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isFlagged ? 'var(--warning)' : 'var(--text-muted)' }}>
                    Ragu-ragu
                  </span>
                </label>
              </div>

              {/* Question Text */}
              <div style={{
                fontSize: '1.125rem',
                lineHeight: 1.6,
                fontWeight: 600,
                color: 'var(--text-main)',
                marginBottom: '1.5rem',
                whiteSpace: 'pre-wrap'
              }}>
                {currentQ.question_text}
              </div>

              {/* Optional Question Image */}
              {currentQ.image_url && (
                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <img
                    src={currentQ.image_url}
                    alt="Ilustrasi soal"
                    style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
              )}

              {/* Interactive Answering Area per Question Type */}

              {/* 1. SINGLE CHOICE (Pilihan Ganda) */}
              {currentQ.type === 'single_choice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {currentQ.options?.map((opt: any) => {
                    const isSelected = String(currentAnswer) === String(opt.option_key);
                    return (
                      <div
                        key={opt.id || opt.option_key}
                        className={`option-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => triggerAutosave(currentQ.id, opt.option_key, isFlagged)}
                      >
                        <div className="option-badge">{opt.display_key || opt.option_key}</div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', paddingTop: '2px' }}>
                          {opt.option_text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. MULTIPLE CHOICE (Pilihan Ganda Kompleks) */}
              {currentQ.type === 'multiple_choice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    * Anda dapat memilih lebih dari satu jawaban yang benar:
                  </div>
                  {currentQ.options?.map((opt: any) => {
                    const selectedList: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
                    const isSelected = selectedList.includes(opt.option_key);

                    return (
                      <div
                        key={opt.id || opt.option_key}
                        className={`option-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          let nextList: string[];
                          if (isSelected) nextList = selectedList.filter(k => k !== opt.option_key);
                          else nextList = [...selectedList, opt.option_key];
                          triggerAutosave(currentQ.id, nextList, isFlagged);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{ width: '18px', height: '18px', marginTop: '4px', cursor: 'pointer' }}
                        />
                        <div style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          {opt.option_text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. TRUE / FALSE (Benar / Salah) */}
              {currentQ.type === 'true_false' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div
                    className={`option-item ${currentAnswer === 'true' ? 'selected' : ''}`}
                    onClick={() => triggerAutosave(currentQ.id, 'true', isFlagged)}
                    style={{ justifyContent: 'center', padding: '1.25rem', textAlign: 'center' }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>
                      BENAR (True)
                    </span>
                  </div>

                  <div
                    className={`option-item ${currentAnswer === 'false' ? 'selected' : ''}`}
                    onClick={() => triggerAutosave(currentQ.id, 'false', isFlagged)}
                    style={{ justifyContent: 'center', padding: '1.25rem', textAlign: 'center' }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>
                      SALAH (False)
                    </span>
                  </div>
                </div>
              )}

              {/* 4. MATCHING (Menjodohkan) */}
              {currentQ.type === 'matching' && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Pasangkan setiap premis di kolom kiri dengan target pilihan yang sesuai di sebelah kanan:
                  </div>

                  {(() => {
                    // Collect options or keys
                    const matchingMap: Record<string, string> = (typeof currentAnswer === 'object' && currentAnswer !== null) ? currentAnswer : {};
                    // Premise pairs from question options or keys
                    const premiseList = ['Mitokondria', 'Ribosom', 'Nukleus'];
                    const targetChoices = ['Respirasi Sel & Energi', 'Sintesis Protein', 'Pusat Pengendali Genetik', 'Pencernaan Intraseluler'];

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {premiseList.map((premise, pIdx) => (
                          <div key={pIdx} className="matching-pair-row">
                            <div style={{
                              padding: '0.65rem 0.85rem',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-tertiary)',
                              fontWeight: 600,
                              fontSize: '0.875rem'
                            }}>
                              {premise}
                            </div>
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              <ArrowRight size={16} />
                            </div>
                            <select
                              className="form-control"
                              value={matchingMap[premise] || ''}
                              onChange={e => {
                                const nextPairs = { ...matchingMap, [premise]: e.target.value };
                                triggerAutosave(currentQ.id, nextPairs, isFlagged);
                              }}
                            >
                              <option value="">-- Pilih Pasangan --</option>
                              {targetChoices.map((choice, cIdx) => (
                                <option key={cIdx} value={choice}>{choice}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 5. ESSAY (Esai) */}
              {currentQ.type === 'essay' && (
                <div style={{ marginTop: '1rem' }}>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '180px', fontSize: '0.95rem', lineHeight: 1.6 }}
                    placeholder="Tuliskan lembar jawaban esai Anda di sini secara runut dan jelas..."
                    value={currentAnswer || ''}
                    onChange={e => triggerAutosave(currentQ.id, e.target.value, isFlagged)}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.4rem', textAlign: 'right' }}>
                    {currentAnswer ? String(currentAnswer).trim().split(/\s+/).filter(Boolean).length : 0} Kata
                  </div>
                </div>
              )}
            </div>

            {/* Question Navigation Controls (Bawah) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '2.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="btn btn-secondary"
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </button>

              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {currentIndex + 1} / {questions.length}
              </span>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="btn btn-primary"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="btn btn-success"
                >
                  <span>Kumpulkan Ujian</span>
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Right Sidebar: Number Grid Navigation */}
        <aside style={{ width: '280px', flexShrink: 0 }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Navigasi Soal
            </h3>

            {/* Legend */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.4rem',
              fontSize: '0.7rem',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#059669' }} />
                <span>Sudah Dijawab</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#d97706' }} />
                <span>Ragu-ragu</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }} />
                <span>Belum Dijawab</span>
              </div>
            </div>

            {/* Grid of numbers */}
            <div className="question-nav-grid" style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
              {questions.map((q, idx) => {
                const ansObj = answers[q.id];
                const hasAnswer = ansObj && ansObj.value !== undefined && ansObj.value !== null && ansObj.value !== '' && (Array.isArray(ansObj.value) ? ansObj.value.length > 0 : true);
                const flagged = Boolean(ansObj?.is_flagged);
                const isActive = currentIndex === idx;

                let statusClass = 'unanswered';
                if (flagged) statusClass = 'flagged';
                else if (hasAnswer) statusClass = 'answered';

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`nav-btn ${statusClass} ${isActive ? 'active' : ''}`}
                  >
                    <span>{idx + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* --- INTEGRITY VIOLATION MODAL --- */}
      {showViolationModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '460px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--danger-bg)',
              border: '2px solid var(--danger-border)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <ShieldAlert size={30} color="var(--danger)" />
            </div>

            <h2 style={{ fontSize: '1.25rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
              Peringatan Integritas Ujian!
            </h2>

            <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
              {lastViolationMsg}
            </p>

            <div style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-tertiary)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: '1rem'
            }}>
              Ujian terkunci. Kejadian ini dicatat sebagai <strong>Pelanggaran #{violationCount}</strong>. Anda tidak dapat melanjutkan atau menyimpan jawaban sampai pengawas ruangan memberikan token pemulihan yang masih aktif.
            </div>

            <form onSubmit={handleUnlockAttempt}>
              <label className="form-label" htmlFor="supervisor-recovery-token" style={{ textAlign: 'left', display: 'block' }}>
                Token pemulihan dari pengawas
              </label>
              <input
                id="supervisor-recovery-token"
                type="text"
                className="form-control"
                value={unlockToken}
                onChange={e => setUnlockToken(e.target.value.replace(/\s+/g, '').slice(0, 6))}
                placeholder="6 digit token"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                disabled={unlocking}
                style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '1.35rem', letterSpacing: '0.3em', marginBottom: '0.75rem' }}
              />
              {unlockError && <div role="alert" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{unlockError}</div>}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1rem' }}>
                Token berubah otomatis sesuai interval yang ditetapkan administrator. Jika token sudah berubah, minta kode terbaru kepada pengawas.
              </p>
              <button type="submit" disabled={unlocking || unlockToken.trim().length !== 6} className="btn btn-primary" style={{ width: '100%' }}>
                {unlocking ? 'Memverifikasi token...' : 'Verifikasi & Buka Kunci Ujian'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SUBMIT CONFIRMATION MODAL --- */}
      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Konfirmasi Selesai Ujian</h2>
              <button onClick={() => setShowSubmitModal(false)} className="modal-close">&times;</button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                Apakah Anda yakin ingin mengakhiri sesi pengerjaan ujian ini? Periksa kembali rekapitulasi jawaban Anda:
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                textAlign: 'center',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{answeredCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sudah Dijawab</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>{flaggedCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ragu-ragu</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: unansweredCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{unansweredCount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Belum Dijawab</div>
                </div>
              </div>

              {unansweredCount > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--danger)',
                  marginTop: '1rem'
                }}>
                  <AlertTriangle size={16} />
                  <span>Masih terdapat {unansweredCount} butir soal yang belum dijawab.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowSubmitModal(false)} className="btn btn-secondary">
                Kembali Mengerjakan
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? 'Mengumpulkan...' : 'Ya, Kumpulkan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
