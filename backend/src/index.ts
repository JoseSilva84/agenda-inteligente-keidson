import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { isPostgresConnected } from './lib/db';
import authRoutes from './routes/auth';
import agendaRoutes from './routes/agenda';
import assistantRoutes from './routes/assistant';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3333);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Healthcheck endpoint para Coolify / Docker
app.get('/api/health', async (_req, res) => {
  const pg = await isPostgresConnected();
  res.json({
    status: 'ok',
    app: 'agenda-inteligente-api',
    database: pg ? 'postgresql' : 'local-mirror',
    timestamp: new Date().toISOString()
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/assistant', assistantRoutes);

// Em produção (ex.: container unificado no Coolify), serve o build estático do frontend PWA se existir
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', async () => {
  await isPostgresConnected();
  console.log(`🚀 [Agenda Inteligente API] Servidor rodando em http://localhost:${PORT}`);
});
