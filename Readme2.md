OPA — Application de gestion interne
Application web de gestion interne pour l’Organisation des Patronats d’Algérie (OPA). Elle permet de gérer les adhérents, les membres du bureau exécutif, les demandes reçues depuis le site public, les documents, les utilisateurs, la blacklist, les statistiques, les sauvegardes et le journal d’audit.

Le projet est une application full-stack Node.js / Express / MySQL avec un frontend en HTML, CSS et JavaScript vanilla.

Sommaire
Description rapide
Fonctionnalités principales
Technologies utilisées
Arborescence du projet
Liste des fichiers existants
Rôle des fichiers importants
Installation et lancement
Variables de configuration
Méthode recommandée pour faire des changements
Modifier une page ou une interface
Modifier une API backend
Modifier la base de données
Gestion des demandes
Bonnes pratiques
Description rapide
Cette application sert à administrer les données internes de l’OPA :

fiches adhérents ;
matricules ;
bureau exécutif ;
demandes reçues depuis le site web public ;
documents et fichiers PDF ;
comptes utilisateurs ;
permissions ;
blacklist ;
statistiques ;
sauvegardes SQL ;
journal d’audit des actions.
Les visiteurs ne se connectent pas à cette application. Les visiteurs déposent leurs demandes depuis le site public. Ces demandes sont ensuite consultées et traitées dans cette app par les comptes autorisés.

Fonctionnalités principales
Adhérents
Ajouter un adhérent.
Modifier une fiche adhérent.
Supprimer une fiche.
Générer automatiquement un matricule.
Gérer la wilaya, le type de membre, le document professionnel, le paiement et les étoiles.
Renouveler une adhésion.
Afficher les alertes d’expiration d’adhésion.
Bureau exécutif
Gérer les membres du bureau exécutif.
Générer des matricules spécifiques au bureau exécutif.
Gérer les badges spéciaux.
Demandes
Afficher les demandes envoyées depuis le site public.
Ouvrir une demande avec le bouton Traiter.
Modifier le statut.
Modifier la priorité.
Affecter une demande à une personne.
Ajouter une réponse ou un suivi.
Clôturer une demande.
Supprimer une demande.
Documents
Fusionner des fichiers PDF.
Ouvrir les dossiers PDF.
Supprimer les documents fusionnés.
Utilisateurs
Créer des comptes personnalisés.
Donner des permissions précises : adhérents, demandes, documents, etc.
Réinitialiser un mot de passe.
Supprimer un compte.
Blacklist
Ajouter une personne à la blacklist.
Modifier une entrée blacklist.
Retirer une personne de la blacklist.
Voir les personnes signalées dans le tableau de bord.
Sauvegarde
Sauvegarde manuelle depuis les paramètres.
Sauvegardes SQL dans le dossier backups/.
Téléchargement des sauvegardes depuis l’application.
Audit
Historique des actions utilisateurs.
Connexions.
Créations, modifications, suppressions.
Traitement des demandes.
Sauvegardes.
Technologies utilisées
Node.js : serveur backend.
Express : API REST et serveur web.
MySQL / MariaDB : base de données.
mysql2 : connexion MySQL depuis Node.js.
JWT : authentification.
bcryptjs : hash des mots de passe.
Multer : upload de fichiers.
Nodemailer : préparation pour l’envoi d’e-mails.
pdf-merger-js : fusion de PDF.
HTML / CSS / JavaScript vanilla : frontend.
Arborescence du projet
txt

