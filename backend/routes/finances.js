<<<<<<< HEAD
=======
// ============================================================
//  routes/finances.js — ✅ PATCH ANTI « FAUX SUCCÈS » (22/09/2026)
//  - PATCH/DELETE : ensureFinanceSchema() + contrôle affectedRows
//    → si rien n'est modifié/supprimé en base, l'API renvoie 404
//    (plus de message « succès » alors que rien ne s'est passé)
//  - POST : contrôle insertId + logs serveur
//  - Le reste du fichier est INCHANGÉ
//  ✅ 22/09/2026 (pack fallback) : + POST /mouvements/update et
//     POST /mouvements/delete (secours si PATCH/DELETE bloqués par
//     le pare-feu de l'hébergeur). Anciennes routes conservées.
//  ✅ 22/09/2026 (pack montants) : + POST /comptes/update (secours),
//     montants à 5 décimales + virgule FR acceptée (117226,34).
// ============================================================
>>>>>>> 0e2f66d53026f4fbb000dd7baf5779d721660afa
import express from 'express';
import { get, query, run } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction } from '../audit.js';

const router = express.Router();

export const COMPTES = [
  { code: 'BDL', label: 'BDL — Banque de Développement Local' },
  { code: 'CPA', label: "CPA — Crédit Populaire d'Algérie" },
  { code: 'CAISSE', label: 'Caisse (espèces)' },
];

const COMPTE_CODES = COMPTES.map((c) => c.code);
const SENS = ['entree', 'sortie'];
const NATURES_ENTREE = ['cheque', 'espece', 'virement', 'autre'];
const NATURES_SORTIE = ['paiement_employe', 'loyer', 'charges', 'fournitures', 'deplacement', 'commission_tva', 'commission', 'tva', 'ebanking', 'frais_application', 'autre'];
const MOTIFS_SORTIE = [
  { code: 'paiement_employe', label: 'Paiement employé' },
  { code: 'loyer', label: 'Loyer' },
  { code: 'charges', label: 'Charges' },
  { code: 'fournitures', label: 'Fournitures' },
  { code: 'deplacement', label: 'Déplacement' },
  { code: 'commission_tva', label: 'Commissions et TVA' },
  { code: 'commission', label: 'Commission' },
  { code: 'tva', label: 'TVA' },
  { code: 'ebanking', label: 'ebanking' },
  { code: 'frais_application', label: "Frais d'application" },
  { code: 'autre', label: 'Autre' },
];
const EBANKING_MONTANT = 2000;
const CPA_FRAIS_APP_MONTANT = 1071;

