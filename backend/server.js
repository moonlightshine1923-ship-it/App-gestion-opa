// ============================================================
// server.js — Version corrigée pour cPanel / Passenger
// ============================================================
// CORRECTIONS :
// 1. dotenv charge .env depuis le bon répertoire (pas cwd)
// 2. app.listen() SEULEMENT si lancé directement (node server.js)
// 3. Pas de process.exit() — l'app répond même si DB indisponible
// 4. Export de l'app pour app.cjs (Passenger)
// ============================================================

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── CORRECTION 1 : Charger .env depuis le répertoire du projet ──
dotenv.config({ path: path.join(ROOT, '.env') });

import express from 'express';
import fs from 'fs';
import { connect } from './db.js';
import { ensureSeed } from './seed.js';
import { authenticate, authorize } from './middleware/auth.js';
import { scheduleAutoBackup, runBackup, listBackups, backupDir } from './backup.js';
import { CONFIG } from './config.js';

import authRoutes from './routes/auth.js';
import referenceRoutes from './routes/reference.js';
import adherentsRoutes from './routes/adherents.js';
import demandesRoutes from './routes/demandes.js';
import documentsRoutes from './routes/documents.js';
import statsRoutes from './routes/stats.js';
import usersRoutes from './routes/users.js';
import blacklistRoutes from './routes/blacklist.js';
import auditRoutes from './routes/audit.js';
import financesRoutes from './routes/finances.js';
import servicesRoutes from './routes/services.js';
import { logAction } from './audit.js';

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    db: app.locals.dbReady ? 'connected' : 'disconnected'
  });
});

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

app.use((req, res, next) => {
  const allowedOrigins = [
    'https://app.opa.dz'
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/adherents', adherentsRoutes);
app.use('/api/demandes', demandesRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/services', servicesRoutes);

app.post('/api/backup', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const { fileName } = await runBackup();
    await logAction(req, 'BACKUP_CREATE', `Création d'une sauvegarde manuelle : ${fileName}`, null, 'backup');
    res.json({ ok: true, file: fileName });
  } catch (e) {
    res.status(500).json({ error: 'Sauvegarde échouée : ' + e.message });
  }
});

app.get('/api/backup', authenticate, authorize('admin', 'president'), (req, res) => {
  res.json(listBackups());
});

app.get('/api/backup/download', authenticate, authorize('admin', 'president'), async (req, res) => {
  const name = req.query.name || '';
  if (!name.endsWith('.sql') || name.includes('/') || name.includes('\\') || name.includes('..')) {
    return res.status(400).json({ error: 'Nom de fichier invalide.' });
  }
  const file = path.join(backupDir(), name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Fichier introuvable.' });
  await logAction(req, 'BACKUP_DOWNLOAD', `Téléchargement de la sauvegarde : ${name}`, null, 'backup');
  res.download(file, name);
});

app.use('/uploads', authenticate, express.static(path.join(ROOT, 'uploads')));

app.use(express.static(path.join(ROOT, 'frontend'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.use((req, res) => {
  res.sendFile(path.join(ROOT, 'frontend', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
});

// ── Initialisation DB (sans process.exit !) ──
app.locals.dbReady = false;

(async () => {
  try {
    await connect();
    await ensureSeed();
    scheduleAutoBackup();
    app.locals.dbReady = true;
    console.log(`OPA — Base MySQL connectée (${CONFIG.db.name})`);
  } catch (err) {
    console.error('Impossible de se connecter à MySQL :', err.message);
  }
})();

// Démarrer le serveur (local uniquement)
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
// ── CORRECTION 3 : Export pour app.cjs / Passenger ──
export default app;