import bcrypt from 'bcryptjs';
import { connect, initSchema, get, run } from './db.js';
import { generateMatricule } from './matricule.js';
import { DOC_TYPES } from './data/wilayas.js';
import { ensureFinanceSchema } from './routes/finances.js';

const PRENOMS_H = ['Karim', 'Ahmed', 'Sofiane', 'Yacine', 'Mohamed', 'Riad', 'Bilal', 'Toufik', 'Nabil', 'Amine'];
const PRENOMS_F = ['Amina', 'Sara', 'Nadia', 'Yasmine', 'Lina', 'Imene', 'Hayet', 'Souad', 'Meriem', 'Wassila'];
const NOMS = ['Benali', 'Haddad', 'Cherif', 'Mansouri', 'Belkacem', 'Boudiaf', 'Khelifi', 'Saadi', 'Ziani',
  'Bouzid', 'Brahimi', 'Kaci', 'Lounes', 'Meziane', 'Tahar', 'Ferhat', 'Larbi', 'Said', 'Hamdi', 'Rahmani'];

// Équivalents arabes (même index que les tableaux latins)
const PRENOMS_H_AR = ['كريم', 'أحمد', 'سفيان', 'ياسين', 'محمد', 'رياض', 'بلال', 'توفيق', 'نبيل', 'أمين'];
const PRENOMS_F_AR = ['أمينة', 'سارة', 'نادية', 'ياسمين', 'لينة', 'إيمان', 'حياة', 'سعاد', 'مريم', 'وسيلة'];
const NOMS_AR = ['بن علي', 'حداد', 'شريف', 'منصوري', 'بلقاسم', 'بوضياف', 'خليفي', 'سعدي', 'زياني',
  'بوزيد', 'إبراهيمي', 'قاسي', 'لونيس', 'مزيان', 'طاهر', 'فرحات', 'العربي', 'سعيد', 'حمدي', 'رحماني'];
const WILAYAS_DEMO = ['16', '31', '25', '19', '06', '15', '09', '23', '05', '13'];
const TYPES_DEMO = ['AD', 'AD', 'AD', 'MA', 'MA', 'CR'];

const OBJETS = [
  "Demande de certificat d'adhésion", 'Mise à jour de mes coordonnées', "Demande d'accompagnement juridique",
  'Participation au forum économique', 'Demande de partenariat', 'Réclamation administrative',
  'Demande de formation', 'Demande de subvention',
];
const PRIORITES_DEMO = ['Basse', 'Normale', 'Normale', 'Haute', 'Urgente'];
const STATUTS_DEMO = ['En attente', 'En attente', 'En cours', 'Résolue', 'Clôturée'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// Génère un numéro de document selon le type (longueur exacte/plage)
function genDocNumero(code) {
  const dt = DOC_TYPES.find((d) => d.code === code) || DOC_TYPES[0];
  const len = dt.min === dt.max ? dt.min : randInt(dt.min, dt.max);
  let s = '';
  for (let i = 0; i < len; i++) s += randInt(0, 9);
  return s;
}

function genNIN() {
  let s = '1';
  for (let i = 0; i < 17; i++) s += randInt(0, 9);
  return s; // 18 chiffres
}

export async function ensureSeed() {
  await initSchema();
  await ensureFinanceSchema();
  const userCount = (await get('SELECT COUNT(*) AS c FROM users')).c;
  if (userCount > 0) return;

  console.log('  Initialisation des données de démonstration...');

  // Comptes : uniquement administrateur et président
  await run('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)',
    ['admin@opa.dz', bcrypt.hashSync('Admin@2026', 10), 'admin']);
  await run('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)',
    ['president@opa.dz', bcrypt.hashSync('President@2026', 10), 'president']);

  // Adhérents (année déduite de la date d'adhésion ; ici on reste sur l'année courante)
  const year = new Date().getFullYear();
  const usedNin = new Set(), usedTel = new Set(), usedDoc = new Set();

  for (let i = 0; i < 40; i++) {
    const isF = Math.random() > 0.6;
    const pIdx = randInt(0, PRENOMS_H.length - 1);
    const nIdx = randInt(0, NOMS.length - 1);
    const prenom = (isF ? PRENOMS_F : PRENOMS_H)[pIdx];
    const prenom_ar = (isF ? PRENOMS_F_AR : PRENOMS_H_AR)[pIdx];
    const nom = NOMS[nIdx];
    const nom_ar = NOMS_AR[nIdx];
    const wilaya_code = rand(WILAYAS_DEMO);
    const type_code = rand(TYPES_DEMO);
    let niveau = 'Adhérent Simple';
    if (type_code === 'MA') niveau = 'Membre Actif';
    else if (type_code === 'CR') niveau = 'Conseiller';
    else if (Math.random() > 0.6) niveau = 'Adhérent Gold';

    const { matricule, num_ordre } = await generateMatricule({ wilaya_code, type_code, annee: year });

    let nin; do { nin = genNIN(); } while (usedNin.has(nin)); usedNin.add(nin);
    let tel; do { tel = '05' + randInt(50000000, 99999999); } while (usedTel.has(tel)); usedTel.add(tel);
    const doc_type = rand(DOC_TYPES).code;
    let doc_numero; do { doc_numero = genDocNumero(doc_type); } while (usedDoc.has(doc_numero)); usedDoc.add(doc_numero);

    const m = String(randInt(1, 12)).padStart(2, '0');
    const dd = String(randInt(1, 28)).padStart(2, '0');
    const date_adhesion = `${year}-${m}-${dd}`;

    await run(
      `INSERT INTO adherents (matricule, nom, prenom, nom_ar, prenom_ar, telephone, nin, doc_type, doc_numero, photo, wilaya_code, type_code, niveau, num_ordre, annee, date_adhesion)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [matricule, nom, prenom, nom_ar, prenom_ar, tel, nin, doc_type, doc_numero, null, wilaya_code, type_code, niveau, num_ordre, year, date_adhesion]
    );
  }

  // Demandes déposées depuis le site web
  const counter = { [year]: 0 };
  for (let i = 0; i < 30; i++) {
    counter[year]++;
    const numero = `DEM-${year}-${String(counter[year]).padStart(4, '0')}`;
    const isF = Math.random() > 0.6;
    const nom = rand(NOMS);
    const prenom = rand(isF ? PRENOMS_F : PRENOMS_H);
    const matricule = Math.random() > 0.4 ? `AGN19-${rand(WILAYAS_DEMO)}-${String(randInt(1, 40)).padStart(3, '0')}-${rand(TYPES_DEMO)}-${year}` : null;
    const objet = rand(OBJETS);
    const priorite = rand(PRIORITES_DEMO);
    const statut = rand(STATUTS_DEMO);
    const reponse = (statut === 'Résolue' || statut === 'Clôturée') ? 'Votre demande a été traitée avec succès.' : null;
    const m = String(randInt(1, 12)).padStart(2, '0');
    const dd = String(randInt(1, 28)).padStart(2, '0');
    await run(
      `INSERT INTO demandes (numero, nom, prenom, matricule, objet, description, priorite, statut, reponse, source, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [numero, nom, prenom, matricule, objet,
        "Bonjour, je vous adresse cette demande via le site web de l'OPA. Merci de votre suivi.",
        priorite, statut, reponse, 'site', `${year}-${m}-${dd} 10:00:00`]
    );
  }

  console.log('  Données de démonstration créées.');
  console.log('  Comptes : admin@opa.dz / Admin@2026  ·  president@opa.dz / President@2026');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => { await connect(); await ensureSeed(); process.exit(0); })();
}
