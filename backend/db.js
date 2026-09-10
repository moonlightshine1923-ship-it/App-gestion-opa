import mysql from 'mysql2/promise';
import { CONFIG } from './config.js';

const config = {
  host: CONFIG.db.host,
  port: CONFIG.db.port,
  user: CONFIG.db.user,
  password: CONFIG.db.password,
  database: CONFIG.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true,
};

let pool;

export async function connect() {
  const root = await mysql.createConnection({
    host: config.host, port: config.port, user: config.user, password: config.password,
  });
  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.end();
  pool = mysql.createPool(config);
  return pool;
}

export function getPool() {
  if (!pool) throw new Error('Base de données non initialisée. Appelez connect() avant.');
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}
export async function raw(sql) {
  const [rows] = await getPool().query(sql);
  return rows;
}
export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}
export async function run(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

async function hasColumn(table, col) {
  const r = await raw(`SHOW COLUMNS FROM \`${table}\` LIKE '${col}'`);
  return r.length > 0;
}

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS adherents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      matricule VARCHAR(40) UNIQUE,
      nom VARCHAR(100) NOT NULL,
      prenom VARCHAR(100) NOT NULL,
      nom_ar VARCHAR(100),
      prenom_ar VARCHAR(100),
      nom_soc VARCHAR(255) DEFAULT NULL,
      telephone VARCHAR(30) UNIQUE,
      email VARCHAR(150) DEFAULT NULL,
      whatsapp VARCHAR(30) DEFAULT NULL,
      viber VARCHAR(30) DEFAULT NULL,
      adresse_personnelle VARCHAR(255) DEFAULT NULL,
      date_naissance DATE DEFAULT NULL,
      nin VARCHAR(18) UNIQUE,
      doc_type VARCHAR(2) DEFAULT 'RC',
      doc_numero VARCHAR(20),
      doc_numero_2 VARCHAR(20) DEFAULT NULL,
      photo VARCHAR(255),
      wilaya_code VARCHAR(5) NOT NULL DEFAULT '16',
      type_code VARCHAR(2) NOT NULL DEFAULT 'AD',
      niveau VARCHAR(40) DEFAULT 'Adhérent Simple',
      num_ordre INT DEFAULT 0,
      annee INT DEFAULT 0,
      date_adhesion DATE DEFAULT NULL,
      description TEXT,
      fichier_final VARCHAR(255),
      dossier_pdf VARCHAR(255),
      paiement_mode VARCHAR(20),
      paiement_banque VARCHAR(150),
      paiement_ref VARCHAR(100),
      bureau_code VARCHAR(3),
      bureau_badge_type VARCHAR(100),
      qualite_ar VARCHAR(100),
      etoiles TINYINT DEFAULT 0,
      notation_negative TINYINT DEFAULT 0,
      malus TINYINT DEFAULT 0,
      fonction VARCHAR(150) DEFAULT NULL,
      diplome VARCHAR(150) DEFAULT NULL,
      profession VARCHAR(150) DEFAULT NULL,
      carte_remise TINYINT(1) DEFAULT 0,
      top_month_rank INT DEFAULT NULL,
      top_year_rank INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      user_email VARCHAR(150),
      action_type VARCHAR(50) NOT NULL,
      description TEXT,
      target_id VARCHAR(50),
      target_type VARCHAR(50),
      ip_address VARCHAR(45),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS demandes_site_pieces (
      id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      demande_id BIGINT(20) UNSIGNED NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_demande_site_id (demande_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      adherent_id INT,
      titre VARCHAR(200) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_doc_adherent FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Table BLACKLIST
  await query(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      adherent_id INT DEFAULT NULL,
      nom VARCHAR(100) NOT NULL,
      prenom VARCHAR(100) NOT NULL,
      matricule VARCHAR(40) DEFAULT NULL,
      telephone VARCHAR(30) DEFAULT NULL,
      nin VARCHAR(18) DEFAULT NULL,
      wilaya_code VARCHAR(5) DEFAULT NULL,
      motif TEXT,
      niveau_risque ENUM('faible','moyen','élevé','critique') DEFAULT 'moyen',
      date_blacklist DATE DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_blacklist_adherent FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE SET NULL,
      CONSTRAINT fk_blacklist_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_blacklist_matricule (matricule),
      INDEX idx_blacklist_nom (nom, prenom)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureMigrations();
}

async function ensureMigrations() {
  try {
    const cols = await query("SHOW COLUMNS FROM adherents LIKE 'statut'");
    if (cols.length) await query('ALTER TABLE adherents DROP COLUMN statut');
  } catch {}

  try {
    if (!(await hasColumn('adherents', 'doc_type'))) await query("ALTER TABLE adherents ADD COLUMN doc_type VARCHAR(2) DEFAULT 'RC'");
    if (!(await hasColumn('adherents', 'doc_numero'))) {
      await query('ALTER TABLE adherents ADD COLUMN doc_numero VARCHAR(20)');
      if (await hasColumn('adherents', 'rc')) {
        await query("UPDATE adherents SET doc_numero = rc, doc_type = 'RC' WHERE rc IS NOT NULL AND (doc_numero IS NULL OR doc_numero = '')");
      }
    }
  } catch (e) { console.warn('Migration doc_type/doc_numero :', e.message); }

  try {
    if (!(await hasColumn('adherents', 'nom_ar'))) await query('ALTER TABLE adherents ADD COLUMN nom_ar VARCHAR(100) AFTER prenom');
    if (!(await hasColumn('adherents', 'prenom_ar'))) await query('ALTER TABLE adherents ADD COLUMN prenom_ar VARCHAR(100) AFTER nom_ar');
    if (!(await hasColumn('adherents', 'nom_soc'))) await query('ALTER TABLE adherents ADD COLUMN nom_soc VARCHAR(255) DEFAULT NULL AFTER prenom_ar');
    if (!(await hasColumn('adherents', 'email'))) await query('ALTER TABLE adherents ADD COLUMN email VARCHAR(150) DEFAULT NULL AFTER telephone');
    if (!(await hasColumn('adherents', 'whatsapp'))) await query('ALTER TABLE adherents ADD COLUMN whatsapp VARCHAR(30) DEFAULT NULL AFTER email');
    if (!(await hasColumn('adherents', 'viber'))) await query('ALTER TABLE adherents ADD COLUMN viber VARCHAR(30) DEFAULT NULL AFTER whatsapp');
    if (!(await hasColumn('adherents', 'adresse_personnelle'))) await query('ALTER TABLE adherents ADD COLUMN adresse_personnelle VARCHAR(255) DEFAULT NULL AFTER viber');
    if (!(await hasColumn('adherents', 'date_naissance'))) await query('ALTER TABLE adherents ADD COLUMN date_naissance DATE DEFAULT NULL AFTER adresse_personnelle');
    if (!(await hasColumn('adherents', 'doc_numero_2'))) await query('ALTER TABLE adherents ADD COLUMN doc_numero_2 VARCHAR(20) DEFAULT NULL AFTER doc_numero');
  } catch (e) { console.warn('Migration nom_ar/prenom_ar :', e.message); }

  try {
    if (!(await hasColumn('adherents', 'description'))) await query('ALTER TABLE adherents ADD COLUMN description TEXT AFTER created_at');
    if (!(await hasColumn('adherents', 'fichier_final'))) await query('ALTER TABLE adherents ADD COLUMN fichier_final VARCHAR(255) AFTER description');
    if (!(await hasColumn('adherents', 'dossier_pdf'))) await query('ALTER TABLE adherents ADD COLUMN dossier_pdf VARCHAR(255) AFTER fichier_final');
    if (!(await hasColumn('adherents', 'paiement_mode'))) await query('ALTER TABLE adherents ADD COLUMN paiement_mode VARCHAR(20) AFTER dossier_pdf');
    if (!(await hasColumn('adherents', 'paiement_banque'))) await query('ALTER TABLE adherents ADD COLUMN paiement_banque VARCHAR(150) AFTER paiement_mode');
    if (!(await hasColumn('adherents', 'paiement_ref'))) await query('ALTER TABLE adherents ADD COLUMN paiement_ref VARCHAR(100) AFTER paiement_banque');
    if (!(await hasColumn('adherents', 'bureau_code'))) await query('ALTER TABLE adherents ADD COLUMN bureau_code VARCHAR(3) AFTER paiement_ref');
    if (!(await hasColumn('adherents', 'bureau_badge_type'))) await query('ALTER TABLE adherents ADD COLUMN bureau_badge_type VARCHAR(100) AFTER bureau_code');
    if (!(await hasColumn('adherents', 'qualite_ar'))) await query('ALTER TABLE adherents ADD COLUMN qualite_ar VARCHAR(100) DEFAULT NULL AFTER bureau_badge_type');
    if (!(await hasColumn('adherents', 'etoiles'))) await query('ALTER TABLE adherents ADD COLUMN etoiles TINYINT DEFAULT 0 AFTER qualite_ar');
    // Compatibilité: garde 'malus' et ajoute 'notation_negative' en synchro
    if (!(await hasColumn('adherents', 'notation_negative'))) {
      if (await hasColumn('adherents', 'malus')) {
        try { await query('ALTER TABLE adherents ADD COLUMN notation_negative TINYINT DEFAULT 0 AFTER etoiles'); } catch(e){ console.warn('add notation_negative', e.message); }
        try { await query('UPDATE adherents SET notation_negative = malus WHERE notation_negative IS NULL OR notation_negative = 0'); } catch(e){}
      } else {
        await query('ALTER TABLE adherents ADD COLUMN notation_negative TINYINT DEFAULT 0 AFTER etoiles');
      }
    }
    if (!(await hasColumn('adherents', 'malus'))) {
      try { await query('ALTER TABLE adherents ADD COLUMN malus TINYINT DEFAULT 0 AFTER notation_negative'); } catch(e){}
      try { await query('UPDATE adherents SET malus = notation_negative WHERE malus IS NULL'); } catch(e){}
    }
    // synchro au démarrage
    try { await query('UPDATE adherents SET notation_negative = malus WHERE (notation_negative IS NULL OR notation_negative != malus) AND malus IS NOT NULL'); } catch(e){}
    try { await query('UPDATE adherents SET malus = notation_negative WHERE (malus IS NULL OR malus != notation_negative) AND notation_negative IS NOT NULL'); } catch(e){}
    if (!(await hasColumn('adherents', 'fonction'))) await query('ALTER TABLE adherents ADD COLUMN fonction VARCHAR(150) DEFAULT NULL AFTER malus');
    if (!(await hasColumn('adherents', 'diplome'))) await query('ALTER TABLE adherents ADD COLUMN diplome VARCHAR(150) DEFAULT NULL AFTER fonction');
    if (!(await hasColumn('adherents', 'profession'))) await query('ALTER TABLE adherents ADD COLUMN profession VARCHAR(150) DEFAULT NULL AFTER diplome');
    if (!(await hasColumn('adherents', 'carte_remise'))) await query('ALTER TABLE adherents ADD COLUMN carte_remise TINYINT(1) DEFAULT 0 AFTER profession');
    if (!(await hasColumn('adherents', 'top_month_rank'))) await query('ALTER TABLE adherents ADD COLUMN top_month_rank INT DEFAULT NULL AFTER carte_remise');
    if (!(await hasColumn('adherents', 'top_year_rank'))) await query('ALTER TABLE adherents ADD COLUMN top_year_rank INT DEFAULT NULL AFTER top_month_rank');
  } catch (e) { console.warn('Migration colonnes adhérents étendues :', e.message); }

  try {
    if (!(await hasColumn('users', 'permissions'))) await query('ALTER TABLE users ADD COLUMN permissions TEXT AFTER role');
  } catch (e) { console.warn('Migration permissions users :', e.message); }

  for (const [name, col] of [['uq_adh_nin', 'nin'], ['uq_adh_tel', 'telephone']]) {
    try { await query(`ALTER TABLE adherents ADD UNIQUE KEY ${name} (${col})`); } catch {}
  }

  for (const [col, ddl] of [
    ['numero', "ADD COLUMN numero VARCHAR(30)"],
    ['statut', "ADD COLUMN statut VARCHAR(20) NOT NULL DEFAULT 'En attente'"],
    ['affecte_a', "ADD COLUMN affecte_a VARCHAR(150)"],
    ['reponse', "ADD COLUMN reponse TEXT"],
    ['source', "ADD COLUMN source VARCHAR(20) DEFAULT 'site'"],
  ]) {
    try {
      if (!(await hasColumn('demandes_site', col))) {
        await query(`ALTER TABLE demandes_site ${ddl}`);
        if (col === 'numero') {
          const list = await query('SELECT id FROM demandes_site WHERE numero IS NULL');
          for (let i = 0; i < list.length; i++) {
            await query('UPDATE demandes_site SET numero = ? WHERE id = ?', [`DEM-2026-${String(i + 1).padStart(4, '0')}`, list[i].id]);
          }
        }
      }
    } catch {}
  }
}

export default { connect, getPool, query, get, run, initSchema };
