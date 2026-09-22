// ============================================================
// check-db.js — Diagnostic MySQL OPA (à lancer EN LOCAL)
// Usage :  node check-db.js
// Placez ce fichier à la RACINE du projet (à côté de package.json).
// ============================================================
// Ce script :
//  1. affiche la config MySQL EFFECTIVE (celle que l'app utilisera) ;
//  2. teste la connexion au serveur MySQL ;
//  3. vérifie que la base existe (la crée si droit suffisant) ;
//  4. liste les tables finance_* et compte les lignes ;
//  5. fait un TEST D'ÉCRITURE réel puis annulé (rollback) dans
//     finance_mouvements → prouve que INSERT/UPDATE/DELETE sont OK.
// ============================================================

import mysql from 'mysql2/promise';
import { CONFIG } from './backend/config.js';

const { host, port, user, password, name } = CONFIG.db;

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║        DIAGNOSTIC MySQL — Application OPA            ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`   host : ${host}`);
console.log(`   port : ${port}`);
console.log(`   user : ${user}`);
console.log(`   base : ${name}`);
console.log(`   mdp  : ${password ? '(renseigné, ' + String(password).length + ' car.)' : '(vide)'}`);
console.log('');

let serverConn = null;
let dbConn = null;

try {
  // ── 1) Connexion au SERVEUR (sans base) ──
  console.log('① Connexion au serveur MySQL…');
  serverConn = await mysql.createConnection({ host, port, user, password });
  const [[ver]] = await serverConn.query('SELECT VERSION() AS v');
  console.log(`   ✅ Serveur OK — MySQL/MariaDB ${ver.v}`);
  console.log('');

  // ── 2) Base : existe ? sinon création (local uniquement en général) ──
  console.log(`② Base « ${name} »…`);
  const [dbs] = await serverConn.query('SHOW DATABASES');
  const names = dbs.map((r) => Object.values(r)[0]);
  if (names.includes(name)) {
    console.log('   ✅ La base existe.');
  } else {
    console.log('   ⚠️  La base n’existe pas → tentative de création…');
    try {
      await serverConn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log('   ✅ Base créée.');
    } catch (e) {
      console.log(`   ❌ Création impossible : ${e.message}`);
      console.log('      → Créez la base manuellement dans phpMyAdmin puis relancez.');
      process.exitCode = 1;
      await serverConn.end();
      process.exit();
    }
  }
  console.log('');

  // ── 3) Connexion À LA BASE ──
  console.log('③ Connexion à la base…');
  dbConn = await mysql.createConnection({ host, port, user, password, database: name });
  console.log('   ✅ Connecté.');
  console.log('');

  // ── 4) Tables finance_* ──
  console.log('④ Tables finance_* :');
  const [tables] = await dbConn.query("SHOW TABLES LIKE 'finance%'");
  const tableNames = tables.map((r) => Object.values(r)[0]);
  if (!tableNames.length) {
    console.log('   ⚠️  Aucune table finance_* — démarrez l’app (npm start) pour les créer, puis relancez ce script.');
  } else {
    for (const t of tableNames) {
      const [[c]] = await dbConn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      console.log(`   • ${t} : ${c.n} ligne(s)`);
    }
  }
  // Alerte si une table au SINGULIER existe (source classique de confusion)
  const [sing] = await dbConn.query("SHOW TABLES LIKE 'finance_mouvement'");
  if (sing.length) {
    console.log('');
    console.log('   ⚠️  ATTENTION : une table « finance_mouvement » (SANS s) existe !');
    console.log('      L’application écrit dans « finance_mouvements » (AVEC s).');
    console.log('      → Vérifiez son contenu, puis exécutez fix-finance-tables.sql');
    console.log('        (ou supprimez la table au singulier si elle est vide/inutile).');
  }
  console.log('');

  // ── 5) Test d'écriture RÉEL (INSERT + UPDATE + DELETE annulés) ──
  if (tableNames.includes('finance_mouvements') && tableNames.includes('finance_comptes')) {
    console.log('⑤ Test d’écriture dans finance_mouvements (annulé ensuite)…');
    await dbConn.beginTransaction();
    try {
      const [ins] = await dbConn.execute(
        `INSERT INTO finance_mouvements (compte_code, sens, nature, montant, date_mouvement, motif)
         VALUES ('CAISSE','sortie','autre',1,'2000-01-01','TEST-DIAG')`
      );
      console.log(`   ✅ INSERT ok (id test = ${ins.insertId})`);
      const [upd] = await dbConn.execute(
        'UPDATE finance_mouvements SET montant = 2 WHERE id = ?', [ins.insertId]
      );
      console.log(`   ✅ UPDATE ok (${upd.affectedRows} ligne)`);
      const [del] = await dbConn.execute(
        'DELETE FROM finance_mouvements WHERE id = ?', [ins.insertId]
      );
      console.log(`   ✅ DELETE ok (${del.affectedRows} ligne)`);
      await dbConn.rollback();
      console.log('   ↩️  Transaction annulée (rollback) → la base est INCHANGÉE, le test est fiable.');
    } catch (e) {
      await dbConn.rollback();
      console.log(`   ❌ ÉCHEC d’écriture : ${e.message}`);
      console.log('      → L’utilisateur MySQL n’a pas les droits INSERT/UPDATE/DELETE,');
      console.log('        ou la structure de la table est abîmée (exécutez fix-finance-tables.sql).');
      process.exitCode = 1;
    }
  } else {
    console.log('⑤ Test d’écriture : ignoré (tables finance absentes).');
  }
  console.log('');

  // ── 6) Dernières sorties (preuve visuelle) ──
  if (tableNames.includes('finance_mouvements')) {
    console.log('⑥ 5 derniers mouvements (toutes natures) :');
    const [rows] = await dbConn.query(
      'SELECT id, compte_code, sens, nature, montant, date_mouvement FROM finance_mouvements ORDER BY id DESC LIMIT 5'
    );
    if (!rows.length) console.log('   (table vide)');
    for (const r of rows) {
      console.log(`   #${r.id} ${r.date_mouvement} ${r.compte_code} ${r.sens}/${r.nature} ${r.montant}`);
    }
  }
  console.log('');
  console.log('✅ Diagnostic terminé. Si tout est vert, l’app DOIT écrire dans CETTE base.');
  console.log('   Ouvrez ensuite phpMyAdmin sur CETTE base (même host) et la table');
  console.log('   « finance_mouvements » (AVEC un s) : vos sorties y seront.');
  console.log('');
} catch (e) {
  console.log('');
  console.log(`❌ ERREUR : ${e.message} ${e.code ? `(code ${e.code})` : ''}`);
  console.log('');
  if (e.code === 'ECONNREFUSED') {
    console.log('→ MySQL ne répond pas : démarrez MySQL dans le panneau XAMPP');
    console.log('  et vérifiez DB_HOST=127.0.0.1 et DB_PORT=3306 dans le .env.');
  } else if (e.code === 'ER_ACCESS_DENIED_ERROR') {
    console.log('→ Identifiants refusés : vérifiez DB_USER / DB_PASSWORD dans le .env');
    console.log('  (en local XAMPP : user=root, mot de passe vide).');
  } else if (e.code === 'ER_BAD_DB_ERROR') {
    console.log(`→ Base « ${name} » introuvable et création refusée.`);
    console.log('  Créez-la dans phpMyAdmin ou corrigez DB_NAME.');
  }
  console.log('');
  process.exitCode = 1;
} finally {
  try { await serverConn?.end(); } catch {}
  try { await dbConn?.end(); } catch {}
}
