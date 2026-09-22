import express from 'express';
import { get, query, run } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadDoc } from '../middleware/upload.js';
import { STATUTS_DEMANDE, PRIORITES, WILAYAS, wilayaNom } from '../data/wilayas.js';
import { logAction } from '../audit.js'; // Retrait de TYPES_DEMANDE s'il n'est plus utilisé ici

const router = express.Router();

async function numeroDemande() {
  const year = new Date().getFullYear();
  const row = await get("SELECT COUNT(*) AS c FROM demandes_site WHERE numero LIKE ?", [`DEM-${year}-%`]);
  const n = String((row.c || 0) + 1).padStart(4, '0');
  return `DEM-${year}-${n}`;
}

async function enrich(d) {
  if (!d) return d;
  
  const objet = d.titre_demande || d.objet || 'Demande';
  const created_at = d.date_creation || d.created_at || '';
  const wilaya_nom = d.wilaya || '—';
  
  let pieces = [];
  if (d.fichier_joint && typeof d.fichier_joint === 'string') {
    pieces.push({ filename: d.fichier_joint, original_name: d.fichier_joint.split('/').pop() || 'Pièce jointe' });
  }

  try {
    const attachRows = await query('SELECT * FROM demandes_site_pieces WHERE demande_id = ?', [d.id]);
    for (const r of attachRows) {
      pieces.push({ filename: r.filename, original_name: r.original_name });
    }
  } catch {}

  return {
    ...d,
    objet,
    created_at,
    wilaya_nom,
    pieces,
  };
}

// ===== Dépôt PUBLIC depuis le site web =====
router.post('/public', uploadDoc.array('pieces', 5), async (req, res) => {
  try {
    const b = req.body;
    if (!b.nom || !b.prenom || !b.num_tel || !b.objet) {
      return res.status(400).json({ error: 'Nom, prénom, numéro de téléphone et objet sont obligatoires.' });
    }
    const priorite = PRIORITES.includes(b.priorite) ? b.priorite : 'Normale';
    const wilaya = b.wilaya_code || b.wilaya || 'Alger';
    const numero = await numeroDemande();

    // Retrait de la colonne type_demande et de son '?' correspondant
    const result = await run(
      `INSERT INTO demandes_site (numero, nom, prenom, num_tel, matricule, wilaya, titre_demande, priorite, statut, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero,
        b.nom.trim(),
        b.prenom.trim(),
        b.num_tel.trim(),
        b.matricule ? b.matricule.trim() : null,
        wilaya,
        b.objet.trim(),
        priorite,
        'En attente',
        'site'
      ]
    );
    const demandeId = result.insertId;

    if (req.files && req.files.length) {
      for (const f of req.files) {
        try {
          await run('INSERT INTO demandes_site_pieces (demande_id, filename, original_name) VALUES (?,?,?)',
            [demandeId, `documents/${f.filename}`, f.originalname]);
        } catch {}
      }
    }

    res.status(201).json({ ok: true, numero });
  } catch (e) { 
    console.error("Erreur serveur SQL :", e);
    res.status(500).json({ error: e.message }); 
  }
});

// ===== Consultation / gestion (admin & président uniquement) =====
router.get('/', authenticate, authorize('admin', 'president', 'perm:demandes_view', 'perm:demandes_edit'), async (req, res) => {
  try {
    const { statut, priorite, wilaya, q } = req.query; // Retrait de type_demande
    let sql = 'SELECT * FROM demandes_site WHERE 1=1';
    const params = [];
    if (statut) { sql += ' AND statut = ?'; params.push(statut); }
    if (priorite) { sql += ' AND priorite = ?'; params.push(priorite); }
    if (wilaya) { sql += ' AND wilaya LIKE ?'; params.push(`%${wilaya}%`); }
    if (q) {
      sql += ' AND (titre_demande LIKE ? OR numero LIKE ? OR nom LIKE ? OR prenom LIKE ? OR matricule LIKE ? OR num_tel LIKE ?)';
      const l = `%${q}%`; params.push(l, l, l, l, l, l);
    }
    sql += ' ORDER BY date_creation DESC';
    const rows = await query(sql, params);
    const list = [];
    for (const d of rows) list.push(await enrich(d));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticate, authorize('admin', 'president', 'perm:demandes_view', 'perm:demandes_edit'), async (req, res) => {
  try {
    const d = await get('SELECT * FROM demandes_site WHERE id = ?', [req.params.id]);
    if (!d) return res.status(404).json({ error: 'Demande introuvable.' });
    res.json(await enrich(d));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', authenticate, authorize('admin', 'president', 'perm:demandes_edit'), async (req, res) => {
  try {
    const d = await get('SELECT * FROM demandes_site WHERE id = ?', [req.params.id]);
    if (!d) return res.status(404).json({ error: 'Demande introuvable.' });
    const b = req.body;
    if (b.statut && !STATUTS_DEMANDE.includes(b.statut)) return res.status(400).json({ error: 'Statut invalide.' });
    await run(
      "UPDATE demandes_site SET statut=?, affecte_a=?, reponse=?, priorite=? WHERE id=?",
      [b.statut ?? (d.statut || 'En attente'), b.affecte_a ?? (d.affecte_a || null), b.reponse ?? (d.reponse || null),
        (b.priorite && PRIORITES.includes(b.priorite)) ? b.priorite : (d.priorite || 'Normale'), d.id]
    );
    await logAction(req, 'EDIT_DEMANDE', `Modification de la demande ${d.numero} (Nouveau statut: ${b.statut ?? d.statut})`, d.id, 'demande');
    res.json(await enrich(await get('SELECT * FROM demandes_site WHERE id = ?', [d.id])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/cloturer', authenticate, authorize('admin', 'president', 'perm:demandes_edit'), async (req, res) => {
  try {
    const r = await run("UPDATE demandes_site SET statut='Clôturée' WHERE id=?", [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Demande introuvable.' });
    const updatedDem = await get('SELECT numero FROM demandes_site WHERE id = ?', [req.params.id]);
    await logAction(req, 'CLOSE_DEMANDE', `Clôture de la demande ${updatedDem ? updatedDem.numero : 'ID ' + req.params.id}`, req.params.id, 'demande');
    res.json(await enrich(await get('SELECT * FROM demandes_site WHERE id = ?', [req.params.id])));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, authorize('admin', 'president', 'perm:demandes_edit'), async (req, res) => {
  try {
    const d = await get('SELECT numero FROM demandes_site WHERE id = ?', [req.params.id]);
    const numStr = d ? d.numero : `ID ${req.params.id}`;
    const r = await run('DELETE FROM demandes_site WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Demande introuvable.' });
    await logAction(req, 'DELETE_DEMANDE', `Suppression de la demande ${numStr}`, req.params.id, 'demande');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;