App-gestion-opa/
├── backend/
│   ├── data/
│   │   └── wilayas.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── routes/
│   │   ├── adherents.js
│   │   ├── audit.js
│   │   ├── auth.js
│   │   ├── blacklist.js
│   │   ├── demandes.js
│   │   ├── documents.js
│   │   ├── reference.js
│   │   ├── stats.js
│   │   └── users.js
│   ├── audit.js
│   ├── backup.js
│   ├── config.js
│   ├── db.js
│   ├── email.js
│   ├── matricule.js
│   ├── seed.js
│   └── server.js
├── backups/
│   ├── Sauvegarde bdd opa - 2026-06-09_12h02.sql
├── database/
│   └── opa_db.sql
├── frontend/
│   ├── assets/
│   │   ├── carte/
│   │   │   ├── cachet.png
│   │   │   └── models/
│   │   │       ├── be_1.png
│   │   │       ├── be_2.png
│   │   │       ├── be_p1.png
│   │   │       ├── gold_p1.png
│   │   │       ├── gold_p2.png
│   │   │       ├── simple_p1.png
│   │   │       └── simple_p2.png
│   │   ├── dossier/
│   │   │   ├── page1.png
│   │   │   ├── page2.png
│   │   │   └── page3.png
│   │   └── logo.png
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── charts.js
│   │   ├── ui.js
│   │   └── views.js
│   └── index.html
├── .gitignore
├── BLACKLIST_FEATURE.md
├── package-lock.json
├── package.json
└── README.md
Liste des fichiers existants
txt

.gitignore
BLACKLIST_FEATURE.md
README.md
backend/audit.js
backend/backup.js
backend/config.js
backend/data/wilayas.js
backend/db.js
backend/email.js
backend/matricule.js
backend/middleware/auth.js
backend/middleware/upload.js
backend/routes/adherents.js
backend/routes/audit.js
backend/routes/auth.js
backend/routes/blacklist.js
backend/routes/demandes.js
backend/routes/documents.js
backend/routes/reference.js
backend/routes/stats.js
backend/routes/users.js
backend/seed.js
backend/server.js
backups/Sauvegarde bdd opa - 2026-06-09_12h02.sql
database/opa_db.sql
frontend/assets/carte/cachet.png
frontend/assets/carte/models/be_1.png
frontend/assets/carte/models/be_2.png
frontend/assets/carte/models/be_p1.png
frontend/assets/carte/models/gold_p1.png
frontend/assets/carte/models/gold_p2.png
frontend/assets/carte/models/simple_p1.png
frontend/assets/carte/models/simple_p2.png
frontend/assets/dossier/page1.png
frontend/assets/dossier/page2.png
frontend/assets/dossier/page3.png
frontend/assets/logo.png
frontend/css/style.css
frontend/index.html
frontend/js/api.js
frontend/js/app.js
frontend/js/charts.js
frontend/js/ui.js
frontend/js/views.js
package-lock.json
package.json
Rôle des fichiers importants

server.js
Point d’entrée du serveur. Il :

initialise Express ;
charge les routes API ;
sert le frontend ;
active les headers de sécurité ;
connecte la base MySQL ;
lance les sauvegardes automatiques ;
démarre le serveur local.

config.js
Fichier de configuration :

connexion MySQL ;
configuration e-mail ;
configuration des sauvegardes.
Les variables d’environnement ont la priorité sur les valeurs écrites dans ce fichier.


db.js
Gestion de la base de données :

connexion MySQL ;
création automatique de certaines tables ;
migrations simples ;
fonctions utilitaires query, get, run.

seed.js
Initialise les comptes et données de départ.


matricule.js
Contient la logique de génération des matricules adhérents.


adherents.js
Routes API pour les adhérents : création, modification, suppression, détail, génération documents.


demandes.js
Routes API pour les demandes :

dépôt public ;
liste des demandes ;
détail d’une demande ;
modification du traitement ;
clôture ;
suppression.

documents.js
Routes API pour la gestion documentaire : upload, fusion, suppression de fichiers.


users.js
Routes API pour la gestion des utilisateurs et permissions.


auth.js
Routes de connexion, session utilisateur et changement de mot de passe.


stats.js
Routes pour alimenter le tableau de bord.


blacklist.js
Routes pour la blacklist.


audit.js
Routes pour consulter les logs d’audit.


index.html
Page principale de l’application.


app.js
Logique globale du frontend : démarrage de l’app, connexion, navigation, rôle utilisateur, permissions.


api.js
Client API côté frontend. Toutes les fonctions qui appellent le backend sont ici.

Exemples :

JavaScript

API.adherents()
API.demandes()
API.updateDemande(id, data)
API.deleteAdherent(id)

views.js
Fichier principal des écrans. Il contient les vues :

