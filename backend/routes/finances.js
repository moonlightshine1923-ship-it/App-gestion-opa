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
const NATURES_SORTIE = ['paiement_employe', 'loyer', 'charges', 'fournitures', 'deplacement', 'commission_tva', 'commission', 'tva', 'ebanking', 'autre'];
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
  { code: 'autre', label: 'Autre' },
];
const EBANKING_MONTANT = 2000;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(v) {
  return Math.round(num(v) * 100) / 100;
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
      montant_initial DECIMAL(15,2) NOT NULL DEFAULT 0,
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
      montant DECIMAL(15,2) NOT NULL,
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
    const initial = round2(c.montant_initial);
    const entrees = round2(a.entrees);
    const sorties = round2(a.sorties);
    return {
      code: c.code,
      label: c.label,
      observation: c.observation || '',
      montant_initial: initial,
      entrees,
      sorties,
      virements: round2(a.virements),
      cheques: round2(a.cheques),
      especes: round2(a.especes),
      solde: round2(initial + entrees - sorties),
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
    const montant = round2(body.montant);
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
      banques: round2(bdl.solde + cpa.solde),
      general: round2(bdl.solde + cpa.solde + caisse.solde),
      virementsBdl: bdl.virements || 0,
      virementsCpa: cpa.virements || 0,
      virementsBanques: round2((bdl.virements || 0) + (cpa.virements || 0)),
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

router.patch('/comptes/:code', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    await ensureFinanceSchema();
    const code = String(req.params.code || '').toUpperCase();
    if (!COMPTE_CODES.includes(code)) return res.status(400).json({ error: 'Compte invalide.' });
    const existing = await get('SELECT * FROM finance_comptes WHERE code = ?', [code]);
    if (!existing) return res.status(404).json({ error: 'Compte introuvable.' });

    const updates = [];
    const params = [];
    if (req.body.montant_initial !== undefined) {
      const v = round2(req.body.montant_initial);
      if (v < 0) return res.status(400).json({ error: 'Le montant initial ne peut pas être négatif.' });
      updates.push('montant_initial = ?');
      params.push(v);
    }
    if (req.body.observation !== undefined) {
      updates.push('observation = ?');
      params.push(String(req.body.observation || '').trim() || null);
    }
    if (!updates.length) return res.status(400).json({ error: 'Aucune modification.' });
    params.push(code);
    await run(`UPDATE finance_comptes SET ${updates.join(', ')} WHERE code = ?`, params);
    await logAction(req, 'EDIT_FINANCE_COMPTE', `Mise à jour du compte ${labelCompte(code)}`, code, 'finance');
    const comptes = await getComptesWithSoldes();
    res.json(comptes.find((c) => c.code === code));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
      total_encaisse: round2(r.total_encaisse),
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
    const desc = `${data.sens === 'entree' ? 'Entrée' : 'Sortie'} ${labelNature(data.sens, data.nature)} de ${data.montant} DA sur ${labelCompte(data.compte_code)}`;
    await logAction(req, data.sens === 'entree' ? 'FINANCE_ENTREE' : 'FINANCE_SORTIE', desc, r.insertId, 'finance');
    const row = await get(`${SELECT_MOUV} WHERE m.id = ?`, [r.insertId]);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/mouvements/:id', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get('SELECT * FROM finance_mouvements WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Mouvement introuvable.' });
    const { errors, data } = parseMouvementBody({ ...existing, ...req.body }, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const merged = { ...existing, ...data };
    if (merged.sens === 'entree' && !NATURES_ENTREE.includes(merged.nature)) {
      return res.status(400).json({ error: 'Nature d’entrée invalide.' });
    }
    if (merged.sens === 'sortie' && !NATURES_SORTIE.includes(merged.nature)) {
      return res.status(400).json({ error: 'Cause de sortie invalide.' });
    }
    await run(
      `UPDATE finance_mouvements SET
        compte_code=?, sens=?, nature=?, montant=?, date_mouvement=?, adherent_id=?, cheque_numero=?, motif=?, observation=?
       WHERE id=?`,
      [
        merged.compte_code, merged.sens, merged.nature, round2(merged.montant), String(merged.date_mouvement).slice(0, 10),
        merged.adherent_id || null, merged.cheque_numero || null, merged.motif || null, merged.observation || null, id,
      ]
    );
    await logAction(req, 'EDIT_FINANCE_MOUVEMENT', `Modification du mouvement #${id}`, id, 'finance');
    res.json(await get(`${SELECT_MOUV} WHERE m.id = ?`, [id]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/mouvements/:id', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get('SELECT * FROM finance_mouvements WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Mouvement introuvable.' });
    await run('DELETE FROM finance_mouvements WHERE id = ?', [id]);
    await logAction(req, 'DELETE_FINANCE_MOUVEMENT', `Suppression du mouvement #${id} (${existing.sens} ${existing.montant} DA)`, id, 'finance');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
