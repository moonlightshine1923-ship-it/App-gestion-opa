import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { get, query, run } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadPhoto } from '../middleware/upload.js';
import { generateMatricule, buildMatricule, nextNumOrdre } from '../matricule.js';
import { wilayaNom, wilayaNomAr, docTypeLibelle, carteInfo, TYPES, NIVEAUX, DOC_TYPES } from '../data/wilayas.js';
import { logAction } from '../audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARTE_DIR = path.join(__dirname, '..', '..', 'frontend', 'assets', 'carte');
const MODELS_DIR = path.join(CARTE_DIR, 'models');

function getDynamicDataUri(fileName) {
  try {
    const filePath = path.join(MODELS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      return 'data:image/png;base64,' + fs.readFileSync(filePath).toString('base64');
    }
  } catch (e) {
    console.error("Erreur lecture fichier modèle :", fileName, e);
  }
  return '';
}

const router = express.Router();

function enrich(a) {
  if (!a) return a;
  // compat: alias notation_negative <-> malus
  if (a.notation_negative !== undefined && a.malus === undefined) a.malus = a.notation_negative;
  if (a.malus !== undefined && a.notation_negative === undefined) a.notation_negative = a.malus;
  let tObj = null;
  if (a.type_code === 'AD') {
    const isGold = (a.niveau && a.niveau.toLowerCase().includes('gold'));
    tObj = TYPES.find((t) => t.code === (isGold ? 'AD_gold' : 'AD_simple'));
  } else {
    tObj = TYPES.find((t) => t.realCode === a.type_code || t.code === a.type_code);
  }
  return {
    ...a,
    wilaya_nom: wilayaNom(a.wilaya_code),
    wilaya_nom_ar: wilayaNomAr(a.wilaya_code),
    type_libelle: tObj ? tObj.libelle : a.type_code,
    doc_type_libelle: docTypeLibelle(a.doc_type),
  };
}

/* ────────────────────────────────────────────────────────s
   FIX 1 : normalizePaiementMode — ajout de 'non_assujetti'
   ──────────────────────────────────────────────────────── */
function normalizePaiementMode(mode) {
  const m = String(mode || '').trim().toLowerCase();
  if (['cheque', 'chèque'].includes(m)) return 'cheque';
  if (['espece', 'espèce', 'especes', 'espèces'].includes(m)) return 'espece';
  if (m === 'virement') return 'virement';
  if (m === 'non_assujetti') return 'non_assujetti';
  return '';
}

/* ──────────────────────────────────────────────
   FIX 2 : normalizePaiementData — si non_assujetti, on vide ref/banque
   ────────────────────────────────────────────── */
function normalizePaiementData(b = {}) {
  const paiement_mode = normalizePaiementMode(b.paiement_mode);

  /* Non assujetti → pas de ref ni banque */
  if (paiement_mode === 'non_assujetti') {
    return { paiement_mode: 'non_assujetti', paiement_ref: null, paiement_banque: null };
  }

  const paiement_ref = b.paiement_ref !== undefined && b.paiement_ref !== null && String(b.paiement_ref).trim() !== ''
    ? String(b.paiement_ref).trim()
    : null;
  const paiement_banque = b.paiement_banque !== undefined && b.paiement_banque !== null && String(b.paiement_banque).trim() !== ''
    ? String(b.paiement_banque).trim()
    : null;

  if (paiement_mode === 'espece' || !paiement_mode) {
    return { paiement_mode: paiement_mode || null, paiement_ref: null, paiement_banque: null };
  }

  return { paiement_mode, paiement_ref, paiement_banque };
}

function opt(v, fallback = null) {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s === '' ? fallback : s;
}

function text(v) {
  return String(v || '').trim();
}

function normalizeTypeCode(v) {
  const t = String(v || 'AD').trim();
  if (t === 'AD_simple' || t === 'AD_gold') return 'AD';
  return t || 'AD';
}

function normalizeNiveau(type_code, niveau, badgeType) {
  const n = text(niveau);
  const t = normalizeTypeCode(type_code);
  if (t === 'BE') return 'Bureau exécutif';
  if (t === 'MA') return 'Membre Actif';
  if (t === 'CR') return 'Conseiller';
  if (n.toLowerCase().includes('gold')) return 'Adhérent Gold';
  return n || 'Adhérent Simple';
}

function normalizeBureauCode(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || null;
}

function normalizeEtoiles(v) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function normalizeNotationNegative(v) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, n));
}
function normalizeMalus(v){ return normalizeNotationNegative(v); } // compat

function normalizeCarteRemise(v) {
  if (v === true || v === 1 || v === '1' || v == 'on' || v === 'true') return 1;
  return 0;
}

function isEtranger(wilayaCode) {
  return String(wilayaCode || '').toUpperCase() === 'ETR';
}

function normalizeMatriculeManuel(v) {
  return String(v || '').trim().slice(0, 40);
}

/* ──────────────────────────────────────────────
   FIX 3 : validate — skip paiement quand non_assujetti
   ────────────────────────────────────────────── */
function validate(b, { partial = false } = {}) {
  const errors = [];
  const req = (v) => v !== undefined && v !== null && String(v).trim() !== '';
  const type_code = normalizeTypeCode(b.type_code);
  const paiement = normalizePaiementData(b);
  const bureau_code = normalizeBureauCode(b.bureau_code);
  const bureau_badge_type = opt(b.bureau_badge_type);
  const etoiles = normalizeEtoiles(b.etoiles);
  const notation_negative = normalizeNotationNegative(b.notation_negative ?? b.malus);

  if (type_code === 'BE') {
    if (!bureau_code || bureau_code.length !== 3) errors.push('Le code Bureau exécutif doit contenir exactement 3 caractères.');
    if (!req(bureau_badge_type)) errors.push('Le type affiché sur le badge du Bureau exécutif est obligatoire.');
  }

  if (isEtranger(b.wilaya_code)) {
    if (!req(b.matricule)) errors.push('Le matricule manuel est obligatoire pour un pays étranger.');
    else if (String(b.matricule).trim().length > 40) errors.push('Le matricule ne doit pas dépasser 40 caractères.');
    if (!req(b.qualite_ar)) errors.push('Le champ الصفة est obligatoire pour un pays étranger.');
  }

  /* Validation paiement SEULEMENT si ce n'est PAS non_assujetti */
  if (paiement.paiement_mode !== 'non_assujetti') {
    if (paiement.paiement_mode === 'cheque') {
      if (!req(paiement.paiement_ref)) errors.push('Le numéro de chèque est obligatoire.');
      else if (!/^\d{7}$/.test(String(paiement.paiement_ref))) errors.push('Le numéro de chèque doit contenir exactement 7 chiffres.');
      if (!req(paiement.paiement_banque)) errors.push('La banque du chèque est obligatoire.');
    }
    if (paiement.paiement_mode === 'virement') {
      if (!req(paiement.paiement_banque)) errors.push("L'information du virement est obligatoire.");
    }
  }

  if (![0, 1, 2, 3].includes(etoiles)) errors.push("Le nombre d'étoiles doit être compris entre 0 et 3.");

  return errors;
}

