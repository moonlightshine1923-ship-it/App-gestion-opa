import express from 'express';
import { get, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { wilayaNom } from '../data/wilayas.js';

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'president'), async (req, res) => {
  try {
    const totalAdherents = (await get("SELECT COUNT(*) AS c FROM adherents WHERE type_code <> 'BE' OR type_code IS NULL")).c;
    const totalBureauExecutif = (await get("SELECT COUNT(*) AS c FROM adherents WHERE type_code = 'BE'"))?.c || 0;

    const parType = await query("SELECT type_code, COUNT(*) AS c FROM adherents WHERE type_code <> 'BE' OR type_code IS NULL GROUP BY type_code");
    const typeCount = (code) => (parType.find((x) => x.type_code === code)?.c) || 0;

    const gold = (await get("SELECT COUNT(*) AS c FROM adherents WHERE (type_code <> 'BE' OR type_code IS NULL) AND niveau = 'Adhérent Gold'"))?.c || 0;

    const parWilayaRaw = await query("SELECT wilaya_code, COUNT(*) AS c FROM adherents WHERE type_code <> 'BE' OR type_code IS NULL GROUP BY wilaya_code ORDER BY c DESC");
    const parWilaya = parWilayaRaw.map((r) => ({ code: r.wilaya_code, nom: wilayaNom(r.wilaya_code), count: r.c }));

    const mois = new Date().toISOString().slice(0, 7);
    const nouveauxMois = (await get("SELECT COUNT(*) AS c FROM adherents WHERE (type_code <> 'BE' OR type_code IS NULL) AND DATE_FORMAT(date_adhesion, '%Y-%m') = ?", [mois]))?.c || 0;

    let starRows = [];
    try {
      starRows = await query("SELECT id, nom, prenom, matricule, etoiles, notation_negative, malus, profession, fonction FROM adherents WHERE type_code <> 'BE' OR type_code IS NULL ORDER BY etoiles DESC, prenom ASC, nom ASC");
    } catch (e) {
      try {
        starRows = await query("SELECT id, nom, prenom, matricule, etoiles, malus, profession, fonction FROM adherents WHERE type_code <> 'BE' OR type_code IS NULL ORDER BY etoiles DESC, prenom ASC, nom ASC");
        // map malus -> notation_negative for compat
        starRows = starRows.map(r => ({ ...r, notation_negative: r.malus }));
      } catch (e2) {
        starRows = await query("SELECT id, nom, prenom, matricule, etoiles FROM adherents WHERE type_code <> 'BE' OR type_code IS NULL ORDER BY etoiles DESC, prenom ASC, nom ASC");
        starRows = starRows.map(r => ({ ...r, notation_negative: 0, malus: 0, profession: null, fonction: null }));
      }
    }
    const starGroups = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const row of starRows) {
      const s = Math.max(0, Math.min(5, Number.parseInt(row.etoiles, 10) || 0));
      starGroups[s].push(row);
    }
    const notationGroups = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const row of starRows) {
      const val = row.notation_negative ?? row.malus;
      const m = Math.max(0, Math.min(5, Number.parseInt(val, 10) || 0));
      notationGroups[m].push(row);
    }
    const malusGroups = notationGroups; // compat alias

    const expiringRows = await query("SELECT id, nom, prenom, matricule, date_adhesion FROM adherents WHERE (type_code <> 'BE' OR type_code IS NULL) AND date_adhesion IS NOT NULL");
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    const currentYear = String(today.getFullYear());
    let rankingRows = [];
    try {
      rankingRows = await query("SELECT id, nom, prenom, matricule, etoiles, notation_negative, malus, top_month_rank, top_year_rank, date_adhesion FROM adherents WHERE (type_code <> 'BE' OR type_code IS NULL)");
    } catch (e) {
      try {
        rankingRows = await query("SELECT id, nom, prenom, matricule, etoiles, malus, top_month_rank, top_year_rank, date_adhesion FROM adherents WHERE (type_code <> 'BE' OR type_code IS NULL)");
        rankingRows = rankingRows.map(r => ({ ...r, notation_negative: r.malus }));
      } catch (e2) {
        rankingRows = await query("SELECT id, nom, prenom, matricule, etoiles, top_month_rank, top_year_rank, date_adhesion FROM adherents WHERE (type_code <> 'BE' OR type_code IS NULL)");
        rankingRows = rankingRows.map(r => ({ ...r, notation_negative: 0, malus: 0 }));
      }
    }
    const sortRanked = (rows, rankField) => rows.sort((a, b) => {
      const ar = a[rankField] ?? Number.MAX_SAFE_INTEGER;
      const br = b[rankField] ?? Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      const ae = Number.parseInt(a.etoiles, 10) || 0;
      const be = Number.parseInt(b.etoiles, 10) || 0;
      if (be !== ae) return be - ae;
      return String(a.prenom || '').localeCompare(String(b.prenom || ''));
    }).slice(0, 10);
    const meilleursMois = sortRanked(rankingRows.filter((r) => String(r.date_adhesion || '').slice(0, 7) === currentMonth), 'top_month_rank');
    const meilleursAnnee = sortRanked(rankingRows.filter((r) => String(r.date_adhesion || '').slice(0, 4) === currentYear), 'top_year_rank');

    const adhesionsBientotExpirantes = expiringRows
      .map((row) => {
        const base = new Date(`${String(row.date_adhesion).slice(0, 10)}T00:00:00`);
        if (isNaN(base)) return null;
        base.setFullYear(base.getFullYear() + 1);
        const target = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const daysLeft = Math.round((target - now) / (24 * 60 * 60 * 1000));
        if (daysLeft < 0 || daysLeft > 30) return null;
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const d = String(target.getDate()).padStart(2, '0');
        return {
          id: row.id,
          nom: row.nom,
          prenom: row.prenom,
          matricule: row.matricule,
          date_expiration: `${y}-${m}-${d}`,
          daysLeft,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysLeft - b.daysLeft || String(a.prenom || '').localeCompare(String(b.prenom || '')));

    const demandesParStatut = await query('SELECT statut, COUNT(*) AS c FROM demandes_site GROUP BY statut');
    const totalDemandes = (await get('SELECT COUNT(*) AS c FROM demandes_site')).c;
    const demStatut = (s) => (demandesParStatut.find((x) => x.statut === s)?.c) || 0;
    const demandesOuvertes = demStatut('Nouvelle') + demStatut('En cours') + demStatut('En attente');
    const demandesCloturees = demStatut('Clôturée') + demStatut('Résolue');
    const tauxTraitement = totalDemandes ? Math.round((demandesCloturees / totalDemandes) * 100) : 0;

    // --- BLACKLIST STATS ---
   // --- BLACKLIST STATS ---
let totalBlacklist = 0;
let blacklistRecent = [];
try {
  const blCount = await get('SELECT COUNT(*) AS c FROM blacklist');
  totalBlacklist = blCount?.c || 0;
  blacklistRecent = await query(`
    SELECT bl.id, bl.nom, bl.prenom, bl.matricule, bl.date_blacklist, bl.motif
    FROM blacklist bl
    ORDER BY bl.created_at DESC
    LIMIT 8
  `);
} catch(e) {
  totalBlacklist = 0;
  blacklistRecent = [];
}
    res.json({
      totalAdherents,
      totalBureauExecutif,
      adherents: { AD: typeCount('AD'), MA: typeCount('MA'), CR: typeCount('CR'), gold },
      parWilaya, nouveauxMois, starGroups, notationGroups, malusGroups, starRows, adhesionsBientotExpirantes, meilleursMois, meilleursAnnee,
      demandes: { total: totalDemandes, ouvertes: demandesOuvertes, cloturees: demandesCloturees, tauxTraitement, parStatut: demandesParStatut },
      blacklist: { total: totalBlacklist, recent: blacklistRecent }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;