// ✅ 22/09/2026 : accepte « 117226,34 » (virgule FR), « 117 226,34 » (espaces),
// « 117.226,34 » (européen) et « 117,226.34 » (anglo-saxon).
function toNumber(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/[\s\u00A0\u202F]/g, '');
  if (s === '') return NaN;
  if (s.includes(',')) {
    if (s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }
  return Number(s);
}
function num(v) {
  const n = toNumber(v);
  return Number.isFinite(n) ? n : 0;
}
// Montants arrondis à 5 décimales (colonnes DECIMAL(15,5)).
function round5(v) {
  return Math.round(num(v) * 100000) / 100000;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function labelCompte(code) {
  return COMPTES.find((c) => c.code === code)?.label || code;
}
function labelNature(sens, nature) {
  if (sens === 'sortie') return MOTIFS_SORTIE.find((m) => m.code === nature)?.label || nature;
  const map = { cheque: 'Chèque', espece: 'Espèce', virement: 'Virement', autre: 'Autre entrée' };
  return map[nature] || nature;
}

export async function ensureFinanceSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS finance_comptes (
      code VARCHAR(20) PRIMARY KEY,
      label VARCHAR(120) NOT NULL,
      montant_initial DECIMAL(15,5) NOT NULL DEFAULT 0,
      observation TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS finance_mouvements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      compte_code VARCHAR(20) NOT NULL,
      sens ENUM('entree','sortie') NOT NULL,
      nature VARCHAR(40) NOT NULL,
      montant DECIMAL(15,5) NOT NULL,
      date_mouvement DATE NOT NULL,
      adherent_id INT DEFAULT NULL,
      cheque_numero VARCHAR(20) DEFAULT NULL,
      motif VARCHAR(150) DEFAULT NULL,
      observation TEXT,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_fin_compte FOREIGN KEY (compte_code) REFERENCES finance_comptes(code),
      CONSTRAINT fk_fin_adherent FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE SET NULL,
      CONSTRAINT fk_fin_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_fin_compte (compte_code),
      INDEX idx_fin_date (date_mouvement),
      INDEX idx_fin_adherent (adherent_id),
      INDEX idx_fin_sens (sens)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS finance_frais_mensuels_log (
      compte_code VARCHAR(20) NOT NULL,
      nature VARCHAR(40) NOT NULL,
      mois VARCHAR(7) NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (compte_code, nature, mois)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ✅ 22/09/2026 : élargit les montants à 5 décimales sur les bases existantes.
  // DECIMAL(15,2) -> DECIMAL(15,5) = sans perte (données conservées).
  for (const [table, column, ddl] of [
    ['finance_comptes', 'montant_initial', 'DECIMAL(15,5) NOT NULL DEFAULT 0'],
    ['finance_mouvements', 'montant', 'DECIMAL(15,5) NOT NULL'],
  ]) {
    try {
      const cols = await query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
      const type = String(cols[0]?.Type || '').toLowerCase().replace(/\s+/g, '');
      if (type.startsWith('decimal') && type !== 'decimal(15,5)') {
        await query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${ddl}`);
        console.log(`  \u2705 ${table}.${column} \u2192 ${ddl}`);
      }
    } catch (e) {
      console.warn(`Migration d\u00e9cimales ${table}.${column} :`, e.message);
    }
  }

  for (const c of COMPTES) {
    const exists = await get('SELECT code FROM finance_comptes WHERE code = ?', [c.code]);
    if (!exists) {
      await run(
        'INSERT INTO finance_comptes (code, label, montant_initial, observation) VALUES (?,?,?,?)',
        [c.code, c.label, 0, null]
      );
    } else {
      await run('UPDATE finance_comptes SET label = ? WHERE code = ?', [c.label, c.code]);
    }
  }

  await ensureMonthlyFees();
}

export async function ensureMonthlyFees() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = now.toISOString().slice(0, 10);

    const startYear = 2026;

    for (let y = startYear; y <= currentYear; y++) {
      const endM = (y === currentYear) ? currentMonth : 11;
      for (let m = 0; m <= endM; m++) {
        const lastDayObj = new Date(Date.UTC(y, m + 1, 0));
        const year = lastDayObj.getUTCFullYear();
        const monthNum = lastDayObj.getUTCMonth() + 1;
        const monthStr = String(monthNum).padStart(2, '0');
        const dayStr = String(lastDayObj.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        const moisKey = `${year}-${monthStr}`;

        if (dateStr > todayStr) {
          continue;
        }

        // CPA Frais d'application (1071 DA chaque fin de mois)
        const logCpa = await get(
          `SELECT mois FROM finance_frais_mensuels_log WHERE compte_code = 'CPA' AND nature = 'frais_application' AND mois = ?`,
          [moisKey]
        );

        if (!logCpa) {
          await run(
            `INSERT IGNORE INTO finance_frais_mensuels_log (compte_code, nature, mois) VALUES ('CPA', 'frais_application', ?)`,
            [moisKey]
          );

          const existingCpa = await get(
            `SELECT id FROM finance_mouvements WHERE compte_code = 'CPA' AND nature = 'frais_application' AND date_mouvement = ?`,
            [dateStr]
          );

          if (!existingCpa) {
            await run(
              `INSERT INTO finance_mouvements (compte_code, sens, nature, montant, date_mouvement, motif, observation)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['CPA', 'sortie', 'frais_application', CPA_FRAIS_APP_MONTANT, dateStr, "Frais d'application (fin de mois)", 'Déduction automatique fin de mois (1 071 DA)']
            );
          }
        }

        // BDL Frais ebanking (2000 DA chaque fin de mois)
        const logBdl = await get(
          `SELECT mois FROM finance_frais_mensuels_log WHERE compte_code = 'BDL' AND nature = 'ebanking' AND mois = ?`,
          [moisKey]
        );

        if (!logBdl) {
          await run(
            `INSERT IGNORE INTO finance_frais_mensuels_log (compte_code, nature, mois) VALUES ('BDL', 'ebanking', ?)`,
            [moisKey]
          );

          const existingBdl = await get(
            `SELECT id FROM finance_mouvements WHERE compte_code = 'BDL' AND nature = 'ebanking' AND date_mouvement = ?`,
            [dateStr]
          );

          if (!existingBdl) {
            await run(
              `INSERT INTO finance_mouvements (compte_code, sens, nature, montant, date_mouvement, motif, observation)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ['BDL', 'sortie', 'ebanking', EBANKING_MONTANT, dateStr, 'Frais ebanking (fin de mois)', 'Déduction automatique fin de mois (2 000 DA)']
            );
          }
        }
      }
    }
  } catch (e) {
    console.error('Erreur lors de la vérification des frais mensuels :', e.message);
  }
}

async function getComptesWithSoldes() {
  const comptes = await query('SELECT code, label, montant_initial, observation, updated_at FROM finance_comptes ORDER BY FIELD(code, "BDL","CPA","CAISSE")');
  const agg = await query(`
    SELECT compte_code,
      SUM(CASE WHEN sens = 'entree' THEN montant ELSE 0 END) AS entrees,
      SUM(CASE WHEN sens = 'sortie' THEN montant ELSE 0 END) AS sorties,
      SUM(CASE WHEN sens = 'entree' AND nature = 'virement' THEN montant ELSE 0 END) AS virements,
      SUM(CASE WHEN sens = 'entree' AND nature = 'cheque' THEN montant ELSE 0 END) AS cheques,
      SUM(CASE WHEN sens = 'entree' AND nature = 'espece' THEN montant ELSE 0 END) AS especes
    FROM finance_mouvements
    GROUP BY compte_code
  `);
  const byCode = Object.fromEntries(agg.map((r) => [r.compte_code, r]));
  return comptes.map((c) => {
    const a = byCode[c.code] || {};
    const initial = round5(c.montant_initial);
    const entrees = round5(a.entrees);
    const sorties = round5(a.sorties);
    return {
      code: c.code,
      label: c.label,
      observation: c.observation || '',
      montant_initial: initial,
      entrees,
      sorties,
      virements: round5(a.virements),
      cheques: round5(a.cheques),
      especes: round5(a.especes),
      solde: round5(initial + entrees - sorties),
      updated_at: c.updated_at,
    };
  });
}

function parseMouvementBody(body = {}, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.compte_code !== undefined) {
    const code = String(body.compte_code || '').toUpperCase().trim();
    if (!COMPTE_CODES.includes(code)) errors.push('Compte invalide (BDL, CPA ou Caisse).');
    else out.compte_code = code;
  }

  if (!partial || body.sens !== undefined) {
    const sens = String(body.sens || '').toLowerCase();
    if (!SENS.includes(sens)) errors.push('Sens invalide (entrée ou sortie).');
    else out.sens = sens;
  }

  if (!partial || body.nature !== undefined) {
    out.nature = String(body.nature || '').trim().toLowerCase();
  }

  if (!partial || body.montant !== undefined) {
    const montant = round5(body.montant);
    if (!(montant > 0)) errors.push('Le montant doit être supérieur à 0.');
    else out.montant = montant;
  }

  if (!partial || body.date_mouvement !== undefined) {
    const d = String(body.date_mouvement || today()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push('Date invalide.');
    else out.date_mouvement = d;
  }

  if (!partial || body.adherent_id !== undefined) {
    const id = body.adherent_id === '' || body.adherent_id === null || body.adherent_id === undefined
      ? null
      : parseInt(body.adherent_id, 10);
    out.adherent_id = Number.isFinite(id) ? id : null;
  }

  if (!partial || body.cheque_numero !== undefined) {
    const n = String(body.cheque_numero || '').trim();
    out.cheque_numero = n || null;
  }

  if (!partial || body.motif !== undefined) {
    const m = String(body.motif || '').trim();
    out.motif = m ? m.slice(0, 150) : null;
  }

  if (!partial || body.observation !== undefined) {
    const o = String(body.observation || '').trim();
    out.observation = o || null;
  }

  const sens = out.sens;
  const nature = out.nature;
  if (sens === 'entree' && nature && !NATURES_ENTREE.includes(nature)) {
    errors.push('Nature d’entrée invalide.');
  }
  if (sens === 'sortie' && nature && !NATURES_SORTIE.includes(nature)) {
    errors.push('Cause de sortie invalide.');
  }
  if (!partial && !nature) errors.push('Nature / cause obligatoire.');
  if (sens === 'entree' && nature === 'cheque') {
    if (out.cheque_numero && !/^\d{7}$/.test(out.cheque_numero)) {
      errors.push('Le numéro de chèque doit contenir exactement 7 chiffres.');
    }
  }

  return { errors, data: out };
}

const SELECT_MOUV = `
  SELECT m.*,
    a.nom AS adherent_nom, a.prenom AS adherent_prenom, a.matricule AS adherent_matricule,
    a.paiement_mode AS adherent_paiement_mode, a.paiement_ref AS adherent_paiement_ref,
    a.paiement_banque AS adherent_paiement_banque,
    u.email AS created_by_email
  FROM finance_mouvements m
  LEFT JOIN adherents a ON a.id = m.adherent_id
  LEFT JOIN users u ON u.id = m.created_by
`;

router.get('/meta', authenticate, authorize('admin', 'president'), (_req, res) => {
  res.json({
    comptes: COMPTES,
    naturesEntree: [
      { code: 'cheque', label: 'Chèque' },
      { code: 'espece', label: 'Espèce' },
      { code: 'virement', label: 'Virement' },
      { code: 'autre', label: 'Autre entrée' },
    ],
    motifsSortie: MOTIFS_SORTIE,
  });
});

router.get('/dashboard', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    await ensureFinanceSchema();
    const comptes = await getComptesWithSoldes();
    const bdl = comptes.find((c) => c.code === 'BDL') || { solde: 0, virements: 0 };
    const cpa = comptes.find((c) => c.code === 'CPA') || { solde: 0, virements: 0 };
    const caisse = comptes.find((c) => c.code === 'CAISSE') || { solde: 0 };
    const recent = await query(`${SELECT_MOUV} ORDER BY m.date_mouvement DESC, m.id DESC LIMIT 12`);
    const totaux = {
      bdl: bdl.solde,
      cpa: cpa.solde,
      caisse: caisse.solde,
      banques: round5(bdl.solde + cpa.solde),
      general: round5(bdl.solde + cpa.solde + caisse.solde),
      virementsBdl: bdl.virements || 0,
      virementsCpa: cpa.virements || 0,
      virementsBanques: round5((bdl.virements || 0) + (cpa.virements || 0)),
    };
    const counts = await get(`
      SELECT
        SUM(sens = 'entree') AS n_entrees,
        SUM(sens = 'sortie') AS n_sorties,
        SUM(sens = 'entree' AND nature = 'cheque') AS n_cheques
      FROM finance_mouvements
    `);
    res.json({
      comptes,
      totaux,
      counts: {
        entrees: num(counts?.n_entrees),
        sorties: num(counts?.n_sorties),
        cheques: num(counts?.n_cheques),
      },
      recent,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/comptes', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    await ensureFinanceSchema();
    res.json(await getComptesWithSoldes());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function handleUpdateCompte(req, res, codeRaw, bodyObj) {
  try {
    await ensureFinanceSchema();
    const code = String(codeRaw || '').toUpperCase();
    if (!COMPTE_CODES.includes(code)) return res.status(400).json({ error: 'Compte invalide.' });
    const existing = await get('SELECT * FROM finance_comptes WHERE code = ?', [code]);
    if (!existing) return res.status(404).json({ error: 'Compte introuvable.' });

    const updates = [];
    const params = [];
    if (bodyObj.montant_initial !== undefined) {
      const rawStr = String(bodyObj.montant_initial ?? '').trim();
      if (rawStr !== '' && !Number.isFinite(toNumber(bodyObj.montant_initial))) {
        return res.status(400).json({ error: 'Montant initial invalide (ex : 117226,34).' });
      }
      const v = round5(bodyObj.montant_initial);
      if (v < 0) return res.status(400).json({ error: 'Le montant initial ne peut pas être négatif.' });
      updates.push('montant_initial = ?');
      params.push(v);
    }
    if (bodyObj.observation !== undefined) {
      updates.push('observation = ?');
      params.push(String(bodyObj.observation || '').trim() || null);
    }
    if (!updates.length) return res.status(400).json({ error: 'Aucune modification.' });
    params.push(code);
    await run(`UPDATE finance_comptes SET ${updates.join(', ')} WHERE code = ?`, params);
    await logAction(req, 'EDIT_FINANCE_COMPTE', `Mise à jour du compte ${labelCompte(code)}`, code, 'finance');
    const comptes = await getComptesWithSoldes();
    res.json(comptes.find((c) => c.code === code));
  } catch (e) {
    console.error('FINANCE update compte :', e.message);
    res.status(500).json({ error: e.message });
  }
}

router.patch('/comptes/:code', authenticate, authorize('admin', 'president'), (req, res) =>
  handleUpdateCompte(req, res, req.params.code, req.body)
);

// ✅ SECOURS POST (22/09/2026) — PATCH parfois intercepté par le pare-feu
// de l'hébergeur (erreur « HTML reçu au lieu de JSON »). Même effet en POST.
router.post('/comptes/update', authenticate, authorize('admin', 'president'), (req, res) =>
  handleUpdateCompte(req, res, req.body?.code, req.body || {})
);

router.get('/adherents-payes', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    await ensureFinanceSchema();
    const mode = String(req.query.mode || '').toLowerCase();
    const q = String(req.query.q || '').trim();
    const params = [];
    let where;
    if (q) {
      where = 'WHERE (a.nom LIKE ? OR a.prenom LIKE ? OR a.matricule LIKE ? OR a.paiement_ref LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    } else {
      where = `WHERE (
        a.paiement_mode IN ('cheque','espece','virement')
        OR a.description = 'Ajout rapide finances'
        OR EXISTS (SELECT 1 FROM finance_mouvements fm WHERE fm.adherent_id = a.id AND fm.sens = 'entree')
      )`;
    }
    if (['cheque', 'espece', 'virement'].includes(mode)) {
      where += ' AND a.paiement_mode = ?';
      params.push(mode);
    }
    const rows = await query(`
      SELECT a.id, a.matricule, a.nom, a.prenom, a.telephone, a.paiement_mode, a.paiement_ref, a.paiement_banque, a.date_adhesion,
        (SELECT COUNT(*) FROM finance_mouvements m WHERE m.adherent_id = a.id AND m.sens = 'entree') AS n_encaissements,
        (SELECT COALESCE(SUM(m.montant),0) FROM finance_mouvements m WHERE m.adherent_id = a.id AND m.sens = 'entree') AS total_encaisse
      FROM adherents a
      ${where}
      ORDER BY a.nom ASC, a.prenom ASC
    `, params);
    res.json(rows.map((r) => ({
      ...r,
      n_encaissements: num(r.n_encaissements),
      total_encaisse: round5(r.total_encaisse),
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/adherents-rapides', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    await ensureFinanceSchema();
    const nom = String(req.body.nom || '').trim();
    const prenom = String(req.body.prenom || '').trim();
    const matricule = String(req.body.matricule || '').trim().slice(0, 40);
    if (!nom) return res.status(400).json({ error: 'Le nom est obligatoire.' });
    if (!prenom) return res.status(400).json({ error: 'Le prénom est obligatoire.' });
    if (!matricule) return res.status(400).json({ error: 'Le matricule est obligatoire.' });
    const exists = await get('SELECT id, nom, prenom FROM adherents WHERE matricule = ?', [matricule]);
    if (exists) {
      return res.status(409).json({ error: `Ce matricule existe déjà (${exists.nom} ${exists.prenom}).` });
    }
    const year = new Date().getFullYear();
    const dateAdh = today();
    const result = await run(
      `INSERT INTO adherents
        (matricule, nom, prenom, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [matricule, nom, prenom, '16', 'AD', 'Adhérent Simple', 0, year, dateAdh, 'Ajout rapide finances']
    );
    const id = result?.insertId || result?.id;
    const created = await get(
      `SELECT a.id, a.matricule, a.nom, a.prenom, a.telephone, a.paiement_mode, a.paiement_ref, a.paiement_banque, a.date_adhesion
       FROM adherents a WHERE a.id = ?`,
      [id]
    );
    await logAction(req, 'CREATE_ADHERENT', `Ajout rapide finances : ${nom} ${prenom} (Matricule: ${matricule})`, id, 'adherent');
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/mouvements', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    await ensureFinanceSchema();
    const { sens, compte, nature, q } = req.query;
    const where = [];
    const params = [];
    if (sens && SENS.includes(String(sens))) { where.push('m.sens = ?'); params.push(sens); }
    if (compte && COMPTE_CODES.includes(String(compte).toUpperCase())) {
      where.push('m.compte_code = ?'); params.push(String(compte).toUpperCase());
    }
    if (nature) { where.push('m.nature = ?'); params.push(String(nature)); }
    if (q && String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      where.push('(a.nom LIKE ? OR a.prenom LIKE ? OR a.matricule LIKE ? OR m.cheque_numero LIKE ? OR m.motif LIKE ? OR m.observation LIKE ?)');
      params.push(like, like, like, like, like, like);
    }
    const sql = `${SELECT_MOUV} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.date_mouvement DESC, m.id DESC LIMIT 500`;
    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/mouvements', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    await ensureFinanceSchema();
    const { errors, data } = parseMouvementBody(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (data.adherent_id) {
      const adh = await get('SELECT id, nom, prenom FROM adherents WHERE id = ?', [data.adherent_id]);
      if (!adh) return res.status(400).json({ error: 'Adhérent introuvable.' });
    }
    const r = await run(
      `INSERT INTO finance_mouvements
        (compte_code, sens, nature, montant, date_mouvement, adherent_id, cheque_numero, motif, observation, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        data.compte_code, data.sens, data.nature, data.montant, data.date_mouvement,
        data.adherent_id || null, data.cheque_numero, data.motif, data.observation, req.user.id,
      ]
    );
    if (!r || !r.insertId) {
      console.error('FINANCE POST : INSERT sans insertId — vérifiez la table finance_mouvements.');
      return res.status(500).json({ error: 'Écriture impossible dans finance_mouvements (insertId manquant).' });
    }
    const desc = `${data.sens === 'entree' ? 'Entrée' : 'Sortie'} ${labelNature(data.sens, data.nature)} de ${data.montant} DA sur ${labelCompte(data.compte_code)}`;
    await logAction(req, data.sens === 'entree' ? 'FINANCE_ENTREE' : 'FINANCE_SORTIE', desc, r.insertId, 'finance');
    const row = await get(`${SELECT_MOUV} WHERE m.id = ?`, [r.insertId]);
    res.status(201).json(row);
  } catch (e) {
    console.error('FINANCE POST /mouvements :', e.message);
    res.status(500).json({ error: e.message });
  }
});

async function handleUpdateMouvement(req, res, idRaw, bodyObj) {
  try {
    await ensureFinanceSchema();
    const id = parseInt(idRaw, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
    const existing = await get('SELECT * FROM finance_mouvements WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Mouvement introuvable.' });
    const { errors, data } = parseMouvementBody({ ...existing, ...bodyObj }, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const merged = { ...existing, ...data };
    if (merged.sens === 'entree' && !NATURES_ENTREE.includes(merged.nature)) {
      return res.status(400).json({ error: 'Nature d’entrée invalide.' });
    }
    if (merged.sens === 'sortie' && !NATURES_SORTIE.includes(merged.nature)) {
      return res.status(400).json({ error: 'Cause de sortie invalide.' });
    }
    const upd = await run(
      `UPDATE finance_mouvements SET
        compte_code=?, sens=?, nature=?, montant=?, date_mouvement=?, adherent_id=?, cheque_numero=?, motif=?, observation=?
       WHERE id=?`,
      [
        merged.compte_code, merged.sens, merged.nature, round5(merged.montant), String(merged.date_mouvement).slice(0, 10),
        merged.adherent_id || null, merged.cheque_numero || null, merged.motif || null, merged.observation || null, id,
      ]
    );
    if (upd && upd.affectedRows === 0) {
      return res.status(404).json({ error: 'Mouvement introuvable (aucune ligne modifiée).' });
    }
    await logAction(req, 'EDIT_FINANCE_MOUVEMENT', `Modification du mouvement #${id}`, id, 'finance');
    res.json(await get(`${SELECT_MOUV} WHERE m.id = ?`, [id]));
  } catch (e) {
    console.error('FINANCE update mouvement :', e.message);
    res.status(500).json({ error: e.message });
  }
}

router.patch('/mouvements/:id', authenticate, authorize('admin', 'president'), (req, res) =>
  handleUpdateMouvement(req, res, req.params.id, req.body)
);

// ✅ SECOURS POST (22/09/2026) — certains hébergeurs interceptent PATCH/DELETE
// et renvoient la page d'accueil (200 + HTML) au lieu d'appeler l'API.
// Ces routes font EXACTEMENT la même chose, mais en POST (jamais bloqué)
// et sans id dans l'URL (id dans le corps JSON).
router.post('/mouvements/update', authenticate, authorize('admin', 'president'), (req, res) =>
  handleUpdateMouvement(req, res, req.body?.id, req.body || {})
);

async function handleDeleteMouvement(req, res, idRaw) {
  try {
    await ensureFinanceSchema();
    const id = parseInt(idRaw, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
    const existing = await get('SELECT * FROM finance_mouvements WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Mouvement introuvable.' });
    const del = await run('DELETE FROM finance_mouvements WHERE id = ?', [id]);
    if (del && del.affectedRows === 0) {
      return res.status(404).json({ error: 'Mouvement introuvable (aucune ligne supprimée).' });
    }
    await logAction(req, 'DELETE_FINANCE_MOUVEMENT', `Suppression du mouvement #${id} (${existing.sens} ${existing.montant} DA)`, id, 'finance');
    res.json({ ok: true });
  } catch (e) {
    console.error('FINANCE delete mouvement :', e.message);
    res.status(500).json({ error: e.message });
  }
}

router.delete('/mouvements/:id', authenticate, authorize('admin', 'president'), (req, res) =>
  handleDeleteMouvement(req, res, req.params.id)
);

// ✅ SECOURS POST (22/09/2026) : suppression via POST + { id } dans le corps.
router.post('/mouvements/delete', authenticate, authorize('admin', 'president'), (req, res) =>
  handleDeleteMouvement(req, res, req.body?.id)
);

export default router;