async function checkUnique(b, excludeId = null) {
  const conflicts = [];
  const checks = [
    ['nin', opt(b.nin), 'Ce NIN'],
    ['telephone', opt(b.telephone), 'Ce téléphone'],
  ];
  for (const [col, val, label] of checks) {
    if (!val) continue;
    let sql = `SELECT id FROM adherents WHERE ${col} = ?`;
    const params = [val];
    if (excludeId) { sql += ' AND id <> ?'; params.push(excludeId); }
    const row = await get(sql, params);
    if (row) conflicts.push(`${label} est déjà utilisé.`);
  }
  return conflicts;
}

async function assureMatricules() {
  try {
    // Ne jamais fabriquer automatiquement un matricule pour les adhérents à l'étranger.
    const rows = await query("SELECT * FROM adherents WHERE (matricule IS NULL OR matricule = '') AND wilaya_code <> 'ETR'");
    for (const a of rows) {
      const annee = a.date_adhesion ? new Date(a.date_adhesion).getFullYear() : new Date().getFullYear();
      const w = a.wilaya_code || '16';
      const t = a.type_code || 'AD';
      const { matricule, num_ordre } = await generateMatricule({ wilaya_code: w, type_code: t, annee, bureau_code: a.bureau_code });
      await run('UPDATE adherents SET matricule=?, num_ordre=?, annee=? WHERE id=?', [matricule, num_ordre, annee, a.id]);
    }
  } catch (err) { console.error(err); }
}

