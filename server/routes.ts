import { Router, Request, Response, NextFunction } from 'express';
import db from './db.js';

const router = Router();

// --- Auth Middleware ---
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const tokenRow = db.prepare('SELECT user_id FROM tokens WHERE token = ?').get(token) as any;
  if (!tokenRow) return res.status(401).json({ error: 'Invalid token' });
  (req as any).userId = tokenRow.user_id;
  next();
}

function uid(req: Request): number {
  return (req as any).userId;
}

// ========================
//         GOALS
// ========================

router.get('/goals', requireAuth, (req: Request, res: Response) => {
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at ASC').all(uid(req)) as any[];
  const subtasks = db.prepare('SELECT * FROM subtasks WHERE goal_id IN (SELECT id FROM goals WHERE user_id = ?)').all(uid(req)) as any[];

  const result = goals.map(g => ({
    ...g,
    tasks: subtasks.filter(s => s.goal_id === g.id).map(s => ({ ...s, completed: !!s.completed }))
  }));

  res.json(result);
});

router.post('/goals', requireAuth, (req: Request, res: Response) => {
  const { id, subject, title, description, deadline, tasks, progress, status } = req.body;
  db.prepare('INSERT INTO goals (id, user_id, subject, title, description, deadline, progress, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, uid(req), subject, title, description || '', deadline, progress || 0, status || 'active');

  if (tasks && tasks.length > 0) {
    const insertTask = db.prepare('INSERT INTO subtasks (id, goal_id, title, completed) VALUES (?, ?, ?, ?)');
    for (const t of tasks) {
      insertTask.run(t.id, id, t.title, t.completed ? 1 : 0);
    }
  }

  res.json({ ok: true });
});

router.put('/goals/:id', requireAuth, (req: Request, res: Response) => {
  const { subject, title, description, deadline, progress, status, tasks } = req.body;
  db.prepare('UPDATE goals SET subject=?, title=?, description=?, deadline=?, progress=?, status=? WHERE id=? AND user_id=?')
    .run(subject, title, description || '', deadline, progress, status, req.params.id, uid(req));

  if (tasks) {
    db.prepare('DELETE FROM subtasks WHERE goal_id = ?').run(req.params.id);
    const insertTask = db.prepare('INSERT INTO subtasks (id, goal_id, title, completed) VALUES (?, ?, ?, ?)');
    for (const t of tasks) {
      insertTask.run(t.id, req.params.id, t.title, t.completed ? 1 : 0);
    }
  }

  res.json({ ok: true });
});

router.delete('/goals/:id', requireAuth, (req: Request, res: Response) => {
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

// ========================
//         NOTES
// ========================

router.get('/notes', requireAuth, (req: Request, res: Response) => {
  const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at ASC').all(uid(req));
  res.json(notes);
});

router.post('/notes', requireAuth, (req: Request, res: Response) => {
  const { id, goalId, title, content, type, url, createdAt } = req.body;
  db.prepare('INSERT INTO notes (id, user_id, goal_id, title, content, type, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, uid(req), goalId || null, title, content || '', type || 'text', url || null, createdAt);
  res.json({ ok: true });
});

router.delete('/notes/:id', requireAuth, (req: Request, res: Response) => {
  db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

// ========================
//      NOTIFICATIONS
// ========================

router.get('/notifications', requireAuth, (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(uid(req)) as any[];
  const result = rows.map(n => ({ ...n, read: !!n.read }));
  res.json(result);
});

router.post('/notifications', requireAuth, (req: Request, res: Response) => {
  const { id, title, message, type, createdAt } = req.body;
  db.prepare('INSERT INTO notifications (id, user_id, title, message, type, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(id, uid(req), title, message, type, createdAt);
  res.json({ ok: true });
});

router.put('/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, uid(req));
  res.json({ ok: true });
});

router.delete('/notifications', requireAuth, (req: Request, res: Response) => {
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(uid(req));
  res.json({ ok: true });
});

// ========================
//        ACTIVITY
// ========================

router.get('/activity', requireAuth, (req: Request, res: Response) => {
  const rows = db.prepare('SELECT date, count, minutes FROM activity WHERE user_id = ? ORDER BY date DESC').all(uid(req)) as any[];
  const map: Record<string, number> = {};
  const logs = [];
  for (const r of rows) {
    map[r.date] = r.count;
    logs.push({ date: r.date, minutes: r.minutes });
  }
  res.json({ map, logs });
});

router.post('/activity', requireAuth, (req: Request, res: Response) => {
  const { minutes = 0 } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const userId = uid(req);

  // Update or insert activity for today
  db.prepare('INSERT INTO activity (user_id, date, count, minutes) VALUES (?, ?, 1, ?) ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1, minutes = minutes + ?')
    .run(userId, today, minutes, minutes);

  const statsRow = db.prepare('SELECT streak, last_study_date, total_points FROM stats WHERE user_id = ?').get(userId) as any;
  let newStreak = statsRow?.streak || 0;
  let newPoints = (statsRow?.total_points || 0) + (minutes > 0 ? Math.floor(minutes / 10) * 5 : 2); // Points: 5 per 10 mins, or 2 for small actions
  let lastStudyDate = statsRow?.last_study_date;

  if (lastStudyDate === today) {
    // Already studied today, streak stays the same
    if (newStreak === 0) newStreak = 1;
  } else if (lastStudyDate) {
    const lastDate = new Date(lastStudyDate);
    const currentDate = new Date(today);
    lastDate.setHours(0,0,0,0);
    currentDate.setHours(0,0,0,0);
    
    const diffTime = currentDate.getTime() - lastDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      newStreak += 1; // Consecutive day
    } else {
      newStreak = 1; // Streak broken, reset to 1 (since they performed an action today)
    }
  } else {
    // First time
    newStreak = 1;
  }

  db.prepare('INSERT INTO stats (user_id, streak, total_points, last_study_date) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET streak = ?, total_points = ?, last_study_date = ?')
    .run(userId, newStreak, newPoints, today, newStreak, newPoints, today);

  res.json({ ok: true, streak: newStreak, totalPoints: newPoints });
});

// ========================
//         QUIZZES
// ========================

router.get('/quizzes', requireAuth, (req: Request, res: Response) => {
  const quizzes = db.prepare('SELECT * FROM quiz_results WHERE user_id = ? ORDER BY created_at DESC').all(uid(req)) as any[];
  const result = quizzes.map(q => ({
    ...q,
    questions: JSON.parse(q.questions),
    answers: JSON.parse(q.answers),
    createdAt: q.created_at,
    noteId: q.note_id,
    noteTitle: q.note_title
  }));
  res.json(result);
});

router.post('/quizzes', requireAuth, (req: Request, res: Response) => {
  const { id, noteId, noteTitle, score, total, insights, questions, answers, createdAt } = req.body;
  db.prepare('INSERT INTO quiz_results (id, user_id, note_id, note_title, score, total, insights, questions, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      id, 
      uid(req), 
      noteId || null, 
      noteTitle, 
      score, 
      total, 
      insights, 
      JSON.stringify(questions), 
      JSON.stringify(answers), 
      createdAt || new Date().toISOString()
    );
  
  // Update activity and stats
  const today = new Date().toISOString().split('T')[0];
  db.prepare('INSERT INTO activity (user_id, date, count, minutes) VALUES (?, ?, 1, 10) ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1, minutes = minutes + 10')
    .run(uid(req), today);
  
  res.json({ ok: true });
});

// ========================
//         STATS
// ========================

router.get('/stats', requireAuth, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM stats WHERE user_id = ?').get(uid(req)) as any;
  if (!row) return res.json({ streak: 0, totalPoints: 0, badges: [], lastStudyDate: '' });
  res.json({ streak: row.streak, totalPoints: row.total_points, badges: JSON.parse(row.badges), lastStudyDate: row.last_study_date });
});

router.put('/stats', requireAuth, (req: Request, res: Response) => {
  const { streak, totalPoints, badges, lastStudyDate } = req.body;
  res.json({ ok: true });
});

// ========================
//          CHAT
// ========================

router.get('/chat', requireAuth, (req: Request, res: Response) => {
  const messages = db.prepare('SELECT id, role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC').all(uid(req)) as any[];
  res.json(messages.map(m => ({ ...m, createdAt: m.created_at })));
});

router.post('/chat', requireAuth, (req: Request, res: Response) => {
  const { id, role, content, createdAt } = req.body;
  db.prepare('INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, uid(req), role, content, createdAt || new Date().toISOString());
  res.json({ ok: true });
});

router.delete('/chat', requireAuth, (req: Request, res: Response) => {
  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(uid(req));
  res.json({ ok: true });
});

export default router;
