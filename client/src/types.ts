export type UserRole = 'admin' | 'student';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  class_id?: number | null;
  class_name?: string | null;
  status?: string;
  must_change_password: boolean;
}

export interface ClassItem {
  id: number;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  student_count?: number;
  created_at?: string;
}

export interface SubjectItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'essay' | 'matching' | 'true_false';

export interface QuestionOption {
  id?: number;
  option_key: string;
  option_text: string;
  image_url?: string | null;
  order_num?: number;
  display_key?: string;
}

export interface Question {
  id: number;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  type: QuestionType;
  question_text: string;
  image_url?: string | null;
  weight: number;
  answer_key: string;
  rubric?: string | null;
  status: 'active' | 'inactive';
  options?: QuestionOption[];
}

export interface Exam {
  id: number;
  title: string;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  instructions?: string;
  target_classes: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  max_attempts: number;
  security_mode: 'standard' | 'seb';
  shuffle_questions: number | boolean;
  shuffle_options: number | boolean;
  publish_score: 'immediate' | 'manual';
  status: 'draft' | 'published' | 'archived';
  question_count?: number;
  attempt_count?: number;
  active_token?: string;
  isUpcoming?: boolean;
  isOngoing?: boolean;
  isPast?: boolean;
  attempts?: ExamAttempt[];
  activeAttempt?: ExamAttempt | null;
  attemptCount?: number;
}

export interface ExamToken {
  id: number;
  exam_id: number;
  token: string;
  valid_from: string;
  valid_until: string;
  max_usage: number;
  usage_count: number;
  status: 'active' | 'revoked' | 'expired';
}

export interface ExamAttempt {
  id: number;
  exam_id: number;
  user_id: number;
  student_name?: string;
  student_username?: string;
  class_name?: string;
  attempt_number: number;
  started_at: string;
  submitted_at?: string | null;
  server_end_time: string;
  status: 'in_progress' | 'submitted' | 'timed_out' | 'locked';
  ip_address?: string;
  user_agent?: string;
  is_seb?: number;
  violation_count?: number;
  last_autosave_at?: string;
  total_score?: number;
  is_published?: number;
}

export interface ViolationLog {
  id: number;
  attempt_id: number;
  user_id: number;
  student_name?: string;
  student_username?: string;
  class_name?: string;
  exam_title?: string;
  violation_type: string;
  message: string;
  metadata?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  details: string;
  ip_address?: string;
  created_at: string;
}
