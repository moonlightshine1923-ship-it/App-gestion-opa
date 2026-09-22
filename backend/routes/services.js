import express from 'express';
import { query, get, run } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAction } from '../audit.js';

const router = express.Router();

export const TYPES_SERVICES = [
  'Accompagnement / Conseil',
  'Attestation / Document',
  'Assistance administrative',
  'Formation / Atelier',
  'Événement / Networking',
  'Médiation / Contentieux',
  'Autre service'
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

// 1. Liste de tous les services avec filtres
router.get('/', authenticate, async (req, res) => {
  try {
    const { q, adherent_id, type_service } = req.query;
    let sql = `
      SELECT s.*,
             a.nom AS adherent_nom,
             a.prenom AS adherent_prenom,
             a.matricule AS adherent_matricule,
             a.photo AS adherent_photo,
             a.niveau AS adherent_niveau,
             a.wilaya_code AS adherent_wilaya,
             u.email AS created_by_email
      FROM services_adherents s
      JOIN adherents a ON a.id = s.adherent_id
      LEFT JOIN users u ON u.id = s.created_by
      WHERE 1=1
    `;
    const params = [];

    if (adherent_id) {
      sql += ' AND s.adherent_id = ?';
      params.push(parseInt(adherent_id, 10));
    }
    if (type_service) {
      sql += ' AND s.type_service = ?';
      params.push(type_service);
    }
    if (q && String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      sql += ' AND (a.nom LIKE ? OR a.prenom LIKE ? OR a.matricule LIKE ? OR s.titre LIKE ? OR s.description LIKE ?)';
      params.push(like, like, like, like, like);
    }

    sql += ' ORDER BY s.date_service DESC, s.id DESC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Statistiques globales des services
router.get('/stats', authenticate, async (req, res) => {
  try {
    const counts = await get(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT adherent_id) AS total_adherents
      FROM services_adherents
    `);
    const byType = await query(`
      SELECT type_service, COUNT(*) AS count
      FROM services_adherents
      GROUP BY type_service
      ORDER BY count DESC
    `);
    res.json({
      total: Number(counts?.total || 0),
      total_adherents: Number(counts?.total_adherents || 0),
      byType,
      types: TYPES_SERVICES
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Services rendus à un adhérent spécifique
router.get('/adherent/:adherentId', authenticate, async (req, res) => {
  try {
    const adherentId = parseInt(req.params.adherentId, 10);
    const adh = await get('SELECT id, nom, prenom, matricule FROM adherents WHERE id = ?', [adherentId]);
    if (!adh) return res.status(404).json({ error: 'Adhérent introuvable.' });

    const rows = await query(`
      SELECT s.*, u.email AS created_by_email
      FROM services_adherents s
      LEFT JOIN users u ON u.id = s.created_by
      WHERE s.adherent_id = ?
      ORDER BY s.date_service DESC, s.id DESC
    `, [adherentId]);

    res.json({ adherent: adh, services: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Détail d'un service
router.get('/:id', authenticate, async (req, res) => {
  try {
    const service = await get(`
      SELECT s.*,
             a.nom AS adherent_nom, a.prenom AS adherent_prenom, a.matricule AS adherent_matricule,
             u.email AS created_by_email
      FROM services_adherents s
      JOIN adherents a ON a.id = s.adherent_id
      LEFT JOIN users u ON u.id = s.created_by
      WHERE s.id = ?
    `, [req.params.id]);

    if (!service) return res.status(404).json({ error: 'Service introuvable.' });
    res.json(service);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Créer un nouveau service
router.post('/', authenticate, async (req, res) => {
  try {
    const { adherent_id, titre, type_service, description, date_service } = req.body;
    
    if (!adherent_id) return res.status(400).json({ error: 'Veuillez sélectionner un adhérent.' });
    const adh = await get('SELECT id, nom, prenom, matricule FROM adherents WHERE id = ?', [adherent_id]);
    if (!adh) return res.status(404).json({ error: 'Adhérent introuvable.' });

    const finalTitre = String(titre || '').trim();
    if (!finalTitre) return res.status(400).json({ error: 'Le titre du service est obligatoire.' });

    const finalType = TYPES_SERVICES.includes(type_service) ? type_service : 'Accompagnement / Conseil';
    const finalDate = (date_service && /^\d{4}-\d{2}-\d{2}$/.test(date_service)) ? date_service : today();

    const result = await run(`
      INSERT INTO services_adherents
      (adherent_id, titre, type_service, description, date_service, created_by)
      VALUES (?,?,?,?,?,?)
    `, [adh.id, finalTitre, finalType, description || null, finalDate, req.user?.id || null]);

    const created = await get(`
      SELECT s.*, a.nom AS adherent_nom, a.prenom AS adherent_prenom, a.matricule AS adherent_matricule
      FROM services_adherents s
      JOIN adherents a ON a.id = s.adherent_id
      WHERE s.id = ?
    `, [result.insertId]);

    await logAction(req, 'CREATE_SERVICE', `Service "${finalTitre}" ajouté pour ${adh.prenom} ${adh.nom} (Matricule: ${adh.matricule})`, result.insertId, 'service');
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. Modifier un service
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get('SELECT * FROM services_adherents WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Service introuvable.' });

    const updates = [];
    const params = [];

    if (req.body.titre !== undefined) {
      const t = String(req.body.titre || '').trim();
      if (!t) return res.status(400).json({ error: 'Le titre ne peut pas être vide.' });
      updates.push('titre = ?');
      params.push(t);
    }
    if (req.body.type_service !== undefined) {
      updates.push('type_service = ?');
      params.push(req.body.type_service);
    }
    if (req.body.description !== undefined) {
      updates.push('description = ?');
      params.push(req.body.description || null);
    }
    if (req.body.date_service !== undefined) {
      updates.push('date_service = ?');
      params.push(req.body.date_service);
    }

    if (!updates.length) return res.status(400).json({ error: 'Aucune modification apportée.' });

    params.push(id);
    await run(`UPDATE services_adherents SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await get(`
      SELECT s.*, a.nom AS adherent_nom, a.prenom AS adherent_prenom, a.matricule AS adherent_matricule
      FROM services_adherents s
      JOIN adherents a ON a.id = s.adherent_id
      WHERE s.id = ?
    `, [id]);

    await logAction(req, 'EDIT_SERVICE', `Mise à jour du service #${id} (${updated.titre}) pour ${updated.prenom} ${updated.nom}`, id, 'service');
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. Supprimer un service
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get('SELECT s.*, a.nom, a.prenom FROM services_adherents s JOIN adherents a ON a.id = s.adherent_id WHERE s.id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Service introuvable.' });

    await run('DELETE FROM services_adherents WHERE id = ?', [id]);
    await logAction(req, 'DELETE_SERVICE', `Suppression du service #${id} ("${existing.titre}") de ${existing.prenom} ${existing.nom}`, id, 'service');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;