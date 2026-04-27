export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  subject: string;
  title: string;
  description: string;
  deadline: string;
  tasks: SubTask[];
  progress: number;
  status: 'active' | 'completed' | 'overdue';
}

export interface Note {
  id: string;
  goalId?: string;
  title: string;
  content: string;
  type: 'text' | 'pdf' | 'video';
  url?: string;
  createdAt: string;
}

export interface StudyLog {
  date: string;
  minutes: number;
}

export interface UserStats {
  streak: number;
  totalPoints: number;
  badges: string[];
  lastStudyDate: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  score?: number;
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'goal' | 'note' | 'quiz' | 'info';
  createdAt: string;
  read: boolean;
}