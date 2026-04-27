import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from './db.js';

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'studysphere_salt').digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/register
router.post('/register', (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const password_hash = hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  ).run(username.trim(), email.trim().toLowerCase(), password_hash);

  const userId = result.lastInsertRowid as number;

  // Create default stats for the user
  db.prepare(
    "INSERT INTO stats (user_id, streak, total_points, badges, last_study_date) VALUES (?, 0, 0, '[]', '')"
  ).run(userId);

  const token = generateToken();
  db.prepare('INSERT INTO tokens (user_id, token) VALUES (?, ?)').run(userId, token);

  res.json({ token, user: { id: userId, username: username.trim(), email: email.trim().toLowerCase() } });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const password_hash = hashPassword(password);
  if (user.password_hash !== password_hash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken();
  db.prepare('INSERT INTO tokens (user_id, token) VALUES (?, ?)').run(user.id, token);

  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const tokenRow = db.prepare('SELECT user_id FROM tokens WHERE token = ?').get(token) as any;
  if (!tokenRow) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(tokenRow.user_id) as any;
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  res.json({ user });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    db.prepare('DELETE FROM tokens WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

export default router;
