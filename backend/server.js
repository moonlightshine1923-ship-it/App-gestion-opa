import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

import express from 'express';
import fs from 'fs';
import { connect, getDbInfo, query } from './db.js';
import { ensureSeed } from './seed.js';
import { authenticate, authorize } from './middleware/auth.js';
import { scheduleAutoBackup, runBackup, listBackups, backupDir } from './backup.js';
import { CONFIG, logDbConfig } from './config.js';

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

// ── Santé + diagnostic (public : SANS mot de passe, SANS données) ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    db: app.locals.dbReady ? 'connected' : 'disconnected',
    database: getDbInfo(),          // { host, port, user, database } — jamais le mot de passe
    dbError: app.locals.dbError || null,
  });
});

// ── Diagnostic détaillé (admin/président uniquement) ──
// Ouvre ce lien connecté : /api/diag → montre les tables + compteurs.
app.get('/api/diag', authenticate, authorize('admin', 'president'), async (req, res) => {
  const info = { database: getDbInfo(), tables: [], finance: {} };
  try {
    const tables = (await query('SHOW TABLES')).map((r) => Object.values(r)[0]);
    info.tables = tables;
    for (const t of ['finance_mouvements', 'finance_mouvement', 'finance_comptes']) {
      try {
        const c = await query(`SELECT COUNT(*) AS n FROM \`${t}\``);
        info.finance[t] = { exists: true, rows: c[0]?.n ?? 0 };
      } catch {
        info.finance[t] = { exists: false };
      }
    }
    try {
      info.finance.lastSorties = await query(
        'SELECT id, compte_code, sens, nature, montant, date_mouvement FROM finance_mouvements ORDER BY id DESC LIMIT 5'
      );
    } catch { info.finance.lastSorties = []; }
    res.json(info);
  } catch (e) {
    res.status(500).json({ ...info, error: e.message });
  }
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

// ✅ 22/09/2026 (fix global pare-feu) : restaure la vraie méthode HTTP.
// Le frontend envoie POST + en-tête « X-OPA-Method: PUT|PATCH|DELETE »
// (voir api.js) car certains hébergeurs bloquent ces méthodes.
// Placé AVANT les body parsers et les routes : le routage Express voit
// la méthode restaurée et atteint le bon handler. Sans effet sur GET/POST.
app.use((req, res, next) => {
  if (req.method === 'POST') {
    const o = req.headers['x-opa-method'] || req.headers['x-http-method-override'] || req.query._method;
    const m = String(o || '').toUpperCase();
    if (m === 'PUT' || m === 'PATCH' || m === 'DELETE') req.method = m;
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
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.use((req, res) => {
  res.sendFile(path.join(ROOT, 'frontend', 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error('Erreur Express :', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
});

// ── Initialisation DB (sans process.exit : l'app répond même si MySQL est coupé) ──
app.locals.dbReady = false;
app.locals.dbError = null;

logDbConfig(); // ← VÉRIFIEZ ces 4 lignes dans le terminal à chaque démarrage !

(async () => {
  try {
    await connect();
    await ensureSeed();
    scheduleAutoBackup();
    app.locals.dbReady = true;
    app.locals.dbError = null;
    console.log(`✅ OPA — Base MySQL connectée (${CONFIG.db.user}@${CONFIG.db.host}:${CONFIG.db.port}/${CONFIG.db.name})`);
  } catch (err) {
    app.locals.dbError = err.message;
    console.error('❌ Impossible de se connecter à MySQL :', err.message);
    console.error('   → Vérifiez .env (DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME) puis redémarrez.');
  }
})();

// ── Démarrage HTTP : UNIQUEMENT en lancement direct ──
//  - Local :  « node backend/server.js »  → process.argv[1] = .../server.js → on écoute ✅
//  - cPanel Passenger (via app.cjs) → le fichier est IMPORTÉ, pas exécuté → on n'écoute PAS ✅
//    (Passenger distribue lui-même les requêtes à l'app exportée.)
const isDirectRun = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(__filename) : false;
if (isDirectRun && !process.env.PASSENGER_APP_ENV) {
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}

// ── Export pour app.cjs / Passenger ──
export default app;
