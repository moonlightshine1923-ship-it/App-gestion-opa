import express from 'express';
import fs from 'fs';
import path from 'path';
import PDFMerger from 'pdf-merger-js';
import { query, run, get } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadDoc } from '../middleware/upload.js';
import { logAction } from '../audit.js';

const router = express.Router();

router.get('/adherents-statut', authenticate, authorize('admin', 'president', 'perm:documents_view'), async (req, res) => {
  try {
    const sql = `
      SELECT 
        a.id AS adherent_id, 
        a.matricule, 
        a.nom, 
        a.prenom, 
        a.wilaya_code, 
        a.type_code,   
        d.id AS doc_id, 
        d.filename, 
        d.original_name,
        d.updated_at 
      FROM adherents a
      LEFT JOIN documents d ON a.id = d.adherent_id
      ORDER BY a.nom ASC, a.prenom ASC
    `;
    const rows = await query(sql);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: `Erreur base de données : ${e.message}` });
  }
});
// 2. Fusion PDF
router.post('/fusionner/:adherentId', authenticate, authorize('admin', 'president'), uploadDoc.array('fichiers'), async (req, res) => {
  try {
    const { adherentId } = req.params;
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Aucun fichier.' });

    const outputDir = path.join('uploads', 'documents');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const nomFichierFinal = `complet_${adherentId}_${Date.now()}.pdf`;
    const cheminFichierFinal = path.join(outputDir, nomFichierFinal);
    const merger = new PDFMerger();

    for (const file of req.files) { await merger.add(file.path); }
    await merger.save(cheminFichierFinal);
    for (const file of req.files) { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); }

    const nomsOrigine = req.files.map(f => f.originalname).join(', ');
    const cheminRelatifPourBDD = `uploads/documents/${nomFichierFinal}`;

    const docExistant = await get('SELECT id, filename FROM documents WHERE adherent_id = ?', [adherentId]);

    if (docExistant) {
      if (fs.existsSync(docExistant.filename)) fs.unlinkSync(docExistant.filename);
      await run('UPDATE documents SET filename = ?, original_name = ? WHERE id = ?', [cheminRelatifPourBDD, nomsOrigine, docExistant.id]);
    } else {
      await run('INSERT INTO documents (adherent_id, titre, filename, original_name) VALUES (?, ?, ?, ?)', 
        [adherentId, 'Dossier Complet Fusionné', cheminRelatifPourBDD, nomsOrigine]);
    }

    const adh = await get('SELECT nom, prenom, matricule FROM adherents WHERE id = ?', [adherentId]);
    const adhStr = adh ? `${adh.prenom} ${adh.nom} (Matricule: ${adh.matricule || 'N/A'})` : `ID ${adherentId}`;
    await logAction(req, 'MERGE_PDF', `Fusion de documents PDF pour l'adhérent ${adhStr}`, adherentId, 'adherent');

    res.json({ success: true, message: 'Fusion réussie.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Suppression groupée par adherent_id
router.post('/suppression-groupes', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const { ids } = req.body; 
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Aucun adhérent sélectionné.' });

    // Suppression physique
    for (const adherentId of ids) {
      const document = await get('SELECT filename FROM documents WHERE adherent_id = ?', [adherentId]);
      if (document && document.filename && fs.existsSync(document.filename)) {
        fs.unlinkSync(document.filename);
      }
    }

    // Suppression BDD
    const placeholders = ids.map(() => '?').join(',');
    await run(`DELETE FROM documents WHERE adherent_id IN (${placeholders})`, ids);

    await logAction(req, 'DELETE_PDF_GROUP', `Suppression groupée des dossiers fusionnés pour les adhérents ID [${ids.join(', ')}]`, null, 'document');

    res.json({ success: true, message: 'Dossiers supprimés avec succès.' });
  } catch (e) {
    res.status(500).json({ error: `Erreur suppression : ${e.message}` });
  }
});

export default router;