dashboard ;
liste adhérents ;
formulaire adhérent ;
détail adhérent ;
liste demandes ;
détail / traitement demande ;
documents ;
utilisateurs ;
blacklist ;
audit.

ui.js
Fonctions UI réutilisables :

modal ;
toast ;
confirmation ;
badges de statut ;
helpers HTML.

charts.js
Composants graphiques simples pour le tableau de bord.


style.css
Style global de l’application.

Installation et lancement
1. Installer Node.js
Installer Node.js version 18 ou plus.

2. Démarrer MySQL
Avec XAMPP, démarrer le service MySQL / MariaDB.

3. Installer les dépendances
Dans le dossier du projet :

Bash

npm install
4. Lancer l’application
Bash

npm start
Selon la configuration actuelle, l’application démarre généralement sur :

txt

http://localhost:3003
Le port est défini dans 
server.js
 avec :

JavaScript

const PORT = process.env.PORT || 3003;
5. Vérifier l’état du serveur
Ouvrir :

txt

http://localhost:3003/api/health
Réponse attendue :

JSON

{
  "status": "ok",
  "time": "...",
  "db": "connected"
}
Variables de configuration
Il est conseillé de créer un fichier .env à la racine du projet.

Exemple :

env

PORT=3003

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=opa_db

OPA_DIRECTION_EMAIL=direction@opa.dz
SMTP_USER=votre.compte@gmail.com
SMTP_PASS=mot_de_passe_application_gmail
Si .env n’existe pas, l’app utilise les valeurs par défaut dans 
config.js
.

Méthode recommandée pour faire des changements
Avant de modifier l’application, suivre toujours cette méthode.

Étape 1 — Faire une sauvegarde
Avant toute modification importante :

ouvrir l’application ;
aller dans Paramètres ;
cliquer sur Sauvegarder maintenant ;
vérifier qu’un fichier .sql a été créé dans backups/.
Ou copier manuellement toute la base via phpMyAdmin.

Étape 2 — Identifier ce qu’on veut modifier
Modification d’affichage : voir 
views.js
 ou 
style.css
.
Modification d’un appel API : voir 
api.js
.
Modification backend : voir backend/routes/....
Modification base de données : voir 
db.js
 et MySQL.
Modification des référentiels : voir 
wilayas.js
.
Étape 3 — Modifier un seul sujet à la fois
Ne pas modifier 10 choses en même temps. Exemple :

modifier seulement le formulaire ;
tester ;
modifier ensuite l’API ;
tester ;
modifier ensuite la base si nécessaire.
Étape 4 — Redémarrer le serveur
Après modification du backend :

Bash

npm start
Si le serveur est déjà lancé, arrêter avec :

txt

Ctrl + C
Puis relancer :

Bash

npm start
Étape 5 — Vider le cache navigateur
Après modification du frontend :

txt

Ctrl + F5
Cela force le navigateur à recharger les fichiers JS et CSS.

Étape 6 — Tester la fonctionnalité
Tester :

le cas normal ;
le cas vide ;
le cas erreur ;
les permissions ;
la sauvegarde des données dans MySQL.
Étape 7 — Vérifier la console
Dans le navigateur :

txt

F12 > Console
Dans le terminal Node.js, vérifier les erreurs serveur.

Modifier une page ou une interface
La majorité des écrans sont dans :

txt

frontend/js/views.js
Exemples :

Fonction	Rôle
dashboard()	Tableau de bord
adherentsList()	Liste des adhérents
adherentForm()	Formulaire adhérent
adherentDetail()	Détail adhérent
demandesList()	Liste des demandes
demandeDetail()	Fenêtre de traitement d’une demande
documentsList()	Gestion documentaire
comptesList()	Comptes utilisateurs
blacklistList()	Blacklist
auditList()	Journal d’audit
Exemple : changer le texte du bouton Traiter
Dans 
views.js
, chercher :

JavaScript

${canEditDemandes() ? 'Traiter' : 'Voir'}
Remplacer par :

JavaScript

${canEditDemandes() ? 'Ouvrir le traitement' : 'Voir'}
Puis :

