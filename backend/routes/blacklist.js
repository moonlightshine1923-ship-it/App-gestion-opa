import express from 'express';
import { query, get, run } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction } from '../audit.js';

const router = express.Router();

// Liste blacklist - simplifiée
router.get('/', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const { q } = req.query;
    let sql = `
      SELECT bl.*, a.photo as adherent_photo,
             u.email as created_by_email
      FROM blacklist bl
      LEFT JOIN adherents a ON a.id = bl.adherent_id
      LEFT JOIN users u ON u.id = bl.created_by
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      sql += ` AND (bl.nom LIKE ? OR bl.prenom LIKE ? OR bl.matricule LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    sql += ` ORDER BY bl.created_at DESC`;
    const rows = await query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Détail
router.get('/:id', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const b = await get(`
      SELECT bl.*, u.email as created_by_email
      FROM blacklist bl
      LEFT JOIN users u ON u.id = bl.created_by
      WHERE bl.id = ?
    `, [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Entrée blacklist introuvable.' });
    res.json(b);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ajouter
router.post('/', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const { adherent_id, nom, prenom, matricule, motif, date_blacklist } = req.body;
    let finalNom = (nom || '').trim();
    let finalPrenom = (prenom || '').trim();
    let finalMatricule = matricule || null;
    let adh = null;
    if (adherent_id) {
      adh = await get('SELECT * FROM adherents WHERE id = ?', [adherent_id]);
      if (!adh) return res.status(404).json({ error: 'Adhérent introuvable.' });
      const exists = await get('SELECT id FROM blacklist WHERE adherent_id = ?', [adherent_id]);
      if (exists) return res.status(409).json({ error: 'Cet adhérent est déjà dans la blacklist.' });
      finalNom = finalNom || adh.nom;
      finalPrenom = finalPrenom || adh.prenom;
      finalMatricule = finalMatricule || adh.matricule;
    }
    if (!finalNom || !finalPrenom) {
      return res.status(400).json({ error: 'Nom et prénom sont obligatoires.' });
    }
    const date_bl = date_blacklist || new Date().toISOString().slice(0,10);
    const result = await run(`
      INSERT INTO blacklist 
      (adherent_id, nom, prenom, matricule, motif, date_blacklist, created_by)
      VALUES (?,?,?,?,?,?,?)
    `, [ adh ? adh.id : (adherent_id || null), finalNom, finalPrenom, finalMatricule, motif || null, date_bl, req.user.id || null ]);
    const created = await get('SELECT * FROM blacklist WHERE id = ?', [result.insertId]);
    await logAction(req, 'CREATE_BLACKLIST', `Ajout à la liste noire de ${finalPrenom} ${finalNom} (Motif: ${motif || 'Non spécifié'})`, result.insertId, 'blacklist');
    res.status(201).json({ ok: true, blacklist: created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Modifier
router.patch('/:id', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const b = await get('SELECT * FROM blacklist WHERE id = ?', [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Entrée blacklist introuvable.' });
    const fields = ['nom','prenom','matricule','motif','date_blacklist'];
    const updates = []; const params = [];
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f] || null); } }
    if (!updates.length) return res.status(400).json({ error: 'Aucune donnée à modifier.' });
    params.push(req.params.id);
    await run(`UPDATE blacklist SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await get('SELECT * FROM blacklist WHERE id = ?', [req.params.id]);
    await logAction(req, 'EDIT_BLACKLIST', `Mise à jour de l'entrée liste noire pour ${updated ? updated.prenom + ' ' + updated.nom : 'ID ' + req.params.id}`, req.params.id, 'blacklist');
    res.json({ ok: true, blacklist: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Supprimer
router.delete('/:id', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const b = await get('SELECT nom, prenom FROM blacklist WHERE id = ?', [req.params.id]);
    const nameStr = b ? `${b.prenom} ${b.nom}` : `ID ${req.params.id}`;
    await run('DELETE FROM blacklist WHERE id = ?', [req.params.id]);
    await logAction(req, 'DELETE_BLACKLIST', `Retrait de la liste noire de ${nameStr}`, req.params.id, 'blacklist');
    res.json({ ok: true });
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Route rapide (gardée côté API mais plus utilisée côté front)
router.post('/adherent/:adherentId', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const adh = await get('SELECT * FROM adherents WHERE id = ?', [req.params.adherentId]);
    if (!adh) return res.status(404).json({ error: 'Adhérent introuvable.' });
    const exists = await get('SELECT id FROM blacklist WHERE adherent_id = ? OR matricule = ?', [req.params.adherentId, adh.matricule]);
    if (exists) return res.status(409).json({ error: 'Cet adhérent est déjà blacklisté.' });
    const { motif } = req.body;
    const result = await run(`INSERT INTO blacklist (adherent_id, nom, prenom, matricule, motif, date_blacklist, created_by) VALUES (?,?,?,?,?,CURDATE(),?)`,
      [adh.id, adh.nom, adh.prenom, adh.matricule, motif || 'Ajouté par l’administrateur', req.user.id || null]);
    const created = await get('SELECT * FROM blacklist WHERE id = ?', [result.insertId]);
    res.status(201).json({ ok: true, blacklist: created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;