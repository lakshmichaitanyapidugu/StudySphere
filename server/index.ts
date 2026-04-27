import express from 'express';
import cors from 'cors';
import authRouter from './auth.js';
import dataRouter from './routes.js';

const app = express();
const PORT = 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api', dataRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ StudySphere API running on http://localhost:${PORT}`);
});
