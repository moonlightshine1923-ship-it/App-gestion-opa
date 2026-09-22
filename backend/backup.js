import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, getPool } from './db.js';
import { CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Échappe une valeur pour l'insérer dans un script SQL
function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (Buffer.isBuffer(v)) return `0x${v.toString('hex')}`;
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

// Nom de fichier : "Sauvegarde bdd opa - AAAA-MM-JJ_HHhMM.sql"
function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  const h = `${p(date.getHours())}h${p(date.getMinutes())}`;
  return `Sauvegarde bdd opa - ${d}_${h}.sql`;
}

// Génère un export SQL complet (structure + données) en pur Node, sans mysqldump.
export async function runBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const dbName = CONFIG.db.name;
  const when = new Date();

  let out = '';
  out += `-- ============================================\n`;
  out += `--  Sauvegarde de la base de données OPA\n`;
  out += `--  Base : ${dbName}\n`;
  out += `--  Date : ${when.toLocaleString('fr-FR')}\n`;
  out += `-- ============================================\n\n`;
  out += `SET FOREIGN_KEY_CHECKS=0;\n`;
  out += `SET NAMES utf8mb4;\n\n`;
  out += `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`;
  out += `USE \`${dbName}\`;\n\n`;

  // Liste des tables
  const tables = (await query('SHOW TABLES')).map((r) => Object.values(r)[0]);

  for (const table of tables) {
    // Structure
    const createRows = await getPool().query(`SHOW CREATE TABLE \`${table}\``);
    const createSql = createRows[0][0]['Create Table'];
    out += `-- --------------------------------------------\n`;
    out += `-- Table : ${table}\n`;
    out += `-- --------------------------------------------\n`;
    out += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    out += `${createSql};\n\n`;

    // Données
    const rows = await query(`SELECT * FROM \`${table}\``);
    if (rows.length) {
      const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ');
      out += `INSERT INTO \`${table}\` (${cols}) VALUES\n`;
      out += rows.map((row) => '(' + Object.values(row).map(sqlValue).join(', ') + ')').join(',\n');
      out += `;\n\n`;
    }
  }

  out += `SET FOREIGN_KEY_CHECKS=1;\n`;

  const fileName = backupFileName(when);
  const filePath = path.join(BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, out, 'utf8');
  console.log('  ✅ Sauvegarde créée :', fileName);
  cleanOld();
  return { fileName, filePath };
}

// Conserve les N dernières sauvegardes
function cleanOld() {
  try {
    const keep = CONFIG.backup.keep !== undefined ? CONFIG.backup.keep : 30;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => a.t - b.t);
    while (files.length > keep) {
      const old = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, old.f));
    }
  } catch {}
}

export function listBackups() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: st.size, date: st.mtime };
    })
    .sort((a, b) => b.date - a.date);
}

export function backupDir() { return BACKUP_DIR; }

// Planifie une sauvegarde automatique chaque semaine (jour/heure définis dans config).
export function scheduleAutoBackup() {
  const { dayOfWeek, hour, minute } = CONFIG.backup;

  function msUntilNext() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    // avance jusqu'au bon jour de la semaine
    let add = (dayOfWeek - now.getDay() + 7) % 7;
    if (add === 0 && next <= now) add = 7; // déjà passé aujourd'hui -> semaine suivante
    next.setDate(now.getDate() + add);
    return next - now;
  }

  function scheduleNext() {
    const delay = msUntilNext();
    const when = new Date(Date.now() + delay);
    console.log(`  🗓️  Prochaine sauvegarde auto : ${when.toLocaleString('fr-FR')}`);
    setTimeout(async () => {
      try { await runBackup(); } catch (e) { console.warn('  ⚠️ Sauvegarde auto échouée :', e.message); }
      scheduleNext(); // replanifie la semaine suivante
    }, delay);
  }

  scheduleNext();
}
