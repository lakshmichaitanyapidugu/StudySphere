/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Login from './pages/Login';
import { User } from './types';
import {
  LayoutDashboard, 
  Target, 
  BookOpen, 
  MessageSquare, 
  BrainCircuit, 
  BarChart3, 
  Flame, 
  Bell, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  ChevronRight,
  Trash2,
  ExternalLink,
  Send,
  Trophy,
  Calendar,
  Sun,
  Wand2,
  X,
  Upload,
  CloudUpload,
  Image as ImageIcon,
  Info,
  FileText,
  History,
  Sparkles,
  XCircle,
  ChevronLeft,
  ChevronLeft as BackIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import Markdown from 'react-markdown';
import { format, isToday, subDays, startOfToday, parse } from 'date-fns';
import { cn } from './lib/utils';
import { Goal, Note, StudyLog, UserStats, Quiz, QuizQuestion, Notification } from './types';
import { getDoubtCleared, generateQuizFromNotes, getSummary, getQuizInsights } from './services/gemini';
import { api } from './services/api';
import logo from './assets/logo-v2.png'; // Updated for cache busting

// --- Mock Data Initialization ---
const INITIAL_STATS: UserStats = {
  streak: 5,
  totalPoints: 1250,
  badges: ['Early Bird', 'Consistency King'],
  lastStudyDate: startOfToday().toISOString(),
};

const INITIAL_LOGS: StudyLog[] = Array.from({ length: 7 }).map((_, i) => ({
  date: format(subDays(new Date(), 6 - i), 'MMM dd'),
  minutes: Math.floor(Math.random() * 120) + 30,
}));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'goals' | 'notes' | 'summarizer' | 'chat' | 'quiz'>('dashboard');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [logs, setLogs] = useState<StudyLog[]>(INITIAL_LOGS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ss_theme');
      if (saved) return saved as 'light' | 'dark' | 'system';
    }
    return 'system';
  });
  const [activityMap, setActivityMap] = useState<Map<string, number>>(() => {
    const saved = localStorage.getItem('ss_activity');
    return saved ? new Map(JSON.parse(saved)) : new Map();
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('ss_token');
    if (!token) {
      setIsLoadingSession(false);
      return;
    }
    api.auth.me().then(data => {
      setUser(data.user);
      setSessionStartTime(Date.now());
    }).catch(() => {
      localStorage.removeItem('ss_token');
    }).finally(() => {
      setIsLoadingSession(false);
    });
  }, []);

  // Load all user data from the API on login
  useEffect(() => {
    if (!user || dataLoaded) return;
    Promise.all([
      api.goals.list(),
      api.notes.list(),
      api.stats.get(),
      api.activity.get(),
      api.notifications.list(),
      api.quizzes.list(),
    ]).then(([goalsData, notesData, statsData, activityData, notificationsData, quizzesData]) => {
      setGoals(goalsData.map((g: any) => ({ ...g, tasks: g.tasks || [] })));
      // Map DB column names to frontend expected names
      setNotes(notesData.map((n: any) => ({ ...n, goalId: n.goal_id, createdAt: n.created_at })));
      const mappedStats: UserStats = {
        streak: statsData.streak,
        totalPoints: statsData.totalPoints,
        badges: statsData.badges,
        lastStudyDate: statsData.lastStudyDate,
      };
      setStats(mappedStats);
      
      const activityObj = activityData.map || activityData || {};
      const newMap = new Map<string, number>();
      for (const [key, value] of Object.entries(activityObj)) {
        if (typeof value === 'number') {
           newMap.set(key, value);
        }
      }
      setActivityMap(newMap);
      
      if (activityData.logs && activityData.logs.length > 0) {
        const formattedLogs = activityData.logs.map((L: any) => {
          const d = new Date(L.date);
          return {
            date: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
            minutes: L.minutes
          };
        }).reverse().slice(-7);
        setLogs(formattedLogs);
      }
      
      setNotifications(notificationsData.map((n: any) => ({ ...n, createdAt: n.created_at, read: !!n.read })));
      setQuizzes(quizzesData.map((q: any) => ({ ...q, date: new Date(q.createdAt) })));
      setDataLoaded(true);
    }).catch(console.error);
  }, [user, dataLoaded]);

  const handleLogin = (userData: { id: number; username: string; email: string }) => {
    setUser(userData as any);
    setDataLoaded(false); // Trigger reload
    setSessionStartTime(Date.now());
  };

  // apply theme class to root
  useEffect(() => {
    const root = document.documentElement;
    let isDark = theme === 'dark';
    if (theme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (isDark) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('ss_theme', theme);
  }, [theme]);

  // Load from localStorage
  useEffect(() => {
    const savedGoals = localStorage.getItem('ss_goals');
    const savedNotes = localStorage.getItem('ss_notes');
    const savedStats = localStorage.getItem('ss_stats');
    if (savedGoals) setGoals(JSON.parse(savedGoals));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedStats) setStats(JSON.parse(savedStats));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('ss_stats', JSON.stringify(stats));
  }, [stats]);

  const addNotification = (title: string, message: string, type: Notification['type']) => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      type,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 20));
    api.notifications.create(newNotif).catch(console.error);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    api.notifications.markRead(id).catch(console.error);
  };

  const clearNotifications = () => {
    setNotifications([]);
    api.notifications.clearAll().catch(console.error);
  };

  const hasUnread = useMemo(() => notifications.some(n => !n.read), [notifications]);

  const logActivity = (minutes: number = 0) => {
    const today = new Date().toISOString().split('T')[0];
    setActivityMap(prev => {
      const newMap = new Map(prev);
      const count = newMap.get(today) || 0;
      newMap.set(today, count + 1);
      return newMap;
    });

    if (minutes > 0) {
      setLogs(prev => {
        const formattedToday = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        const last = prev[prev.length - 1];
        if (last && last.date === formattedToday) {
          return [...prev.slice(0, -1), { ...last, minutes: last.minutes + minutes }];
        }
        const updated = [...prev, { date: formattedToday, minutes }];
        return updated.slice(-7);
      });
    }

    api.activity.log(minutes).then((res: any) => {
      if (res && res.streak !== undefined) {
        setStats(prev => ({
          ...prev,
          streak: res.streak,
          totalPoints: res.totalPoints || prev.totalPoints
        }));
      }
    }).catch(console.error);
  };

  const addGoal = (newGoal: Omit<Goal, 'id' | 'progress' | 'status'>) => {
    logActivity(5);
    const goal: Goal = {
      ...newGoal,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'active',
    };
    setGoals(prev => [...prev, goal]);
    addNotification('Goal Created!', `Your new goal "${goal.title}" has been set.`, 'goal');
    api.goals.create(goal).catch(console.error);
  };

  const toggleTask = (goalId: string, taskId: string) => {
    logActivity(2);
    setGoals(prev => prev.map(g => {
      if (g.id === goalId) {
        const newTasks = g.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
        const completedCount = newTasks.filter(t => t.completed).length;
        const progress = Math.round((completedCount / newTasks.length) * 100);
        const updated = { ...g, tasks: newTasks, progress, status: (progress === 100 ? 'completed' : 'active') as Goal['status'] };
        api.goals.update(goalId, updated).catch(console.error);
        return updated;
      }
      return g;
    }));
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
    api.goals.delete(id).catch(console.error);
  };

  const completeGoal = (id: string) => {
    logActivity(15);
    setGoals(prev => prev.map(g => {
      if (g.id === id) {
        const isNowCompleted = g.status !== 'completed';
        const updated = {
          ...g,
          status: (isNowCompleted ? 'completed' : 'active') as Goal['status'],
          progress: isNowCompleted ? 100 : (g.tasks.length > 0 ? Math.round((g.tasks.filter(t => t.completed).length / g.tasks.length) * 100) : 0),
          tasks: isNowCompleted ? g.tasks.map(t => ({ ...t, completed: true })) : g.tasks
        };
        api.goals.update(id, updated).catch(console.error);
        return updated;
      }
      return g;
    }));
    const goal = goals.find(g => g.id === id);
    if (goal && goal.status !== 'completed') {
      addNotification('Goal Completed!', `You've finished "${goal.title}". Great work!`, 'goal');
    }
  };

  const addNote = (newNote: Omit<Note, 'id' | 'createdAt'>) => {
    logActivity(5);
    const note: Note = {
      ...newNote,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => [...prev, note]);
    addNotification('Note Added!', `"${note.title}" has been added to your materials.`, 'note');
    api.notes.create({ ...note, goalId: note.goalId, createdAt: note.createdAt }).catch(console.error);
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    api.notes.delete(id).catch(console.error);
  };

  // Handle session end on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStartTime) {
        const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
        if (minutes > 0) {
          // Note: sync XHR or Beacon API would be better here, 
          // but for now we'll rely on the logout button for explicit tracking
          // and this as a best effort.
          const blob = new Blob([JSON.stringify({ minutes })], { type: 'application/json' });
          navigator.sendBeacon('/api/activity', blob);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionStartTime]);

  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading StudySphere...</p>
        </div>
      </div>
    );
  }


  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-indigo-200 bg-transparent flex items-center justify-center">
            <img src={logo} alt="StudySphere logo" className="w-full h-full object-contain" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
              <h1 className="font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">StudySphere</h1>
              {user && <span className="text-xs text-white bg-slate-800/20 px-1.5 py-0.5 rounded w-fit mt-1">{user.username}</span>}
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Target size={20} />} label="Goals" active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} collapsed={!isSidebarOpen} />
          <NavItem icon={<BookOpen size={20} />} label="Notes" active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Wand2 size={20} />} label="Summarizer" active={activeTab === 'summarizer'} onClick={() => setActiveTab('summarizer')} collapsed={!isSidebarOpen} />
          <NavItem icon={<MessageSquare size={20} />} label="AI Tutor" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} collapsed={!isSidebarOpen} />
          <NavItem icon={<BrainCircuit size={20} />} label="Quiz Hub" active={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')} collapsed={!isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className={cn(
            "flex items-center gap-3 bg-slate-50 p-3 rounded-xl",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <Flame size={18} />
            </div>
            {isSidebarOpen && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Streak</p>
                <p className="text-sm font-bold text-slate-800">{stats.streak} Days</p>
              </div>
            )}
          </div>
          {isSidebarOpen && (
            <div className="mt-4">
              <button
                className="w-full text-left text-sm text-red-600 hover:underline"
                onClick={async () => {
                  if (sessionStartTime) {
                    const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
                    await logActivity(minutes);
                  }
                  await api.auth.logout().catch(() => {});
                  localStorage.removeItem('ss_token');
                  setUser(null);
                  setGoals([]);
                  setNotes([]);
                  setQuizzes([]);
                  setNotifications([]);
                  setDataLoaded(false);
                  setSessionStartTime(null);
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 bg-slate-700 dark:bg-slate-800 border-bottom border-slate-600 dark:border-slate-700 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              Welcome back, {user?.username?.split(' ')[0] || 'Student'} 👋
            </h2>
            <p className="text-lg font-bold text-white capitalize">{activeTab}</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="px-3 py-1.5 bg-slate-600 text-white border border-slate-500 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
              aria-label="Select theme"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
            <button
              className="p-2 text-slate-200 hover:text-white transition-colors"
              aria-label="Toggle theme menu"
            >
              <Sun size={20} />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative"
              >
                <Bell size={20} />
                {hasUnread && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800"></span>}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <NotificationPanel 
                    notifications={notifications} 
                    onClose={() => setShowNotifications(false)}
                    onMarkRead={markNotificationAsRead}
                    onClearAll={clearNotifications}
                  />
                )}
              </AnimatePresence>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold dark:bg-indigo-900 dark:border-indigo-700 dark:text-indigo-300">
              {user?.username?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'ST'}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <Dashboard key="dashboard" goals={goals} stats={stats} logs={logs} activityMap={activityMap} quizzes={quizzes} />}
            {activeTab === 'goals' && <GoalManager key="goals" goals={goals} onAdd={addGoal} onToggle={toggleTask} onDelete={deleteGoal} onComplete={completeGoal} />}
            {activeTab === 'notes' && <NotesManager key="notes" notes={notes} goals={goals} onAdd={addNote} onDelete={deleteNote} />}
            {activeTab === 'summarizer' && <Summarizer key="summarizer" notes={notes} logActivity={logActivity} />}
            {activeTab === 'chat' && <AIChat key="chat" notes={notes} logActivity={logActivity} />}
            {activeTab === 'quiz' && <QuizHub key="quiz" notes={notes} addNotification={addNotification} logActivity={logActivity} quizzes={quizzes} setQuizzes={setQuizzes} />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
        active 
          ? "bg-indigo-50 text-indigo-600 shadow-sm" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      )}
    >
      <span className={cn(active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")}>
        {icon}
      </span>
      {!collapsed && <span className="font-medium text-sm">{label}</span>}
    </button>
  );
}

function NotificationPanel({ 
  notifications, 
  onClose, 
  onMarkRead, 
  onClearAll 
}: { 
  notifications: Notification[], 
  onClose: () => void, 
  onMarkRead: (id: string) => void, 
  onClearAll: () => void 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden"
    >
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Bell size={16} className="text-indigo-500" />
          Notifications
        </h3>
        <div className="flex gap-2">
          <button onClick={onClearAll} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider">Clear All</button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => onMarkRead(n.id)}
                className={cn(
                  "p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer relative group",
                  !n.read && "bg-indigo-50/30 dark:bg-indigo-900/10"
                )}
              >
                {!n.read && <div className="absolute top-5 left-2 w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg shrink-0",
                    n.type === 'goal' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" :
                    n.type === 'note' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
                    n.type === 'quiz' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                  )}>
                    {n.type === 'goal' ? <Target size={14} /> :
                     n.type === 'note' ? <BookOpen size={14} /> :
                     n.type === 'quiz' ? <Trophy size={14} /> : <Info size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight mb-1">{n.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">{format(new Date(n.createdAt), 'h:mm a, MMM d')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Bell size={20} />
            </div>
            <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Contribution Graph Component
function ContributionGraph({ activityMap }: { activityMap: Map<string, number> }) {
  const generateContributionData = () => {
    const data: { date: string; count: number; level: number }[] = [];
    const today = new Date();
    
    for (let i = 365; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = activityMap.get(dateStr) || 0;
      const level = count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 6 ? 3 : 4;
      data.push({ date: dateStr, count, level });
    }
    return data;
  };

  const data = generateContributionData();
  const weeks = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  // Calculate month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; index: number }[] = [];
    weeks.forEach((week, i) => {
      const firstDay = parse(week[0].date, 'yyyy-MM-dd', new Date());
      const month = format(firstDay, 'MMM');
      const prevMonth = i > 0 ? format(parse(weeks[i - 1][0].date, 'yyyy-MM-dd', new Date()), 'MMM') : null;
      
      if (i === 0 || month !== prevMonth) {
        // Ensure labels don't overlap too much
        if (labels.length === 0 || i - labels[labels.length - 1].index > 2) {
          labels.push({ label: month, index: i });
        }
      }
    });
    return labels;
  }, [weeks]);

  const levelColors = {
    0: 'bg-slate-100 dark:bg-slate-700',
    1: 'bg-blue-200 dark:bg-blue-900',
    2: 'bg-blue-400 dark:bg-blue-700',
    3: 'bg-blue-500 dark:bg-blue-600',
    4: 'bg-blue-600 dark:bg-blue-500',
  };

  let maxActivity = 0;
  let totalActivity = 0;
  
  if (activityMap && typeof activityMap.values === 'function') {
    const activityValues = Array.from(activityMap.values()).map(v => Number(v) || 0);
    maxActivity = activityValues.length > 0 ? Math.max(...activityValues) : 0;
    totalActivity = activityValues.reduce((a, b) => a + b, 0);
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <strong>{totalActivity}</strong> contributions in the last year • 
          <span className="ml-2">Daily max: <strong>{maxActivity}</strong></span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={cn('w-2.5 h-2.5 rounded-sm', levelColors[level as keyof typeof levelColors])}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Contribution Grid */}
      <div className="overflow-x-auto custom-scrollbar pb-2">
        <div className="inline-flex flex-col min-w-max">
          {/* Months Row */}
          <div className="flex text-[10px] text-slate-400 mb-1.5 h-3 relative">
            {monthLabels.map(({ label, index }) => (
              <span key={`${index}-${label}`} className="absolute whitespace-nowrap" style={{ left: `${index * 16}px` }}>
                {label}
              </span>
            ))}
          </div>
          
          <div className="flex gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {week.map((day, dayIndex) => (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={cn(
                      'w-3 h-3 rounded-sm transition-all hover:ring-2 hover:ring-indigo-400 cursor-pointer',
                      levelColors[day.level as keyof typeof levelColors]
                    )}
                    title={`${day.count} contributions on ${format(parse(day.date, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy')}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function Dashboard({ goals, stats, logs, activityMap, quizzes }: { goals: Goal[], stats: UserStats, logs: StudyLog[], activityMap: Map<string, number>, quizzes: any[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeGoals = goals.filter(g => g.status === 'active' && new Date(g.deadline) >= today);
  const completedGoals = goals.filter(g => g.status === 'completed');
  
  const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const todaysLog = logs.find(log => log.date === todayFormatted);
  const totalMinutes = todaysLog ? todaysLog.minutes : 0;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const dailyActivityCount = activityMap.get(todayStr) || 0;
  
  // Productivity Score: 40% from Study Time (goal: 2h), 60% from Activity Count (goal: 10 actions)
  const timeScore = Math.min(40, (totalMinutes / 120) * 40);
  const activityScore = Math.min(60, (dailyActivityCount / 10) * 60);
  const productivityScore = Math.round(timeScore + activityScore);

  // Calculate total study time across all days
  const totalStudyMinutes = logs.reduce((acc, log) => acc + log.minutes, 0);

  // --- Quiz Analytics ---
  const totalQuizzes = quizzes.length;
  const totalCorrect = quizzes.reduce((sum, q) => sum + q.score, 0);
  const totalQuestions = quizzes.reduce((sum, q) => sum + q.total, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  // Extract weak areas from the latest quiz insights
  let latestWeakAreas: string[] = [];
  if (quizzes.length > 0) {
    const latestInsight = quizzes[0].insights;
    // Look for lines starting with * or - under Weak Areas
    const weakAreasMatch = latestInsight.match(/Weak Areas:[\s\S]*?(?=Recommendations:|$)/i);
    if (weakAreasMatch) {
      const bulletPoints = weakAreasMatch[0].match(/^[*\-]\s+(.+)$/gm);
      if (bulletPoints) {
        latestWeakAreas = bulletPoints.map((b: string) => b.replace(/^[*\-]\s+/, '').trim());
      }
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Study Streak" value={`${stats.streak} Days`} icon={<Flame className="text-amber-500" />} trend="+2 from last week" />
        <StatCard title="Goals Completed" value={`${completedGoals.length}/${goals.length}`} icon={<CheckCircle2 className="text-emerald-500" />} trend="Keep it up!" />
        <StatCard title="Today's Study Time" value={`${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`} icon={<Clock className="text-blue-500" />} trend="Resets tomorrow" />
        <StatCard title="Productivity Score" value={`${productivityScore}%`} icon={<BarChart3 className="text-indigo-500" />} trend="Based on daily progress" />
      </div>

      {/* Quiz Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Quizzes Attempted" value={`${totalQuizzes}`} icon={<BrainCircuit className="text-purple-500" />} trend="Practice makes perfect" />
        <StatCard title="Average Accuracy" value={`${accuracy}%`} icon={<Target className="text-emerald-500" />} trend="Based on all quizzes" />
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
            <span className="text-sm font-medium text-slate-500">Recent Weak Areas</span>
            <div className="p-1.5 bg-rose-50 rounded-lg"><Target size={16} className="text-rose-500" /></div>
          </div>
          {latestWeakAreas.length > 0 ? (
            <ul className="text-sm font-bold text-slate-700 space-y-1">
              {latestWeakAreas.slice(0, 3).map((area, i) => (
                <li key={i} className="truncate flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                  {area}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs font-bold text-slate-400">None detected recently</span>
          )}
        </div>
      </div>

      {/* Activity Graph */}
      <div className="card !p-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Activity Graph</h3>
        <ContributionGraph activityMap={activityMap} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Study Time Trends</h3>
            <select className="text-sm bg-slate-50 border-none rounded-lg px-2 py-1 outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={logs}>
                <defs>
                  <linearGradient id="colorMin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="minutes" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorMin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Upcoming Deadlines</h3>
          <div className="space-y-4">
            {activeGoals.length > 0 ? (
              activeGoals.slice(0, 4).map(goal => (
                <div key={goal.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{goal.title}</p>
                    <p className="text-xs text-slate-500">{goal.subject} • {format(new Date(goal.deadline), 'MMM dd')}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">No active goals. Time to set some!</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      </div>
      <div className="space-y-1">
        <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
        <p className="text-xs text-emerald-600 font-medium">{trend}</p>
      </div>
    </div>
  );
}

function GoalManager({ goals, onAdd, onToggle, onDelete, onComplete }: { goals: Goal[], onAdd: (g: any) => void, onToggle: (gid: string, tid: string) => void, onDelete: (id: string) => void, onComplete: (id: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newGoal, setNewGoal] = useState({ subject: '', title: '', description: '', deadline: '', tasks: [] as any[] });
  const [taskInput, setTaskInput] = useState('');

  const handleAddTask = () => {
    if (!taskInput.trim()) return;
    setNewGoal({ ...newGoal, tasks: [...newGoal.tasks, { id: Math.random().toString(), title: taskInput, completed: false }] });
    setTaskInput('');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800">My Study Goals</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus size={20} /> New Goal
        </button>
      </div>

      {isAdding && (
        <div className="bg-[#1e293b] p-8 rounded-2xl border-2 border-indigo-100/10 shadow-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase mb-2 block">Subject</label>
                <input required value={newGoal.subject} onChange={e => setNewGoal({...newGoal, subject: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="e.g. Mathematics" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase mb-2 block">Deadline</label>
                <input required type="date" min={new Date().toISOString().split('T')[0]} value={newGoal.deadline} onChange={e => setNewGoal({...newGoal, deadline: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-white uppercase mb-2 block">Goal Title</label>
              <input required value={newGoal.title} onChange={e => setNewGoal({...newGoal, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="e.g. Master Calculus Integration" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-white uppercase mb-2 block">Sub-tasks</label>
              <div className="flex gap-2">
                <input value={taskInput} onChange={e => setTaskInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTask())} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="Add a step..." />
                <button type="button" onClick={handleAddTask} className="bg-slate-100 text-slate-600 px-3 rounded-lg hover:bg-slate-200 h-10 flex items-center justify-center"><Plus size={20} /></button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {newGoal.tasks.map(t => (
                  <span key={t.id} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                    {t.title}
                    <button type="button" onClick={() => setNewGoal({...newGoal, tasks: newGoal.tasks.filter(x => x.id !== t.id)})} className="hover:text-indigo-900">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 items-center">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-400 hover:text-white font-semibold transition-colors">Cancel</button>
              <button type="button" onClick={() => {
                alert('Button clicked!');
                console.log('Create Goal button clicked');
                const missing = [];
                if (!newGoal.title?.trim()) missing.push('Title');
                if (!newGoal.subject?.trim()) missing.push('Subject');
                if (!newGoal.deadline) missing.push('Deadline');
                
                console.log('Missing fields:', missing);
                if (missing.length > 0) {
                  alert(`Please fill in all required fields: ${missing.join(', ')}`);
                  return;
                }
                
                console.log('Creating goal...');
                onAdd(newGoal);
                setNewGoal({ subject: '', title: '', description: '', deadline: '', tasks: [] });
                setIsAdding(false);
              }} className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20">Create Goal</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map(goal => (
          <div key={goal.id} className={cn("p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group", goal.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200')}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">{goal.subject}</span>
                <h4 className={cn("text-lg font-bold mt-1", goal.status === 'completed' ? 'text-emerald-700 line-through' : 'text-slate-800')}>{goal.title}</h4>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onComplete(goal.id)} 
                  className={cn(
                    "transition-colors",
                    goal.status === 'completed' ? "text-emerald-500" : "text-slate-300 hover:text-indigo-400"
                  )}
                  title="Mark as completed"
                >
                  {goal.status === 'completed' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>
                <span className="text-sm font-medium text-slate-600">Completed</span>
                <button onClick={() => onDelete(goal.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              {goal.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 group/task">
                  <button onClick={() => goal.status !== 'completed' && onToggle(goal.id, task.id)} disabled={goal.status === 'completed'} className={cn(
                    "transition-colors",
                    task.completed ? "text-emerald-500" : "text-slate-300 hover:text-indigo-400",
                    goal.status === 'completed' && "opacity-50 cursor-not-allowed"
                  )}>
                    {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <span className={cn("text-sm", task.completed ? "text-slate-400 line-through" : "text-slate-600")}>{task.title}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2" style={{ opacity: goal.status === 'completed' ? 0.6 : 1 }}>
              <div className="flex justify-between text-xs font-bold">
                <span className={cn(goal.status === 'completed' ? 'text-emerald-600' : 'text-slate-500')}>Progress</span>
                <span className={cn(goal.status === 'completed' ? 'text-emerald-600' : 'text-indigo-600')}>{goal.progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${goal.progress}%` }}
                  className={cn("h-full rounded-full", goal.status === 'completed' ? 'bg-emerald-600' : 'bg-indigo-600')}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium pt-2">
                <Clock size={12} />
                Deadline: {format(new Date(goal.deadline), 'MMM dd, yyyy')}
              </div>
            </div>
            {goal.status === 'completed' && (
              <div className="mt-4 pt-4 border-t border-emerald-200 text-xs font-semibold text-emerald-600 text-center">
                ✓ Goal Completed!
              </div>
            )}
          </div>
        ))}
        {goals.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Target size={32} />
            </div>
            <p className="text-slate-500 font-medium">No goals set yet. Start by defining your study targets!</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function NotesManager({ notes, goals, onAdd, onDelete }: { notes: Note[], goals: Goal[], onAdd: (n: any) => void, onDelete: (id: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', type: 'text' as any, goalId: '', url: '' });
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.title || !newNote.content || (newNote.type !== 'text' && !newNote.url)) return;
    onAdd(newNote);
    setNewNote({ title: '', content: '', type: 'text', goalId: '', url: '' });
    setIsAdding(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800">Study Materials</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus size={20} /> Add Note
        </button>
      </div>

      {isAdding && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card border-2 border-indigo-100 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase">Title</label>
                <input required value={newNote.title} onChange={e => setNewNote({...newNote, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="e.g. Integration Formulas" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase">Type</label>
                <select value={newNote.type} onChange={e => setNewNote({...newNote, type: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500">
                  <option value="text">Text Note</option>
                  <option value="pdf">PDF Link</option>
                  <option value="video">Video Link</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-white uppercase">Related Goal (Optional)</label>
              <select value={newNote.goalId} onChange={e => setNewNote({...newNote, goalId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500">
                <option value="">None</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            {newNote.type === 'text' ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase">Content</label>
                <textarea required rows={4} value={newNote.content} onChange={e => setNewNote({...newNote, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="Write your notes here..." />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white uppercase">URL</label>
                  <input required type="url" value={newNote.url} onChange={e => setNewNote({...newNote, url: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="https://..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white uppercase">Notes</label>
                  <textarea required rows={3} value={newNote.content} onChange={e => setNewNote({...newNote, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="Add notes about this resource..." />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 font-semibold">Cancel</button>
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">Save Note</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {notes.map(note => (
          <div 
            key={note.id} 
            onClick={() => setSelectedNoteId(note.id)}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "p-2 rounded-lg",
                note.type === 'text' ? "bg-blue-50 text-blue-600" : 
                note.type === 'pdf' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
              )}>
                {note.type === 'text' ? <BookOpen size={18} /> : 
                 note.type === 'pdf' ? <ExternalLink size={18} /> : <ChevronRight size={18} />}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(note.id);
                }} 
                className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <h4 className="font-bold text-slate-800 mb-2">{note.title}</h4>
            <div className="flex-1">
              {note.content && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-2">{note.content}</p>
              )}
              {note.url && (
                <a href={note.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  View Resource <ExternalLink size={10} />
                </a>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium">{format(new Date(note.createdAt), 'MMM dd, yyyy')}</span>
              {note.goalId && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Linked to Goal</span>
              )}
            </div>
          </div>
        ))}
        {notes.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <BookOpen size={32} />
            </div>
            <p className="text-slate-500 font-medium">Your library is empty. Add notes or links to get started.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedNoteId && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSelectedNoteId(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            >
              {(() => {
                const note = notes.find(n => n.id === selectedNoteId);
                if (!note) return null;
                return (
                  <>
                    <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={cn(
                            "p-2 rounded-lg",
                            note.type === 'text' ? "bg-blue-100 text-blue-700" : 
                            note.type === 'pdf' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {note.type === 'text' ? <BookOpen size={20} /> : 
                             note.type === 'pdf' ? <ExternalLink size={20} /> : <ChevronRight size={20} />}
                          </div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {note.type === 'text' ? 'Text Note' : note.type === 'pdf' ? 'PDF Resource' : 'Video Resource'}
                          </span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">{note.title}</h2>
                        {note.goalId && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">
                            <Target size={12} /> Linked to Goal
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setSelectedNoteId(null)}
                        className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-xl shadow-sm border border-slate-200"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto flex-1">
                      {note.url && (
                        <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Resource Link</h4>
                          <a 
                            href={note.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2 hover:underline overflow-hidden text-ellipsis whitespace-nowrap"
                          >
                            <ExternalLink size={16} className="shrink-0" /> {note.url}
                          </a>
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase">{note.type === 'text' ? 'Content' : 'Notes'}</h4>
                        <div className="prose prose-slate prose-sm sm:prose-base max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} /> Created {format(new Date(note.createdAt), 'MMMM dd, yyyy')}
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Summarizer({ notes, logActivity }: { notes: Note[], logActivity: (minutes: number) => void }) {
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [customText, setCustomText] = useState('');
  const [customFile, setCustomFile] = useState<{data: string, mimeType: string, name: string} | null>(null);
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summaryType, setSummaryType] = useState<'bullet' | 'paragraph' | 'key-points'>('bullet');
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    let textToSummarize = '';
    
    if (selectedNoteId) {
      const note = notes.find(n => n.id === selectedNoteId);
      if (note) {
        textToSummarize = note.content;
      }
    } else if (customText.trim() || customFile) {
      textToSummarize = customText;
    }

    if (!textToSummarize.trim() && !customFile) {
      setSummary('Please select a note, enter text, or upload a file to summarize.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await getSummary(
        textToSummarize, 
        summaryType, 
        customFile ? { data: customFile.data, mimeType: customFile.mimeType } : undefined
      );
      setSummary(result);
      logActivity(3); // Log activity for summary generation
    } catch (err: any) {
      console.error("Error in generateSummary:", err);
      let msg = "Error generating summary: Please try again.";
      if (err.message && err.message.includes("quota")) {
        msg = "I've hit my search limit for the moment! Please wait about a minute and try again. 🕒";
      } else if (err.message) {
        msg = `Error: ${err.message.substring(0, 100)}...`;
      }
      setSummary(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-4">Smart Note Summarizer</h3>
        <p className="text-sm text-slate-500 mb-6">Select a note or paste text to generate a concise summary in your preferred format.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="bg-[#1e293b] p-8 rounded-2xl border-2 border-indigo-100/10 shadow-2xl">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen size={20} className="text-indigo-400" />
              Select Source
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white uppercase mb-2 block">From Your Notes / Resources</label>
                <select 
                  value={selectedNoteId} 
                  onChange={(e) => {
                    setSelectedNoteId(e.target.value);
                    if (e.target.value) setCustomText('');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 text-slate-800"
                >
                  <option value="">-- Select a note --</option>
                  {notes.map(note => (
                    <option key={note.id} value={note.id}>
                      {note.title} {note.type !== 'text' ? `(${note.type.toUpperCase()})` : ''}
                    </option>
                  ))}
                </select>
                {notes.length === 0 && (
                  <p className="text-xs text-slate-400 mt-2">No notes available</p>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-slate-800 text-slate-400">OR UPLOAD FILE</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white uppercase mb-2 block">Upload Document (PDF/Image)</label>
                
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-slate-800/80">
                  <div className="flex items-center gap-3 mb-6">
                    {/* File Format Icons matching screenshot */}
                    {[
                      { type: 'PDF', bg: 'bg-[#ff4d4f]' },
                      { type: <ImageIcon size={20} className="text-white" />, bg: 'bg-[#b37feb]' },
                      { type: 'TXT', bg: 'bg-[#13c2c2]' },
                    ].map((icon, i) => (
                      <div key={i} className={`relative w-12 h-14 rounded-xl flex items-center justify-center text-white font-bold text-[11px] shadow-sm ${icon.bg} overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-4 h-4 bg-white/40 rounded-bl-xl origin-top-right shadow-sm" style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }} />
                        <div className="absolute top-0 right-0 w-4 h-4 bg-slate-900" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
                        {icon.type}
                      </div>
                    ))}
                  </div>

                  <p className="text-slate-200 text-lg mb-2">Upload or drag a file here.</p>
                  <p className="text-slate-400 text-sm mb-4">PDF, Images, TXT: max 50MB</p>
                  
                  <div className="flex items-center gap-1.5 text-slate-500 mb-6 group cursor-pointer hover:text-slate-300 transition-colors">
                    <span className="text-sm">Supported file formats</span>
                    <Info size={14} />
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.txt"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      id="summarizer-drag-drop"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64String = (reader.result as string).split(',')[1];
                            setCustomFile({
                              data: base64String,
                              mimeType: file.type || 'application/octet-stream',
                              name: file.name
                            });
                            setSelectedNoteId('');
                            setCustomUrl('');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <button className="bg-[#1677ff] hover:bg-blue-600 transition-colors text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 pointer-events-none">
                      <CloudUpload size={20} />
                      {customFile ? customFile.name : 'Upload a File'}
                    </button>
                    {customFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCustomFile(null);
                        }}
                        className="absolute -right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-400 bg-slate-800 rounded-full p-1.5 z-20"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-slate-800 text-slate-400">OR DIRECT TEXT</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white uppercase mb-2 block">Paste Text Here</label>
                <textarea
                  value={customText}
                  onChange={(e) => {
                    setCustomText(e.target.value);
                    if (e.target.value) setSelectedNoteId('');
                  }}
                  rows={6}
                  placeholder="Paste your study material or notes here..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 resize-none text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white uppercase mb-3 block">Summary Format</label>
                <div className="space-y-2">
                  {[
                    { id: 'bullet', label: '• Bullet Points', desc: 'Quick, scannable format' },
                    { id: 'paragraph', label: '¶ Paragraph', desc: 'Detailed narrative' },
                    { id: 'key-points', label: '★ Key Points', desc: 'Highlighted takeaways' }
                  ].map(format => (
                    <label key={format.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 cursor-pointer bg-slate-700/50">
                      <input
                        type="radio"
                        name="summaryType"
                        value={format.id}
                        checked={summaryType === format.id}
                        onChange={(e) => setSummaryType(e.target.value as any)}
                        className="w-4 h-4"
                      />
                      <div>
                        <div className="text-sm font-medium text-white">{format.label}</div>
                        <div className="text-xs text-slate-400">{format.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={generateSummary}
                disabled={isLoading || (!selectedNoteId && !customText.trim() && !customFile)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-4 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Wand2 size={18} />
                {isLoading ? 'Generating...' : 'Generate Summary'}
              </button>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="card bg-slate-800 border-2 border-slate-700 shadow-xl flex flex-col h-full">
          <h4 className="font-bold text-white mb-4 flex items-center gap-2 shrink-0">
            <BrainCircuit size={20} className="text-emerald-400" />
            Summary Result
          </h4>

          {summary ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 flex-1 overflow-y-auto">
                <div className="prose prose-slate prose-sm sm:prose-base max-w-none w-full text-slate-800 marker:text-slate-500">
                  <Markdown>
                    {summary}
                  </Markdown>
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(summary);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 shrink-0",
                  copied 
                    ? "bg-emerald-500 text-white" 
                    : "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                )}
              >
                {copied ? <CheckCircle2 size={16} /> : null}
                {copied ? 'Copied!' : 'Copy Summary'}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-slate-400 border border-slate-700/50 rounded-xl bg-slate-900/30">
              <div>
                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <Wand2 size={24} />
                </div>
                <p className="text-sm">Select a note or paste text, then click "Generate Summary" to create a concise overview.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AIChat({ notes, logActivity }: { notes: Note[], logActivity: (minutes: number) => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState('');

  useEffect(() => {
    api.chat.list().then(history => {
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([
          { role: 'ai', content: "👋 Hello! I'm your **StudySphere AI Tutor**. I'm here to help you master your subjects! \n\nYou can:\n- **Ask me anything** about your studies\n- **Select a note** above to give me context on a specific topic\n- **Request explanations** for complex concepts" }
        ]);
      }
      setIsLoaded(true);
    }).catch(err => {
      console.error("Failed to load chat history:", err);
      setIsLoaded(true);
    });
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input;
    const userMsgId = Date.now().toString();
    setInput('');
    const userMessage = { role: 'user' as const, content: userMsg };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Save user message to DB
    api.chat.create({ id: userMsgId, role: 'user', content: userMsg }).catch(console.error);

    try {
      const context = selectedNoteId ? notes.find(n => n.id === selectedNoteId)?.content : undefined;
      const response = await getDoubtCleared(userMsg, context);
      const aiMessage = { role: 'ai' as const, content: response };
      setMessages(prev => [...prev, aiMessage]);
      
      // Save AI message to DB
      api.chat.create({ id: (Date.now() + 1).toString(), role: 'ai', content: response }).catch(console.error);
      
      logActivity(2); // Log activity for AI interaction
    } catch (error: any) {
      console.error("AI Tutor Error:", error);
      let friendlyMessage = "Sorry, I encountered an error. Please try again.";
      if (error.message && error.message.includes("quota")) {
        friendlyMessage = "I've hit my search limit for the moment! Please wait about a minute and try again. 🕒";
      } else if (error.message) {
        friendlyMessage = `I'm having a bit of trouble: ${error.message.substring(0, 100)}...`;
      }
      setMessages(prev => [...prev, { role: 'ai', content: friendlyMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <BrainCircuit size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Study Tutor</h3>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear your chat history?')) {
                api.chat.clear().then(() => {
                  setMessages([{ role: 'ai', content: "Chat history cleared. How can I help you today?" }]);
                }).catch(console.error);
              }
            }}
            className="text-xs text-slate-400 hover:text-rose-500 transition-colors p-1"
            title="Clear Chat"
          >
            <Trash2 size={16} />
          </button>
          <select 
            value={selectedNoteId} 
            onChange={e => setSelectedNoteId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
          >
            <option value="">No context (General AI)</option>
            {notes.filter(n => n.content?.trim()).map(n => <option key={n.id} value={n.id}>{n.title} ({n.type})</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex",
            msg.role === 'user' ? "justify-end" : "justify-start"
          )}>
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl text-sm shadow-sm",
              msg.role === 'user' 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-white border border-slate-100 text-slate-800 rounded-tl-none"
            )}>
              <div className="prose prose-sm max-w-none prose-slate">
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="flex gap-2">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question or clear a doubt..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function QuizHub({ notes, addNotification, logActivity, quizzes, setQuizzes }: { notes: Note[], addNotification: (title: string, message: string, type: Notification['type']) => void, logActivity: (minutes: number) => void, quizzes: any[], setQuizzes: React.Dispatch<React.SetStateAction<any[]>> }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [requestedCount, setRequestedCount] = useState<number>(5);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizInsights, setQuizInsights] = useState<string>('');
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedNoteId) return;
    const note = notes.find(n => n.id === selectedNoteId);
    if (!note || !note.content) return;

    setIsGenerating(true);
    setCurrentQuiz(null);
    setQuizFinished(false);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizInsights('');
    setViewingHistoryId(null);

    try {
      const questions = await generateQuizFromNotes(note.content, requestedCount);
      setCurrentQuiz(questions);
    } catch (error: any) {
      console.error("Quiz Error:", error);
      let msg = "Failed to generate quiz. Please try again.";
      if (error.message && error.message.includes("quota")) {
        msg = "I've hit my search limit for the moment! Please wait about a minute and try again. 🕒";
      }
      alert(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = async (index: number) => {
    if (userAnswers[currentQuestionIndex] !== undefined) return; // Prevent double clicks
    
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = index;
    setUserAnswers(newAnswers);

    if (currentQuestionIndex < (currentQuiz?.length || 0) - 1) {
      setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 500);
    } else {
      setQuizFinished(true);
      if (currentQuiz) {
        const score = newAnswers.reduce((acc, ans, i) => ans === currentQuiz[i].correctAnswer ? acc + 1 : acc, 0);
        addNotification('Quiz Completed!', `You scored ${score}/${currentQuiz.length} on your quiz. Check your insights!`, 'quiz');
        setIsGeneratingInsights(true);
        
        // Log activity for finishing a quiz
        logActivity(10); 
        
        // Generate AI Insights for wrong answers
        const wrongOnes = currentQuiz.map((q, i) => ({
          question: q.question,
          answer: q.options[newAnswers[i]],
          correct: q.options[q.correctAnswer],
          explanation: q.explanation,
          isWrong: newAnswers[i] !== q.correctAnswer
        })).filter(q => q.isWrong);

        try {
          const insights = await getQuizInsights(wrongOnes);
          setQuizInsights(insights);
          
          // Save to history and database
          const historyItem = {
            id: Date.now().toString(),
            noteId: selectedNoteId,
            noteTitle: notes.find(n => n.id === selectedNoteId)?.title || 'General Quiz',
            score,
            total: currentQuiz.length,
            date: new Date(),
            questions: currentQuiz,
            answers: newAnswers,
            insights
          };
          setQuizzes(prev => [historyItem, ...prev]);
          
          api.quizzes.create({
            id: historyItem.id,
            noteId: historyItem.noteId,
            noteTitle: historyItem.noteTitle,
            score: historyItem.score,
            total: historyItem.total,
            insights: historyItem.insights,
            questions: historyItem.questions,
            answers: historyItem.answers,
            createdAt: historyItem.date.toISOString(),
          }).catch(console.error);
        } catch (e) {
          console.error("Failed to generate insights", e);
        } finally {
          setIsGeneratingInsights(false);
        }
      }
    }
  };

  const score = userAnswers.reduce((acc, ans, i) => {
    return ans === currentQuiz?.[i].correctAnswer ? acc + 1 : acc;
  }, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {!currentQuiz && !viewingHistoryId && (
        <>
          <div className="bg-[#1e293b] p-10 rounded-2xl border-2 border-indigo-100/10 shadow-2xl text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto mb-6 border border-indigo-500/20">
              <BrainCircuit size={32} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">AI Quiz Generator</h3>
            <p className="text-slate-400 mb-8">Select a note and choose how many questions you want to tackle.</p>
            
            <div className="flex flex-col gap-6 max-w-md mx-auto text-left">
              <div>
                <label className="text-xs font-bold text-white uppercase mb-3 block tracking-wider">Number of Questions</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[5, 10, 15, 20].map(count => (
                    <button
                      key={count}
                      onClick={() => setRequestedCount(count)}
                      className={cn(
                        "py-2.5 rounded-xl border-2 transition-all font-bold text-sm",
                        requestedCount === count 
                          ? "border-indigo-500 bg-indigo-500/20 text-white" 
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white uppercase mb-3 block tracking-wider">Select Source Note</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select 
                    value={selectedNoteId} 
                    onChange={e => setSelectedNoteId(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-900 font-medium"
                  >
                    <option value="">Choose a note...</option>
                    {notes.filter(n => n.content?.trim()).map(n => <option key={n.id} value={n.id}>{n.title} ({n.type})</option>)}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={!selectedNoteId || isGenerating}
                className="w-full bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 mt-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating Quiz...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Start Quiz</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {quizzes.length > 0 && (
            <div className="max-w-2xl mx-auto space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                Recent Quiz History
              </h4>
              <div className="grid gap-3">
                {quizzes.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setViewingHistoryId(item.id)}
                    className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.noteTitle}</div>
                      <div className="text-xs text-slate-400">{format(item.date, 'MMM d, h:mm a')}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-700">{item.score}/{item.total}</div>
                        <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                          {Math.round((item.score / item.total) * 100)}%
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {currentQuiz && !quizFinished && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-lg">
          <div className="flex justify-between items-center mb-8">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {currentQuiz.length}</span>
            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${((currentQuestionIndex + 1) / currentQuiz.length) * 100}%` }}></div>
            </div>
          </div>
          
          <h4 className="text-xl font-bold text-slate-800 mb-8">{currentQuiz[currentQuestionIndex].question}</h4>
          
          <div className="space-y-4">
            {currentQuiz[currentQuestionIndex].options.map((option, i) => (
              <button 
                key={i}
                onClick={() => handleAnswer(i)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 font-medium",
                  userAnswers[currentQuestionIndex] === i 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700" 
                    : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">{String.fromCharCode(65 + i)}</span>
                  {option}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {(quizFinished || viewingHistoryId) && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto space-y-6 pb-12">
          {/* Result Header */}
          <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-xl text-center">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-6">
              <Trophy size={48} />
            </div>
            <h3 className="text-3xl font-bold text-slate-800 mb-2">Quiz Results</h3>
            <p className="text-slate-500 mb-4">
              {viewingHistoryId 
                ? `Results for ${quizzes.find(h => h.id === viewingHistoryId)?.noteTitle}` 
                : 'Great job completing your study session!'}
            </p>
            <div className="inline-flex flex-col items-center bg-indigo-50 px-8 py-4 rounded-2xl border border-indigo-100">
              <div className="text-4xl font-black text-indigo-700">
                {viewingHistoryId 
                  ? `${quizzes.find(h => h.id === viewingHistoryId)?.score}/${quizzes.find(h => h.id === viewingHistoryId)?.total}`
                  : `${score}/${currentQuiz?.length}`}
              </div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Final Score</div>
            </div>
          </div>

          {/* AI Insights & Weak Points */}
          <div className="bg-indigo-900 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BrainCircuit size={120} />
            </div>
            <div className="relative z-10">
              <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles size={24} className="text-yellow-400" />
                AI Smart Report & Guidance
              </h4>
              
              {isGeneratingInsights ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-400 border-t-yellow-400 rounded-full animate-spin"></div>
                  <p className="text-sm font-medium animate-pulse">Analyzing your results for learning gaps...</p>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10">
                    <Markdown>{viewingHistoryId ? quizzes.find(h => h.id === viewingHistoryId)?.insights : quizInsights}</Markdown>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Review */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
            <h4 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-4">Detailed Question Review</h4>
            {(viewingHistoryId ? quizzes.find(h => h.id === viewingHistoryId)?.questions : currentQuiz)?.map((q, i) => {
              const history = viewingHistoryId ? quizzes.find(h => h.id === viewingHistoryId) : null;
              const userAnswerIndex = history ? history.answers[i] : userAnswers[i];
              const isCorrect = userAnswerIndex === q.correctAnswer;

              return (
                <div key={i} className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-sm font-bold text-slate-700">
                      <span className="text-indigo-500 mr-2">{i + 1}.</span> 
                      {q.question}
                    </p>
                    {isCorrect ? (
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-rose-500 shrink-0" />
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <div className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center gap-2",
                      isCorrect ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                    )}>
                      {isCorrect ? "Correct!" : "Your Answer:"} {q.options[userAnswerIndex]}
                    </div>
                    {!isCorrect && (
                      <div className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold">
                        Correct Answer: {q.options[q.correctAnswer]}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-100 italic">
                    <strong>Tutor's Note:</strong> {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => { setCurrentQuiz(null); setQuizFinished(false); setViewingHistoryId(null); }}
            className="w-full bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <ChevronLeft size={20} />
            Back to Quiz Hub
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

