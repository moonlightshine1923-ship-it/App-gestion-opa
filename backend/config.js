<<<<<<< HEAD
=======
// ============================================================
//  CONFIGURATION OPA — ✅ VERSION CORRIGÉE (22/09/2026)
// ============================================================
//  ★ C'EST DANS CE FICHIER (+ le fichier .env) QUE VOUS
//    RENSEIGNEZ LE NOM DE LA BASE ET L'UTILISATEUR MySQL. ★
//
//  ORDRE DE PRIORITÉ (du plus fort au plus faible) :
//    1. Variables d'environnement déjà définies
//       (ex : cPanel « Setup Node.js App » > Environment variables)
//    2. Fichier .env à la RACINE du projet (à côté de package.json)
//    3. Valeurs par défaut ci-dessous (XAMPP local)
//
//  CORRECTION APPORTÉE :
//  - Ce fichier charge LUI-MÊME le .env AVANT de lire
//    process.env. Avant, le .env était chargé dans server.js
//    APRÈS les imports (hoisting ESM) → le .env était donc
//    silencieusement IGNORÉ et l'app utilisait toujours
//    root / opa_db, même sur cPanel. C'est la cause n°1 de
//    « ça s'affiche mais rien ne s'écrit dans MA base ».
// ============================================================

>>>>>>> 0e2f66d53026f4fbb000dd7baf5779d721660afa
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Charger .env depuis la racine du projet (avant tout) ──
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

// Nettoie une valeur (espaces parasites = erreur de connexion assurée)
function cleanStr(v, fallback = '') {
  const s = String(v ?? '').trim();
  return s === '' ? fallback : s;
}

export const CONFIG = {
  // ---------- Base de données MySQL ----------
  // 👉 EN LOCAL (XAMPP) : laissez les défauts (root / sans mot de passe / opa_db)
  //    ou créez un fichier .env à la racine (voir .env.example).
  // 👉 SUR CPANEL : NE modifiez PAS ce fichier à chaque déploiement.
  //    Créez plutôt le fichier .env sur cPanel avec :
  //      DB_HOST=localhost
  //      DB_PORT=3306
  //      DB_USER=cpaneluser_nomuser   (avec le préfixe cPanel !)
  //      DB_PASSWORD=le_vrai_mot_de_passe
  //      DB_NAME=cpaneluser_opa_db    (avec le préfixe cPanel !)
  db: {
    host: cleanStr(process.env.DB_HOST, '127.0.0.1'),
    port: parseInt(cleanStr(process.env.DB_PORT, '3306'), 10) || 3306,
    user: cleanStr(process.env.DB_USER, 'root'),
    // ⚠️ Le mot de passe peut contenir des espaces : on ne le trim PAS ici,
    //    sauf espaces autour ajoutés par copier-coller → on trim quand même
    //    car 99 % des échecs cPanel viennent d'un espace parasite.
    password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD).trim() : '',
    name: cleanStr(process.env.DB_NAME, 'opa_db'),
  },

  // ---------- Envoi des emails (demandes -> direction) ----------
  mail: {
    // Mettre à true pour activer l'envoi réel des emails.
    enabled: true,

    // Adresse qui RECEVRA les demandes (boîte de la direction).
    directionEmail: cleanStr(process.env.OPA_DIRECTION_EMAIL, 'direction.opa@exemple.com'),

    // Compte Gmail utilisé pour ENVOYER les emails.
    gmailUser: cleanStr(process.env.SMTP_USER, 'votre.compte@gmail.com'),
    gmailAppPassword: process.env.SMTP_PASS || 'xxxx xxxx xxxx xxxx',
  },

  // ---------- Sauvegarde automatique ----------
  backup: {
    // Jour de la semaine : 0=dimanche, 1=lundi ... 4=jeudi ... 6=samedi
    dayOfWeek: 4,   // Jeudi
    hour: 16,       // 16h
    minute: 0,
    keep: 30,       // nombre de sauvegardes à conserver
  },
};

// ── Affichage de contrôle au démarrage (SANS le mot de passe) ──
// Permet de vérifier en 2 secondes quelle base l'app utilise VRAIMENT.
export function logDbConfig() {
  console.log('── Config MySQL effective ──────────────────────────');
  console.log(`   host : ${CONFIG.db.host}`);
  console.log(`   port : ${CONFIG.db.port}`);
  console.log(`   user : ${CONFIG.db.user}`);
  console.log(`   base : ${CONFIG.db.name}`);
  console.log('────────────────────────────────────────────────────');
}