router.get('/preview/matricule', authenticate, authorize('admin', 'president', 'perm:adherents_add'), async (req, res) => {
  try {
    const { wilaya_code, type_code, annee, bureau_code } = req.query;
    if (isEtranger(wilaya_code)) {
      return res.json({ matricule: '', num_ordre: 0, manuel: true });
    }
    if (req.user.role === 'saisie' && String(type_code || '').toUpperCase() === 'BE') {
      return res.status(403).json({ error: "Ce compte n'est pas autorisé à créer un membre du Bureau exécutif." });
    }
    const generated = await generateMatricule({
      wilaya_code: wilaya_code || '16',
      type_code: type_code || 'AD',
      annee: annee ? parseInt(annee, 10) : new Date().getFullYear(),
      bureau_code,
    });
    res.json({ matricule: generated.matricule, num_ordre: generated.num_ordre });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', authenticate, authorize('admin', 'president', 'perm:adherents_manage'), async (req, res) => {
  try {
    await assureMatricules();
    const { q, wilaya, type, validite, paiement } = req.query;
    let sql = 'SELECT * FROM adherents WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (nom LIKE ? OR prenom LIKE ? OR matricule LIKE ? OR telephone LIKE ? OR bureau_badge_type LIKE ? OR email LIKE ? OR profession LIKE ? OR fonction LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like, like);
    }
    if (wilaya) { sql += ' AND wilaya_code = ?'; params.push(wilaya); }
    if (type) {
      if (type === 'AD_simple') {
        sql += " AND type_code = 'AD' AND (niveau = 'Adhérent Simple' OR niveau IS NULL OR niveau = '')";
      } else if (type === 'AD_gold') {
        sql += " AND type_code = 'AD' AND (niveau = 'Adhérent Gold' OR niveau = 'Adhérent gold')";
      } else {
        sql += ' AND type_code = ?';
        params.push(type);
      }
    } else {
      sql += " AND (type_code IS NULL OR type_code <> 'BE')";
    }

    if (validite === 'valide') {
      sql += " AND (date_adhesion IS NOT NULL AND DATE_ADD(date_adhesion, INTERVAL 1 YEAR) >= CURDATE())";
    } else if (validite === 'expire') {
      sql += " AND (date_adhesion IS NOT NULL AND DATE_ADD(date_adhesion, INTERVAL 1 YEAR) < CURDATE())";
    }

    if (paiement === 'paye') {
      sql += " AND paiement_mode IS NOT NULL AND paiement_mode <> ''";
    } else if (paiement === 'non_paye') {
      sql += " AND (paiement_mode IS NULL OR paiement_mode = '')";
    } else if (paiement === 'non_assujetti') {
      sql += " AND paiement_mode = 'non_assujetti'";
    } else if (paiement === 'cheque' || paiement === 'espece' || paiement === 'virement') {
      sql += " AND paiement_mode = ?";
      params.push(paiement);
    }

    sql += ' ORDER BY created_at DESC';
    let rows;
    try {
      rows = await query(sql, params);
    } catch (e) {
      // fallback si profession/fonction n'existent pas encore
      if (String(e.message).includes('profession') || String(e.message).includes('fonction')) {
        let sql2 = 'SELECT * FROM adherents WHERE 1=1';
        const params2 = [];
        if (q) {
          sql2 += ' AND (nom LIKE ? OR prenom LIKE ? OR matricule LIKE ? OR telephone LIKE ? OR bureau_badge_type LIKE ? OR email LIKE ?)';
          const like2 = `%${q}%`;
          params2.push(like2, like2, like2, like2, like2, like2);
        }
        if (wilaya) { sql2 += ' AND wilaya_code = ?'; params2.push(wilaya); }
        if (type) {
          if (type === 'AD_simple') {
            sql2 += " AND type_code = 'AD' AND (niveau = 'Adhérent Simple' OR niveau IS NULL OR niveau = '')";
          } else if (type === 'AD_gold') {
            sql2 += " AND type_code = 'AD' AND (niveau = 'Adhérent Gold' OR niveau = 'Adhérent gold')";
          } else {
            sql2 += ' AND type_code = ?';
            params2.push(type);
          }
        } else {
          sql2 += " AND (type_code IS NULL OR type_code <> 'BE')";
        }
        if (validite === 'valide') {
          sql2 += " AND (date_adhesion IS NOT NULL AND DATE_ADD(date_adhesion, INTERVAL 1 YEAR) >= CURDATE())";
        } else if (validite === 'expire') {
          sql2 += " AND (date_adhesion IS NOT NULL AND DATE_ADD(date_adhesion, INTERVAL 1 YEAR) < CURDATE())";
        }
        if (paiement === 'paye') {
          sql2 += " AND paiement_mode IS NOT NULL AND paiement_mode <> ''";
        } else if (paiement === 'non_paye') {
          sql2 += " AND (paiement_mode IS NULL OR paiement_mode = '')";
        } else if (paiement === 'non_assujetti') {
          sql2 += " AND paiement_mode = 'non_assujetti'";
        } else if (paiement === 'cheque' || paiement === 'espece' || paiement === 'virement') {
          sql2 += " AND paiement_mode = ?";
          params2.push(paiement);
        }
        sql2 += ' ORDER BY created_at DESC';
        rows = await query(sql2, params2);
      } else { throw e; }
    }
    res.json(rows.map(enrich));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, authorize('admin', 'president', 'perm:adherents_manage'), async (req, res) => {
  try {
    const a = await get('SELECT * FROM adherents WHERE id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Adhérent introuvable.' });
    res.json(enrich(a));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authenticate, authorize('admin', 'president', 'perm:adherents_add', 'perm:adherents_manage'), uploadPhoto.single('photo'), async (req, res) => {
  try {
    const b = req.body;
    if (req.user.role === 'saisie' && String(b.type_code || '').toUpperCase() === 'BE') {
      return res.status(403).json({ error: "Ce compte n'est pas autorisé à créer un membre du Bureau exécutif." });
    }
    const errors = validate(b);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const conflicts = await checkUnique(b);
    if (conflicts.length) return res.status(409).json({ error: conflicts.join(' ') });

    const type_code = normalizeTypeCode(b.type_code);
    const wilaya_code = opt(b.wilaya_code, '16');
    const date_adhesion = opt(b.date_adhesion);
    const annee = date_adhesion ? new Date(date_adhesion).getFullYear() : new Date().getFullYear();
    const bureau_code = type_code === 'BE' ? normalizeBureauCode(b.bureau_code) : null;
    const bureau_badge_type = type_code === 'BE' ? opt(b.bureau_badge_type) : null;

    // En Algérie : génération automatique. À l'étranger : saisie manuelle.
    let matricule;
    let num_ordre;
    if (isEtranger(wilaya_code)) {
      matricule = normalizeMatriculeManuel(b.matricule);
      num_ordre = 0;
    } else {
      const generated = await generateMatricule({ wilaya_code, type_code, annee, bureau_code });
      matricule = generated.matricule;
      num_ordre = generated.num_ordre;
    }
    if (await get('SELECT id FROM adherents WHERE matricule = ?', [matricule])) {
      return res.status(409).json({ error: 'Ce matricule existe déjà. Vérifiez le code Bureau exécutif.' });
    }
    const photo = req.file ? `photos/${req.file.filename}` : null;
    const description = text(b.description);
    const paiement = normalizePaiementData(b);
    const niveau = normalizeNiveau(type_code, b.niveau, bureau_badge_type);
    const etoiles = type_code === 'BE' ? 0 : normalizeEtoiles(b.etoiles);
    const notation_negative = normalizeNotationNegative(b.notation_negative ?? b.malus);
    const carte_remise = normalizeCarteRemise(b.carte_remise);
    const qualite_ar = isEtranger(wilaya_code) ? opt(b.qualite_ar) : null;
    const fonction = opt(b.fonction);
    const diplome = opt(b.diplome);
    const profession = opt(b.profession);

    let result;
    try {
      result = await run(
        `INSERT INTO adherents (matricule, nom, prenom, nom_soc, nom_ar, prenom_ar, telephone, email, whatsapp, viber, adresse_personnelle, date_naissance, nin, doc_type,doc_numero, doc_numero_2, photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement_mode, paiement_banque, paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, notation_negative, malus, fonction, diplome, profession, carte_remise)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [matricule, text(b.nom), text(b.prenom), opt(b.nom_soc,''), text(b.nom_ar), text(b.prenom_ar), opt(b.telephone), opt(b.email), opt(b.whatsapp), opt(b.viber), opt(b.adresse_personnelle), opt(b.date_naissance),opt(b.nin), opt(b.doc_type, 'RC'), opt(b.doc_numero), opt(b.doc_numero_2),
          photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement.paiement_mode, paiement.paiement_banque, paiement.paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, notation_negative, notation_negative, fonction, diplome, profession, carte_remise]
      );
    } catch (e) {
      // fallback si une des colonnes n'existe pas encore (ancienne DB)
      if (String(e.message).includes('notation_negative') || String(e.message).includes('malus')) {
        try {
          result = await run(
            `INSERT INTO adherents (matricule, nom, prenom, nom_soc, nom_ar, prenom_ar, telephone, email, whatsapp, viber, adresse_personnelle, date_naissance, nin, doc_type,doc_numero, doc_numero_2, photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement_mode, paiement_banque, paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, fonction, diplome, profession, carte_remise)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [matricule, text(b.nom), text(b.prenom), opt(b.nom_soc,''), text(b.nom_ar), text(b.prenom_ar), opt(b.telephone), opt(b.email), opt(b.whatsapp), opt(b.viber), opt(b.adresse_personnelle), opt(b.date_naissance),opt(b.nin), opt(b.doc_type, 'RC'), opt(b.doc_numero), opt(b.doc_numero_2),
              photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement.paiement_mode, paiement.paiement_banque, paiement.paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, fonction, diplome, profession, carte_remise]
          );
        } catch (e2) {
          // dernier fallback avec malus seul
          result = await run(
            `INSERT INTO adherents (matricule, nom, prenom, nom_soc, nom_ar, prenom_ar, telephone, email, whatsapp, viber, adresse_personnelle, date_naissance, nin, doc_type,doc_numero, doc_numero_2, photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement_mode, paiement_banque, paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, malus, fonction, diplome, profession, carte_remise)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [matricule, text(b.nom), text(b.prenom), opt(b.nom_soc,''), text(b.nom_ar), text(b.prenom_ar), opt(b.telephone), opt(b.email), opt(b.whatsapp), opt(b.viber), opt(b.adresse_personnelle), opt(b.date_naissance),opt(b.nin), opt(b.doc_type, 'RC'), opt(b.doc_numero), opt(b.doc_numero_2),
              photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement.paiement_mode, paiement.paiement_banque, paiement.paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, notation_negative, fonction, diplome, profession, carte_remise]
          );
        }
      } else { throw e; }
    }

    const targetId = result?.insertId || result?.id || result;
    let created = null;
    
    if (targetId) {
      created = await get('SELECT * FROM adherents WHERE id = ?', [targetId]);
    }

    if (!created) {
      created = { 
        id: targetId, matricule, nom: text(b.nom), prenom: text(b.prenom), nom_soc: opt(b.nom_soc), nom_ar: text(b.nom_ar), prenom_ar: text(b.prenom_ar),
        telephone: opt(b.telephone), email: opt(b.email), whatsapp: opt(b.whatsapp), viber: opt(b.viber), adresse_personnelle: opt(b.adresse_personnelle), date_naissance: opt(b.date_naissance),nin: opt(b.nin), doc_type: opt(b.doc_type, 'RC'), doc_numero: opt(b.doc_numero), doc_numero_2: opt(b.doc_numero_2), photo,
        wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion,
        description, paiement_mode: paiement.paiement_mode, paiement_banque: paiement.paiement_banque, paiement_ref: paiement.paiement_ref,
        bureau_code, bureau_badge_type, qualite_ar, etoiles, notation_negative, fonction, diplome, profession, carte_remise
      };
    }

    const finalAdherent = enrich(created);
    finalAdherent.matricule = matricule; 

    await logAction(req, 'CREATE_ADHERENT', `Création de l'adhérent ${b.prenom} ${b.nom} (Matricule: ${matricule})`, targetId, 'adherent');
    res.status(201).json({ adherent: finalAdherent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, authorize('admin', 'president', 'perm:adherents_manage'), uploadPhoto.single('photo'), async (req, res) => {
  try {
    const a = await get('SELECT * FROM adherents WHERE id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Adhérent introuvable.' });
    const b = req.body;
    const errors = validate(b);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const conflicts = await checkUnique(b, a.id);
    if (conflicts.length) return res.status(409).json({ error: conflicts.join(' ') });

    const photo = req.file ? `photos/${req.file.filename}` : a.photo;
    const type_code = normalizeTypeCode(b.type_code);
    const wilaya_code = opt(b.wilaya_code, a.wilaya_code || '16');
    const date_adhesion = opt(b.date_adhesion);
    const annee = date_adhesion ? new Date(date_adhesion).getFullYear() : (a.annee || new Date().getFullYear());
    const description = b.description !== undefined ? text(b.description) : a.description;
    const paiement = normalizePaiementData(b);
    const bureau_code = type_code === 'BE' ? normalizeBureauCode(b.bureau_code) : null;
    const bureau_badge_type = type_code === 'BE' ? opt(b.bureau_badge_type) : null;
    const niveau = normalizeNiveau(type_code, b.niveau, bureau_badge_type);
    const etoiles = type_code === 'BE' ? 0 : normalizeEtoiles(b.etoiles);
    const notation_negative = normalizeNotationNegative(b.notation_negative ?? b.malus);
    const carte_remise = normalizeCarteRemise(b.carte_remise);
    const qualite_ar = isEtranger(wilaya_code) ? opt(b.qualite_ar) : null;
    const fonction = opt(b.fonction);
    const diplome = opt(b.diplome);
    const profession = opt(b.profession);

    let matricule = a.matricule;
    let num_ordre = a.num_ordre;

    if (isEtranger(wilaya_code)) {
      // Le matricule étranger reste entièrement sous le contrôle de l'utilisateur.
      matricule = normalizeMatriculeManuel(b.matricule);
      num_ordre = 0;
    } else if (!matricule || isEtranger(a.wilaya_code) || wilaya_code !== a.wilaya_code || type_code !== a.type_code || annee !== a.annee || bureau_code !== (a.bureau_code || null)) {
      const gen = await generateMatricule({ wilaya_code, type_code, annee, bureau_code });
      matricule = gen.matricule;
      num_ordre = gen.num_ordre;
    }
    const sameMat = await get('SELECT id FROM adherents WHERE matricule = ? AND id <> ?', [matricule, a.id]);
    if (sameMat) {
      return res.status(409).json({ error: 'Ce matricule existe déjà. Vérifiez le code Bureau exécutif.' });
    }

    try {
      await run(
        `UPDATE adherents SET matricule=?, nom=?, prenom=?, nom_soc=?, nom_ar=?, prenom_ar=?, telephone=?, email=?, whatsapp=?, viber=?, adresse_personnelle=?, date_naissance=?, nin=?, doc_type=?, doc_numero=?, doc_numero_2=?, photo=?,
         wilaya_code=?, type_code=?, niveau=?, num_ordre=?, annee=?, date_adhesion=?, description=?, paiement_mode=?, paiement_banque=?, paiement_ref=?, bureau_code=?, bureau_badge_type=?, qualite_ar=?, etoiles=?, notation_negative=?, malus=?, fonction=?, diplome=?, profession=?, carte_remise=? WHERE id=?`,
        [matricule, text(b.nom), text(b.prenom), opt(b.nom_soc), text(b.nom_ar), text(b.prenom_ar), opt(b.telephone), opt(b.email), opt(b.whatsapp), opt(b.viber), opt(b.adresse_personnelle),opt(b.date_naissance), opt(b.nin), opt(b.doc_type, 'RC'), opt(b.doc_numero), opt(b.doc_numero_2),
          photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement.paiement_mode, paiement.paiement_banque, paiement.paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, notation_negative, notation_negative, fonction, diplome, profession, carte_remise, a.id]
      );
    } catch (e) {
      if (String(e.message).includes('notation_negative') || String(e.message).includes('malus')) {
        try {
          await run(
            `UPDATE adherents SET matricule=?, nom=?, prenom=?, nom_soc=?, nom_ar=?, prenom_ar=?, telephone=?, email=?, whatsapp=?, viber=?, adresse_personnelle=?, date_naissance=?, nin=?, doc_type=?, doc_numero=?, doc_numero_2=?, photo=?,
             wilaya_code=?, type_code=?, niveau=?, num_ordre=?, annee=?, date_adhesion=?, description=?, paiement_mode=?, paiement_banque=?, paiement_ref=?, bureau_code=?, bureau_badge_type=?, qualite_ar=?, etoiles=?, fonction=?, diplome=?, profession=?, carte_remise=? WHERE id=?`,
            [matricule, text(b.nom), text(b.prenom), opt(b.nom_soc), text(b.nom_ar), text(b.prenom_ar), opt(b.telephone), opt(b.email), opt(b.whatsapp), opt(b.viber), opt(b.adresse_personnelle),opt(b.date_naissance), opt(b.nin), opt(b.doc_type, 'RC'), opt(b.doc_numero), opt(b.doc_numero_2),
              photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement.paiement_mode, paiement.paiement_banque, paiement.paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, fonction, diplome, profession, carte_remise, a.id]
          );
        } catch (e2) {
          await run(
            `UPDATE adherents SET matricule=?, nom=?, prenom=?, nom_soc=?, nom_ar=?, prenom_ar=?, telephone=?, email=?, whatsapp=?, viber=?, adresse_personnelle=?, date_naissance=?, nin=?, doc_type=?, doc_numero=?, doc_numero_2=?, photo=?,
             wilaya_code=?, type_code=?, niveau=?, num_ordre=?, annee=?, date_adhesion=?, description=?, paiement_mode=?, paiement_banque=?, paiement_ref=?, bureau_code=?, bureau_badge_type=?, qualite_ar=?, etoiles=?, malus=?, fonction=?, diplome=?, profession=?, carte_remise=? WHERE id=?`,
            [matricule, text(b.nom), text(b.prenom), opt(b.nom_soc), text(b.nom_ar), text(b.prenom_ar), opt(b.telephone), opt(b.email), opt(b.whatsapp), opt(b.viber), opt(b.adresse_personnelle),opt(b.date_naissance), opt(b.nin), opt(b.doc_type, 'RC'), opt(b.doc_numero), opt(b.doc_numero_2),
              photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion, description, paiement.paiement_mode, paiement.paiement_banque, paiement.paiement_ref, bureau_code, bureau_badge_type, qualite_ar, etoiles, notation_negative, fonction, diplome, profession, carte_remise, a.id]
          );
        }
      } else { throw e; }
    }
    const upd = await get('SELECT * FROM adherents WHERE id = ?', [a.id]);
    if (upd) upd.matricule = matricule;
    await logAction(req, 'EDIT_ADHERENT', `Mise à jour de l'adhérent ${b.prenom} ${b.nom} (Matricule: ${matricule})`, a.id, 'adherent');
    res.json({ adherent: enrich(upd) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const a = await get('SELECT nom, prenom, matricule FROM adherents WHERE id = ?', [req.params.id]);
    const nameStr = a ? `${a.prenom} ${a.nom} (Matricule: ${a.matricule || 'N/A'})` : `ID ${req.params.id}`;
    await run('DELETE FROM adherents WHERE id = ?', [req.params.id]);
    await logAction(req, 'DELETE_ADHERENT', `Suppression de l'adhérent ${nameStr}`, req.params.id, 'adherent');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/ranking', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const a = await get('SELECT * FROM adherents WHERE id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Adhérent introuvable.' });
    const monthRank = req.body?.top_month_rank === null || req.body?.top_month_rank === '' ? null : Math.max(1, parseInt(req.body?.top_month_rank, 10) || 1);
    const yearRank = req.body?.top_year_rank === null || req.body?.top_year_rank === '' ? null : Math.max(1, parseInt(req.body?.top_year_rank, 10) || 1);

    if (monthRank !== null) await run('UPDATE adherents SET top_month_rank = NULL WHERE top_month_rank = ? AND id <> ?', [monthRank, a.id]);
    if (yearRank !== null) await run('UPDATE adherents SET top_year_rank = NULL WHERE top_year_rank = ? AND id <> ?', [yearRank, a.id]);

    await run('UPDATE adherents SET top_month_rank = ?, top_year_rank = ? WHERE id = ?', [monthRank, yearRank, a.id]);
    const updated = await get('SELECT * FROM adherents WHERE id = ?', [a.id]);
    res.json({ adherent: enrich(updated) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/carte', authenticate, authorize('admin', 'president', 'perm:adherents_manage'), async (req, res) => {
  try {
    let a = await get('SELECT * FROM adherents WHERE id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Adhérent introuvable.' });
    
    if ((!a.matricule || a.matricule === "") && !isEtranger(a.wilaya_code)) {
      const annee = a.date_adhesion ? new Date(a.date_adhesion).getFullYear() : new Date().getFullYear();
      const gen = await generateMatricule({ wilaya_code: a.wilaya_code || '16', type_code: a.type_code || 'AD', annee, bureau_code: a.bureau_code });
      a.matricule = gen.matricule;
      a.num_ordre = gen.num_ordre;
      a.annee = annee;
      await run('UPDATE adherents SET matricule=?, num_ordre=?, annee=? WHERE id=?', [gen.matricule, gen.num_ordre, annee, a.id]);
    }

    const ad = enrich(a);
    const info = carteInfo(a);
    await logAction(req, 'PRINT_CARTE', `Génération/Impression de la carte d'adhérent pour ${a.prenom} ${a.nom} (Matricule: ${a.matricule})`, a.id, 'adherent');

    let photoDataUri = '';
    if (a.photo) {
      const photoPath = path.join(__dirname, '..', '..', 'uploads', a.photo);
      if (fs.existsSync(photoPath)) {
        try {
          const ext = (path.extname(photoPath).slice(1) || 'png').toLowerCase();
          photoDataUri = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,` + fs.readFileSync(photoPath).toString('base64');
        } catch {}
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderCarteHTML(a, ad, info, photoDataUri));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/dossier', authenticate, authorize('admin', 'president', 'perm:adherents_add', 'perm:adherents_manage'), async (req, res) => {
  try {
    let a = await get('SELECT * FROM adherents WHERE id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Adhérent introuvable.' });
    
    if ((!a.matricule || a.matricule === "") && !isEtranger(a.wilaya_code)) {
      const annee = a.date_adhesion ? new Date(a.date_adhesion).getFullYear() : new Date().getFullYear();
      const gen = await generateMatricule({ wilaya_code: a.wilaya_code || '16', type_code: a.type_code || 'AD', annee, bureau_code: a.bureau_code });
      a.matricule = gen.matricule;
      a.num_ordre = gen.num_ordre;
      a.annee = annee;
      await run('UPDATE adherents SET matricule=?, num_ordre=?, annee=? WHERE id=?', [gen.matricule, gen.num_ordre, annee, a.id]);
    }

    const ad = enrich(a);
    const info = carteInfo(a);
    await logAction(req, 'PRINT_DOSSIER', `Génération/Impression du dossier d'adhérent pour ${a.prenom} ${a.nom} (Matricule: ${a.matricule})`, a.id, 'adherent');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDossierHTML(a, ad, info));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDateAdhesion(d) {
  if (!d) return '----/--/--';
  const s = (d instanceof Date) ? d.toISOString() : String(d);
  return s.slice(0, 10).replace(/-/g, '/');
}

function getTypeAr(code) {
  if (!code) return 'منخرط';
  const c = String(code).toUpperCase();
  if (c === 'ACTIF' || c === 'EFF') return 'عضو فعال';
  if (c === 'CONSULTANT' || c === 'CON') return 'مستشار';
  return 'منخرط'; 
}

function renderCarteHTML(a, ad, info, photoDataUri) {
  const modeletype = String(info.modele || '').toLowerCase();
  const qualiteText = String(info.qualiteAr || '');
  const isBE = modeletype === 'be' || String(a.type_code || '').toUpperCase() === 'BE';
  const isGold = !isBE && (modeletype === 'gold' || qualiteText.includes('مسؤول'));

  const beP1 = getDynamicDataUri('be_1.png');
  const beP2 = getDynamicDataUri('be_2.png');
  const modelP1 = isBE ? (beP1 || getDynamicDataUri('gold_p1.png')) : (isGold ? getDynamicDataUri('gold_p1.png') : getDynamicDataUri('simple_p1.png'));
  const modelP2 = isBE ? (beP2 || getDynamicDataUri('gold_p2.png')) : (isGold ? getDynamicDataUri('gold_p2.png') : getDynamicDataUri('simple_p2.png'));
  
  let cachetUri = '';
  try {
    const cp = path.join(CARTE_DIR, 'cachet.png');
    if (fs.existsSync(cp)) cachetUri = 'data:image/png;base64,' + fs.readFileSync(cp).toString('base64');
  } catch {}

  const nomAr    = a.nom_ar    || a.nom    || '';
  const prenomAr = a.prenom_ar || a.prenom || '';
  const typeAr = a.qualite_ar || (String(a.type_code || '').toUpperCase() === 'BE'
    ? (a.bureau_badge_type || info.qualiteAr || 'Bureau exécutif')
    : (info.qualiteAr || getTypeAr(a.type_code)));

  const matricule = a.matricule || ad.matricule || '';
  const dateAdh = formatDateAdhesion(a.date_adhesion);

  const photoBlock = photoDataUri
    ? `<img class="photo" src="${photoDataUri}" alt="photo" />`
    : `<div class="photo photo-empty">${esc(((a.prenom || '')[0] || '') + ((a.nom || '')[0] || ''))}</div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>Carte ${esc(matricule)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@700&family=Cairo:wght@600;700;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Almarai:wght@700;800&family=Cairo:wght@600;700;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Mirza:wght@700&family=Cairo:wght@600;700;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Adobe+Arabic&family=Cairo:wght@600;700;900&family=Oswald:wght@700&display=swap');
  :root { --cw: 85.6mm; --ch: 54mm; }
  @page { size: 85.6mm 54mm; margin: 0; }
  
  html, body { background: transparent !important; margin: 0; padding: 0; }
  body { background:#555; font-family: 'Cairo', sans-serif; }
  
  * { box-sizing: border-box; margin: 0; padding: 0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .toolbar { text-align:center; padding:15px; direction:ltr; position:relative; z-index:20; }
  .toolbar button { background:#c39b2e; color:#fff; border:none; padding:10px 20px; border-radius:5px; font-weight:700; cursor:pointer; margin:0 5px; }

  .cards { display:flex; flex-wrap:wrap; gap:20px; justify-content:center; padding-bottom:30px; background:transparent; }
  .card { width:var(--cw); height:var(--ch); position:relative; background:transparent !important; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,.3); }
  .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; z-index:1; pointer-events:none; }

  .photo-wrap {
    position:absolute;
    left:1.23%; top:32.50%;
    width:25.86%; height:48.20%;
    z-index:3;
  }
  .photo { width:100%; height:100%; object-fit:cover; display:block; }
  .photo-empty { display:flex; align-items:center; justify-content:center; color:#fff; font-size:6mm; background:#9a7b22; }

  .cachet {
    position:absolute;
    left:14.50%; top:51.00%;
    width:20.13%; height:31.53%;
    z-index:4;
    pointer-events:none;
  }

  .txt {
    position: absolute; 
    z-index: 5;
    font-family: "Adobe Arabic", "Traditional Arabic", "Simplified Arabic", "Mirza", sans-serif;
    font-weight: 900 !important; 
    color: #000000 !important;   
    font-size: 3.5mm !important; 
    direction: rtl; 
    text-align: right;
    white-space: nowrap;
    line-height: 1;
}
  
  .t-nom    { right:14.45%; top:37.85%; font-size:2.6mm; }
  .t-prenom { right:14.70%; top:44.80%; font-size:2.6mm; }
  .t-type   { right:15.15%; top:52.65%; font-size:2.8mm; font-weight:900; color:#232323; }

 .t-mat {
    position: absolute; 
    z-index: 5;
    right: 26.40%; 
    top: 68.50%;
    font-family: 'Oswald', 'Arial Narrow', sans-serif ;
    font-size: 2.6mm ; 
    font-weight: 700 ;
    color: #1a1a1a ;
    letter-spacing: -0.4px;
    white-space: nowrap;
    line-height: 1;
    display: inline-block;
  }

  .v-date {
    position:absolute; z-index:5;
    left:50.77%; top:22.47%;
    width:19.75%;
    display:flex; align-items:center; justify-content:center;
    color:#222222; font-weight:900;
    font-family: 'Cairo', 'Amiri', serif;
    font-size:2.8mm; line-height:1;
    direction:ltr; white-space:nowrap;
    background: transparent ;
    background-color: transparent ;
  }


  @media print {
    html, body { background:transparent !important; }
    .toolbar { display:none !important; }
    .cards { display:block; gap:0; padding:0; margin:0; }
    .card { box-shadow:none; margin:0; page-break-after:always; break-after:page; background:transparent !important; }
    .card:last-child { page-break-after:auto; break-after:auto; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ Imprimer la carte</button>
    <button onclick="window.close()" style="background:#666">Fermer</button>
  </div>

  <div class="cards">
    <div class="card recto">
      <img class="bg" src="${modelP1}" alt="Recto" />
      <div class="photo-wrap">${photoBlock}</div>
      ${cachetUri ? `<img class="cachet" src="${cachetUri}" alt="Cachet" />` : ''}
      <div class="txt t-nom">${esc(nomAr)}</div>
      <div class="txt t-prenom">${esc(prenomAr)}</div>
      <div class="txt t-type">${esc(typeAr)}</div>
      <div class="t-mat">${esc(matricule)}</div>
    </div>

    <div class="card verso">
      <img class="bg" src="${modelP2}" alt="Verso" />
      <div class="v-date">${esc(dateAdh)}</div>
    </div>
  </div>
</body>
</html>`;
}

function renderDossierHTML(a, ad, info) {
  const nomPrenomFr = `${esc(a.prenom)} ${esc(a.nom)}`;
  const nomPrenomAr = `${esc(a.prenom_ar || a.prenom)} ${esc(a.nom_ar || a.nom)}`;
  const nomSociete = esc(a.nom_soc || '');
  const telephone = esc(a.telephone || '');
  const email = esc(a.email || '');
  const description = esc(a.description || '');
  const matricule = esc(a.matricule || ad?.matricule || '');
  const wilayaFr = esc(ad.wilaya_nom || '');
  const wilayaAr = esc(ad.wilaya_nom_ar || ad.wilaya_nom || '');
  const dateAdhFr = formatDateAdhesion(a.date_adhesion);
  const typeMembreFr = esc(ad.type_libelle || '');
  const idNum = esc(a.doc_numero || a.nin || '');
  const nin = esc(a.nin || '');
  const rcNum = esc(a.doc_type === 'RC' ? a.doc_numero : '');
  const paiementMode = normalizePaiementMode(a.paiement_mode);
  const paiementRef = esc(a.paiement_ref || '');
  const paiementBanque = esc(a.paiement_banque || '');
  const adresse = esc(a.adresse_personnelle || '');
  const dateNaissance = a.date_naissance ? formatDateAdhesion(a.date_naissance) : '';
  const niveauFr = esc(a.niveau || ad?.type_libelle || '');
  const qualiteAr = esc(a.qualite_ar || info?.qualiteAr || '');

  // Format DD/MM/YYYY pour les pages arabes et la date du jour
  function formatDateDMY(d) {
    if (!d) return '';
    const s = (d instanceof Date) ? d.toISOString() : String(d);
    if (s.length < 10) return '';
    const parts = s.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const dateNaissanceDMY = a.date_naissance ? formatDateDMY(a.date_naissance) : '';
  const todayDMY = formatDateDMY(new Date());
  
  let expFr = '----/--/--';
  if (a.date_adhesion) {
    const s = (a.date_adhesion instanceof Date) ? a.date_adhesion.toISOString() : String(a.date_adhesion);
    if (s.length >= 10) {
      const yr = parseInt(s.slice(0, 4), 10);
      if (!isNaN(yr)) {
        expFr = `${yr + 1}${s.slice(4, 10)}`.replace(/-/g, '/');
      }
    }
  }
  
  const todayFr = new Date().toISOString().slice(0, 10);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Dossier — ${matricule}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@600;700&family=Segoe+UI:wght@600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { background: #555; font-family: 'Segoe UI', Arial, sans-serif; color: #111; }
  
  .toolbar { text-align: center; padding: 15px; background: #333; color: #fff; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
  .toolbar button { background: #c39b2e; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; font-weight: 700; cursor: pointer; margin: 0 5px; font-size: 15px; }
  .toolbar button:hover { opacity: 0.9; }

  .dossier { display: flex; flex-direction: column; align-items: center; gap: 25px; padding: 25px 0; }
  
  @page { size: A4; margin: 0; }
  
  .page {
    width: 210mm;
    height: 297mm;
    position: relative;
    background-color: #fff;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    box-shadow: 0 5px 25px rgba(0,0,0,0.3);
    overflow: hidden;
  }
  
  .p1 { background-image: url('/assets/dossier/page1.png'); }
  .p2 { background-image: url('/assets/dossier/page2.png'); }
  .p3 { background-image: url('/assets/dossier/page3.png'); }
  .p4 { background-image: url('/assets/dossier/page4.png'); }
  .p5 { background-image: url('/assets/dossier/page5.png'); }

  input[type="text"], input[type="date"], input[type="email"] {
    position: absolute;
    background: rgba(195, 155, 46, 0.14);
    border: 1px dashed rgba(195, 155, 46, 0.7);
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
    padding: 2px 8px;
    border-radius: 4px;
    z-index: 10;
  }
  input[type="text"]:focus, input[type="date"]:focus, input[type="email"]:focus {
    background: #fff;
    border: 2px solid #c39b2e;
    outline: none;
    box-shadow: 0 0 8px rgba(195,155,46,0.4);
    z-index: 20;
  }
  
  .chk {
    position: absolute;
    width: 18px;
    height: 18px;
    accent-color: #c39b2e;
    cursor: pointer;
    z-index: 10;
  }

  .rtl input[type="text"], .rtl input[type="date"] {
    font-family: 'Cairo', 'Amiri', sans-serif;
    direction: rtl;
    text-align: right;
    font-size: 16px;
  }
  .ltr-f { direction: ltr !important; text-align: left !important; font-family: 'Segoe UI', sans-serif !important; }

  @media print {
    body { background: #fff !important; }
    .toolbar { display: none !important; }
    .dossier { gap: 0; padding: 0; display: block; }
    .page { box-shadow: none; margin: 0; page-break-after: always; break-after: page; }
    input[type="text"], input[type="date"], input[type="email"] {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 4px !important;
      color: #000 !important;
    }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
    <button onclick="window.close()" style="background: #666">Fermer</button>
  </div>

  <div class="dossier">
    <div class="page p1">
      <input type="text" style="left:21%; top:16.8%; width:75%; height:2.2%" value="${nomPrenomFr}" />
      <input type="text" style="left:29%; top:20%; width:67%; height:2.2%" value="${dateNaissanceDMY}" title="Nom de société" />
      <input type="text" style="left:13%; top:22.9%; width:83%; height:2.2%" value="${adresse}" title="Adresse" />
      <input type="text" style="left:15.5%; top:26.2%; width:31%; height:2.2%" value="${telephone}" />
      <input type="text" style="left:57%; top:26.2%; width:41%; height:2.2%" value="${email}" title="email" />
      
      
      <input type="text" style="left:40.5%; top:29.5%; width:14.5%; height:2.0%" value="${paiementRef}" />
      <input type="checkbox" class="chk" style="left:6.5%; top:33.5%" title="Non assujetti" ${paiementMode === 'non_assujetti' ? 'checked' : ''} />

      <input type="text" style="left:20%; top:37.2%; width:35%; height:2.2%" value="${paiementBanque}" />
      <input type="text" style="left:79.5%; top:37.2%; width:17%; height:2.2%" value="" />
      <input type="text" style="left:13.7%; top:40.9%; width:27%; height:2.2%" value="" />
      <input type="text" style="left:71%; top:40.7%; width:26%; height:2.2%" value="" />


      <input type="text" style="left:24.5%; top:76.8%; width:31%; height:2.2%" value="${matricule}" />
      <input type="text" style="left:22.5%; top:79.8%; width:33%; height:2.2%" value="${dateAdhFr}" />
      <input type="text" style="left:22.5%; top:82.8%; width:33%; height:2.2%" value="${typeMembreFr}" />
      <input type="text" style="left:69%; top:76.8%; width:27%; height:2.2%" value="${wilayaFr}" />
      <input type="text" style="left:69%; top:79.8%; width:27%; height:2.2%" value="${expFr}" />
      <input type="text" style="left:69%; top:82.8%; width:27%; height:2.2%"  />
    </div>

    <div class="page p2 rtl">
      <input type="text" style="left:9%; top:36.8%; width:59%; height:2.2%" value="${nomPrenomAr}" />
      <input type="text" style="left:55%; top:40.5%; width:24%; height:2.2%" value="${dateNaissanceDMY}" title="تاريخ الميلاد" />
      <input type="text" class="ltr-f" style="left:9%; top:40.5%; width:24%; height:2.2%" value="${nin}" />
      <input type="text" style="left:68%; top:43.9%; width:16%; height:2.2%" />
      <input type="text" style="left:33%; top:43.9%; width:17%; height:2.2%" />
      <input type="text" style="left:9%; top:43.9%; width:17%; height:2.2%" />
      <input type="text" style="left:9%; top:46.8%; width:36%; height:2.2%" />
      <input type="text" style="left:9%; top:50.5%; width:61%; height:2.2%" />

      <input type="text" class="ltr-f" style="left:10%; top:61.2%; width:18%; height:2.2%" value="${todayDMY}" />

      
    </div>

    <div class="page p3 rtl">
      <input type="text" style="left:10%; top:25.3%; width:59%; height:2.2%" value="${nomPrenomAr}" />
      <input type="text" style="left:56%; top:28.8%; width:24%; height:2.2%" value="${dateNaissanceDMY}" title="تاريخ الميلاد" />
      <input type="text" class="ltr-f" style="left:10%; top:28.8%; width:24%; height:2.2%" value="${nin}" />
      <input type="text" style="left:68%; top:32.3%; width:17%; height:2.2%"  />
      <input type="text" style="left:33%; top:32.3%; width:18%; height:2.2%"  />
      <input type="text" style="left:10%; top:32.3%; width:17%; height:2.2%" />
      <input type="text" style="left:10%; top:35.5%; width:36%; height:2.2%"  />
      <input type="text" style="left:10%; top:38.5%; width:61%; height:2.2%"  />
 

      <input type="text" class="ltr-f" style="left:66%; top:74.5%; width:18%; height:2.2%" value="${todayDMY}" />
    </div>

    <div class="page p4">
      <input type="text" style="left:59%; top:24.5%; width:17%; height:2.2%" value="${todayDMY}" title="Fait le" />
      <input type="text" style="left:30%; top:32%; width:55%; height:2.2%" value="${nomPrenomFr}" title="Je soussigné Mr" />
      <input type="text" style="left:24%; top:37.3%; width:23%; height:2.2%" value="${nin}" title="N° pièce d'identité" />
      <input type="text" style="left:64.5%; top:37.3%; width:27%; height:2.2%" value="${qualiteAr}" title="En ma qualité de / الصفة" />
      <input type="text" style="left:19.6%; top:43.3%; width:35%; height:2.2%" value="${nomSociete}" title="De la société" />
      <input type="text" style="left:78%; top:55.5%; width:14%; height:2.2%" value="${todayDMY}" title="A Ouled Fayet le" />
    </div>

    <div class="page p5">
      <input type="text" style="left:59%; top:21.2%; width:17%; height:2.2%" value="${todayDMY}" title="Fait le" />
      <input type="text" style="left:30%; top:32.4%; width:40%; height:2.2%" value="" title="Somme reçue" />
      <input type="text" style="left:10%; top:36.9%; width:55%; height:2.2%" value="" title="Soit" />
      <input type="text" style="left:78%; top:69%; width:14%; height:2.2%" value="${todayDMY}" title="A Ouled Fayet le" />
    </div>
  </div>
</body>
</html>`;
}

export default router;