txt

Ctrl + F5
Modifier une API backend
Les routes backend sont dans :

txt

backend/routes/
Exemple pour les demandes :

txt

backend/routes/demandes.js
Exemple : route de mise à jour d’une demande
JavaScript

router.patch('/:id', authenticate, authorize('admin', 'president', 'perm:demandes_edit'), async (req, res) => {
  // logique de modification
});
Après modification d’un fichier backend :

Bash

npm start
Modifier la base de données
La base principale est MySQL, généralement :

txt

opa_db
Le schéma automatique et certaines migrations sont dans :

txt

backend/db.js
Ajouter une colonne proprement
Exemple : ajouter une colonne commentaire_interne dans demandes_site.

Dans 
db.js
, dans la fonction ensureMigrations(), ajouter :

JavaScript

try {
  if (!(await hasColumn('demandes_site', 'commentaire_interne'))) {
    await query('ALTER TABLE demandes_site ADD COLUMN commentaire_interne TEXT');
  }
} catch (e) {
  console.warn('Migration commentaire_interne :', e.message);
}
Puis redémarrer :

Bash

npm start
Ensuite vérifier dans phpMyAdmin que la colonne existe.

Gestion des demandes
Flux normal
Le site public envoie une demande à l’API.
La demande est enregistrée dans la table demandes_site.
L’app interne affiche la demande dans l’écran Demandes.
Un utilisateur autorisé clique sur Traiter.
Il modifie le statut, la priorité, l’affectation ou la réponse.
Il enregistre le traitement.
L’action est enregistrée dans le journal d’audit.
Fichiers concernés
Fichier	Rôle

views.js
Affichage liste demandes et fenêtre Traiter

api.js
Appels API.demandes, API.demande, API.updateDemande

demandes.js
API backend des demandes

wilayas.js
Statuts et priorités disponibles

db.js
Schéma / migrations base de données
Permissions nécessaires
Pour voir les demandes :

txt

demandes_view
Pour traiter les demandes :

txt

demandes_edit
Les rôles admin et president ont l’accès complet.

Bonnes pratiques
Avant modification
Faire une sauvegarde SQL.
Noter exactement le fichier modifié.
Garder une copie de l’ancien code.
Pendant modification
Modifier un fichier à la fois.
Tester après chaque modification.
Ne pas modifier directement plusieurs routes API en même temps.
Après modification
Redémarrer Node.js si backend modifié.
Faire Ctrl + F5 si frontend modifié.
Tester avec un compte admin.
Tester avec un compte personnalisé si la modification touche les permissions.
Vérifier la console navigateur.
Vérifier le terminal serveur.
En cas de bug
Regarder la console navigateur avec F12.
Regarder le terminal Node.js.
Tester /api/health.
Vérifier MySQL dans XAMPP.
Restaurer la dernière sauvegarde si nécessaire.
Commandes utiles
Installer les dépendances :

Bash

npm install
Démarrer l’application :

Bash

npm start
Lancer le seed manuellement :

Bash

npm run seed
Vérifier l’API :

txt

http://localhost:3003/api/health
Notes importantes
Le frontend est servi directement par Express depuis le dossier frontend/.
Les fichiers uploadés sont servis via /uploads, avec authentification.
Les sauvegardes sont stockées dans backups/.
Le fichier 
opa_db.sql
 est un export SQL utile pour phpMyAdmin.
Les comptes utilisateurs et permissions sont gérés depuis l’application.
Les rôles admin et president ont les droits complets.
Résumé pour développeur
Si tu veux modifier l’app :

txt

1. Sauvegarder la base.
2. Identifier frontend ou backend.
3. Modifier le fichier concerné.
4. Redémarrer si backend.
5. Ctrl + F5 si frontend.
6. Tester.
7. Vérifier console navigateur + terminal.
Les fichiers les plus utilisés pour les changements sont :

txt

frontend/js/views.js       interface et écrans
frontend/js/api.js         appels API
frontend/css/style.css     design
backend/routes/*.js        logique API
backend/db.js              base de données et migrations
backend/data/wilayas.js    référentiels, statuts, priorités