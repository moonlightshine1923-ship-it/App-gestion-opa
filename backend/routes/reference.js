import express from 'express';
import { WILAYAS, TYPES, NIVEAUX, DOC_TYPES, STATUTS_DEMANDE, PRIORITES, TYPES_DEMANDE } from '../data/wilayas.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  res.json({
    wilayas: WILAYAS,
    types: TYPES,
    niveaux: NIVEAUX,
    docTypes: DOC_TYPES,
    statutsDemande: STATUTS_DEMANDE,
    priorites: PRIORITES,
    typesDemande: TYPES_DEMANDE,
  });
});

// Référentiel public (sans authentification) — utilisé par le formulaire du site web.
router.get('/public', (req, res) => {
  res.json({
    wilayas: WILAYAS.map((w) => ({ code: w.code, nom: w.nom, nomAr: w.nomAr })),
    typesDemande: TYPES_DEMANDE,
    priorites: PRIORITES,
  });
});

export default router;
