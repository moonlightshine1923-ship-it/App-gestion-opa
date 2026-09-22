/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `adherents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `matricule` varchar(40) DEFAULT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) NOT NULL,
  `nom_ar` varchar(100) DEFAULT NULL,
  `prenom_ar` varchar(100) DEFAULT NULL,
  `telephone` varchar(30) DEFAULT NULL,
  `nin` varchar(18) DEFAULT NULL,
  `doc_type` varchar(2) DEFAULT 'RC',
  `doc_numero` varchar(20) DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `wilaya_code` varchar(5) NOT NULL DEFAULT '16',
  `type_code` varchar(2) NOT NULL DEFAULT 'AD',
  `niveau` varchar(40) DEFAULT 'Adhérent Simple',
  `num_ordre` int(11) DEFAULT 0,
  `annee` int(11) DEFAULT 0,
  `date_adhesion` date DEFAULT NULL,
  `description` text DEFAULT NULL,
  `fichier_final` varchar(255) DEFAULT NULL,
  `dossier_pdf` varchar(255) DEFAULT NULL,
  `paiement_mode` varchar(20) DEFAULT NULL,
  `paiement_banque` varchar(150) DEFAULT NULL,
  `paiement_ref` varchar(100) DEFAULT NULL,
  `bureau_code` varchar(3) DEFAULT NULL,
  `bureau_badge_type` varchar(100) DEFAULT NULL,
  `etoiles` tinyint(4) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `matricule` (`matricule`),
  UNIQUE KEY `telephone` (`telephone`),
  UNIQUE KEY `nin` (`nin`),
  UNIQUE KEY `doc_numero` (`doc_numero`),
  UNIQUE KEY `uq_adh_nin` (`nin`),
  UNIQUE KEY `uq_adh_tel` (`telephone`),
  UNIQUE KEY `uq_adh_doc` (`doc_numero`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `adherents` WRITE;
/*!40000 ALTER TABLE `adherents` DISABLE KEYS */;
INSERT INTO `adherents` (`id`,`matricule`,`nom`,`prenom`,`nom_ar`,`prenom_ar`,`telephone`,`nin`,`doc_type`,`doc_numero`,`photo`,`wilaya_code`,`type_code`,`niveau`,`num_ordre`,`annee`,`date_adhesion`,`created_at`) VALUES
(1,'AGN19-09-001-MA-2026','Saadi','Yacine','سعدي','ياسين','0579192654','103986974295345075','AG','57941801681631',NULL,'09','MA','Membre Actif',1,2026,'2026-06-17','2026-06-04 11:19:37'),
(2,'AGN19-31-001-AD-2026','Boudiaf','Sara','بوضياف','سارة','0578662698','104828352760952836','CA','79078474120',NULL,'31','AD','Adhérent Gold',1,2026,'2026-01-24','2026-06-04 11:19:37'),
(3,'AGN19-23-001-CR-2026','Rahmani','Sara','رحماني','سارة','0584793818','154520760526780470','RC','343522784595',NULL,'23','CR','Conseiller',1,2026,'2026-12-20','2026-06-04 11:19:37'),
(4,'AGN19-16-001-MA-2026','Rahmani','Riad','رحماني','رياض','0589227227','136987932894271457','RC','405125351019',NULL,'16','MA','Membre Actif',1,2026,'2026-11-06','2026-06-04 11:19:37'),
(5,'AGN19-19-001-AD-2026','Hamdi','Lina','حمدي','لينة','0576499333','120132122402532290','RC','342455279079',NULL,'19','AD','Adhérent Simple',1,2026,'2026-08-07','2026-06-04 11:19:37'),
(6,'AGN19-13-001-AD-2026','Mansouri','Meriem','منصوري','مريم','0559297821','172064281140975039','CA','73865098012',NULL,'13','AD','Adhérent Gold',1,2026,'2026-02-07','2026-06-04 11:19:37'),
(7,'AGN19-19-002-CR-2026','Lounes','Bilal','لونيس','بلال','0579971195','176655596864520152','CA','12547822857',NULL,'19','CR','Conseiller',2,2026,'2026-09-14','2026-06-04 11:19:37'),
(8,'AGN19-13-002-MA-2026','Lounes','Imene','لونيس','إيمان','0572193039','117370509063897421','CA','18017893062',NULL,'13','MA','Membre Actif',2,2026,'2026-01-10','2026-06-04 11:19:37'),
(9,'AGN19-06-001-AD-2026','Rahmani','Ahmed','رحماني','أحمد','0580380729','150274004199608722','RC','941487318594',NULL,'06','AD','Adhérent Gold',1,2026,'2026-02-22','2026-06-04 11:19:37'),
(10,'AGN19-16-002-AD-2026','Benali','Bilal','بن علي','بلال','0576844417','117679200362114368','AG','40601840275',NULL,'16','AD','Adhérent Simple',2,2026,'2026-04-06','2026-06-04 11:19:37'),
(11,'AGN19-25-001-AD-2026','Tahar','Nadia','طاهر','نادية','0566436759','120314910867378009','CA','94232583558',NULL,'25','AD','Adhérent Gold',1,2026,'2026-10-22','2026-06-04 11:19:37'),
(12,'AGN19-15-001-MA-2026','Ziani','Sara','زياني','سارة','0562575035','181824523206059271','RC','094383018184',NULL,'15','MA','Membre Actif',1,2026,'2026-03-11','2026-06-04 11:19:37'),
(13,'AGN19-13-003-AD-2026','Lounes','Mohamed','لونيس','محمد','0567106396','134422881291974114','AG','103156900658',NULL,'13','AD','Adhérent Simple',3,2026,'2026-03-06','2026-06-04 11:19:37'),
(14,'AGN19-19-003-AD-2026','Belkacem','Nabil','بلقاسم','نبيل','0569192346','136100110225994455','RC','310859041073',NULL,'19','AD','Adhérent Gold',3,2026,'2026-05-12','2026-06-04 11:19:37'),
(15,'AGN19-15-002-MA-2026','Said','Yacine','سعيد','ياسين','0562131633','118924611722741014','RC','143515448850',NULL,'15','MA','Membre Actif',2,2026,'2026-01-23','2026-06-04 11:19:37'),
(16,'AGN19-05-001-AD-2026','Meziane','Mohamed','مزيان','محمد','0560809228','127187782721328139','AG','649606733714',NULL,'05','AD','Adhérent Simple',1,2026,'2026-10-17','2026-06-04 11:19:37'),
(17,'AGN19-31-002-AD-2026','Boudiaf','Amine','بوضياف','أمين','0597385447','104809802941553852','RC','114757554373',NULL,'31','AD','Adhérent Simple',2,2026,'2026-10-25','2026-06-04 11:19:37'),
(18,'AGN19-09-002-AD-2026','Ferhat','Ahmed','فرحات','أحمد','0557187496','134475409685988264','AG','29817053299010',NULL,'09','AD','Adhérent Simple',2,2026,'2026-03-08','2026-06-04 11:19:37'),
(19,'AGN19-19-004-CR-2026','Tahar','Souad','طاهر','سعاد','0570728819','194470404830747193','AG','94869774074927',NULL,'19','CR','Conseiller',4,2026,'2026-03-08','2026-06-04 11:19:37'),
(20,'AGN19-23-002-AD-2026','Cherif','Wassila','شريف','وسيلة','0584627507','136012847482739688','CA','68128469735',NULL,'23','AD','Adhérent Simple',2,2026,'2026-04-05','2026-06-04 11:19:37'),
(21,'AGN19-23-003-CR-2026','Kaci','Lina','قاسي','لينة','0592984007','179409948757566599','RC','814600289648',NULL,'23','CR','Conseiller',3,2026,'2026-05-19','2026-06-04 11:19:37'),
(22,'AGN19-23-004-MA-2026','Said','Amine','سعيد','أمين','0552739274','156536941891076522','AG','3328631261734',NULL,'23','MA','Membre Actif',4,2026,'2026-06-08','2026-06-04 11:19:37'),
(23,'AGN19-06-002-CR-2026','Ferhat','Mohamed','فرحات','محمد','0572261439','182088039444567625','AG','2939561886561',NULL,'06','CR','Conseiller',2,2026,'2026-11-11','2026-06-04 11:19:37'),
(24,'AGN19-31-003-CR-2026','Boudiaf','Amine','بوضياف','أمين','0569210888','132898378027643442','CA','80941285141',NULL,'31','CR','Conseiller',3,2026,'2026-10-09','2026-06-04 11:19:37'),
(25,'AGN19-16-003-AD-2026','Tahar','Karim','طاهر','كريم','0562908306','138367893629274143','AG','022387759963',NULL,'16','AD','Adhérent Simple',3,2026,'2026-04-18','2026-06-04 11:19:37'),
(26,'AGN19-15-003-CR-2026','Rahmani','Toufik','رحماني','توفيق','0557200959','153269365951435071','RC','035374072388',NULL,'15','CR','Conseiller',3,2026,'2026-08-26','2026-06-04 11:19:37'),
(27,'AGN19-23-005-MA-2026','Saadi','Amina','سعدي','أمينة','0561111728','157754427300272516','CA','29419308117',NULL,'23','MA','Membre Actif',5,2026,'2026-10-24','2026-06-04 11:19:37'),
(28,'AGN19-23-006-CR-2026','Tahar','Amina','طاهر','أمينة','0580532943','139067170269423313','CA','31716687242',NULL,'23','CR','Conseiller',6,2026,'2026-11-11','2026-06-04 11:19:37'),
(29,'AGN19-13-004-AD-2026','Bouzid','Riad','بوزيد','رياض','0578493063','103691409380336330','CA','37398189132',NULL,'13','AD','Adhérent Simple',4,2026,'2026-10-25','2026-06-04 11:19:37'),
(30,'AGN19-19-005-MA-2026','Belkacem','Amine','بلقاسم','أمين','0570997356','187790073989943594','CA','17784650403',NULL,'19','MA','Membre Actif',5,2026,'2026-04-26','2026-06-04 11:19:37'),
(31,'AGN19-05-002-AD-2026','Haddad','Amine','حداد','أمين','0555290421','130526975779602204','CA','74001209037',NULL,'05','AD','Adhérent Gold',2,2026,'2026-11-11','2026-06-04 11:19:37'),
(32,'AGN19-09-003-AD-2026','Said','Karim','سعيد','كريم','0594357651','115042121639367136','CA','13114295095',NULL,'09','AD','Adhérent Simple',3,2026,'2026-09-19','2026-06-04 11:19:37'),
(33,'AGN19-23-007-CR-2026','Kaci','Riad','قاسي','رياض','0595218975','114647054739304864','CA','96056617064',NULL,'23','CR','Conseiller',7,2026,'2026-11-17','2026-06-04 11:19:37'),
(34,'AGN19-13-005-AD-2026','Larbi','Riad','العربي','رياض','0566006480','150713630551387951','CA','48115964869',NULL,'13','AD','Adhérent Gold',5,2026,'2026-08-08','2026-06-04 11:19:37'),
(35,'AGN19-13-006-MA-2026','Boudiaf','Ahmed','بوضياف','أحمد','0584631836','118741828442189607','AG','55659960080421',NULL,'13','MA','Membre Actif',6,2026,'2026-04-14','2026-06-04 11:19:37'),
(36,'AGN19-15-004-AD-2026','Belkacem','Amina','بلقاسم','أمينة','0584811740','156869239177230286','AG','9502099878030',NULL,'15','AD','Adhérent Gold',4,2026,'2026-01-14','2026-06-04 11:19:37'),
(37,'AGN19-19-006-AD-2026','Haddad','Meriem','حداد','مريم','0556906066','160073277761521519','CA','96556598578',NULL,'19','AD','Adhérent Gold',6,2026,'2026-01-24','2026-06-04 11:19:37'),
(38,'AGN19-23-008-MA-2026','Cherif','Toufik','شريف','توفيق','0558926052','152973636449161175','AG','12838074582',NULL,'23','MA','Membre Actif',8,2026,'2026-01-23','2026-06-04 11:19:37'),
(39,'AGN19-23-009-AD-2026','Larbi','Sofiane','العربي','سفيان','0583316410','162484096986567183','RC','993336281468',NULL,'23','AD','Adhérent Simple',9,2026,'2026-05-11','2026-06-04 11:19:37'),
(40,'AGN19-13-007-AD-2026','Ferhat','Sofiane','فرحات','سفيان','0557713607','189076425723370925','CA','00950117126',NULL,'13','AD','Adhérent Simple',7,2026,'2026-01-05','2026-06-04 11:19:37'),
(41,'AGN19-16-004-AD-2026','Boudiaf','Sofiane','بوضياف','سفيان','0661234567','109876543210987654','RC','123456789012',NULL,'16','AD','Adhérent Simple',4,2026,'2026-03-15','2026-06-04 11:19:50');
/*!40000 ALTER TABLE `adherents` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `demande_pieces` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `demande_id` int(11) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_piece_dem` (`demande_id`),
  CONSTRAINT `fk_piece_dem` FOREIGN KEY (`demande_id`) REFERENCES `demandes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `demande_pieces` WRITE;
/*!40000 ALTER TABLE `demande_pieces` DISABLE KEYS */;
/*!40000 ALTER TABLE `demande_pieces` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `demandes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) NOT NULL,
  `matricule` varchar(40) DEFAULT NULL,
  `objet` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `priorite` varchar(20) NOT NULL DEFAULT 'Normale',
  `statut` varchar(20) NOT NULL DEFAULT 'En attente',
  `affecte_a` varchar(150) DEFAULT NULL,
  `reponse` text DEFAULT NULL,
  `source` varchar(20) DEFAULT 'site',
  `adherent_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero` (`numero`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `demandes` WRITE;
/*!40000 ALTER TABLE `demandes` DISABLE KEYS */;
INSERT INTO `demandes` VALUES
(1,'DEM-2026-0001','Meziane','Riad','AGN19-06-016-AD-2026','Demande de formation','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En attente',NULL,NULL,'site',NULL,'2026-10-02 10:00:00','2026-06-04 11:19:37'),
(2,'DEM-2026-0002','Bouzid','Toufik','AGN19-16-011-CR-2026','Demande de subvention','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En attente',NULL,NULL,'site',NULL,'2026-07-27 10:00:00','2026-06-04 11:19:37'),
(3,'DEM-2026-0003','Khelifi','Ahmed','AGN19-16-016-MA-2026','Demande d\'accompagnement juridique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Haute','En attente',NULL,NULL,'site',NULL,'2026-11-23 10:00:00','2026-06-04 11:19:37'),
(4,'DEM-2026-0004','Bouzid','Lina','AGN19-23-029-AD-2026','Demande de partenariat','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En attente',NULL,NULL,'site',NULL,'2026-03-07 10:00:00','2026-06-04 11:19:37'),
(5,'DEM-2026-0005','Tahar','Nadia',NULL,'Demande de formation','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En cours',NULL,NULL,'site',NULL,'2026-07-14 10:00:00','2026-06-04 11:19:37'),
(6,'DEM-2026-0006','Ziani','Imene','AGN19-13-008-MA-2026','Demande de subvention','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','Clôturée',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-02-21 10:00:00','2026-06-04 11:19:37'),
(7,'DEM-2026-0007','Benali','Yacine','AGN19-31-018-CR-2026','Participation au forum économique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Haute','Clôturée',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-12-10 10:00:00','2026-06-04 11:19:37'),
(8,'DEM-2026-0008','Khelifi','Mohamed','AGN19-16-023-AD-2026','Demande de formation','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Basse','En attente',NULL,NULL,'site',NULL,'2026-01-15 10:00:00','2026-06-04 11:19:37'),
(9,'DEM-2026-0009','Brahimi','Yasmine',NULL,'Demande de partenariat','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Haute','Résolue',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-03-12 10:00:00','2026-06-04 11:19:37'),
(10,'DEM-2026-0010','Bouzid','Amine','AGN19-19-032-MA-2026','Demande d\'accompagnement juridique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En attente',NULL,NULL,'site',NULL,'2026-08-14 10:00:00','2026-06-04 11:19:37'),
(11,'DEM-2026-0011','Kaci','Sofiane','AGN19-31-003-AD-2026','Mise à jour de mes coordonnées','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','Clôturée',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-08-07 10:00:00','2026-06-04 11:19:37'),
(12,'DEM-2026-0012','Benali','Amine','AGN19-15-021-MA-2026','Demande de partenariat','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Urgente','En attente',NULL,NULL,'site',NULL,'2026-03-05 10:00:00','2026-06-04 11:19:37'),
(13,'DEM-2026-0013','Haddad','Sara',NULL,'Demande d\'accompagnement juridique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En cours',NULL,NULL,'site',NULL,'2026-06-09 10:00:00','2026-06-04 11:19:37'),
(14,'DEM-2026-0014','Kaci','Nadia','AGN19-16-034-CR-2026','Mise à jour de mes coordonnées','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En cours',NULL,NULL,'site',NULL,'2026-12-17 10:00:00','2026-06-04 11:19:37'),
(15,'DEM-2026-0015','Benali','Sofiane',NULL,'Réclamation administrative','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En cours',NULL,NULL,'site',NULL,'2026-05-04 10:00:00','2026-06-04 11:19:37'),
(16,'DEM-2026-0016','Khelifi','Karim','AGN19-23-012-MA-2026','Mise à jour de mes coordonnées','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Urgente','En attente',NULL,NULL,'site',NULL,'2026-02-13 10:00:00','2026-06-04 11:19:37'),
(17,'DEM-2026-0017','Lounes','Sara','AGN19-31-023-AD-2026','Mise à jour de mes coordonnées','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Urgente','En cours',NULL,NULL,'site',NULL,'2026-08-01 10:00:00','2026-06-04 11:19:37'),
(18,'DEM-2026-0018','Kaci','Imene','AGN19-16-020-CR-2026','Mise à jour de mes coordonnées','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','Résolue',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-10-04 10:00:00','2026-06-04 11:19:37'),
(19,'DEM-2026-0019','Ziani','Toufik','AGN19-13-002-AD-2026','Demande de formation','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Urgente','Clôturée',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-01-23 10:00:00','2026-06-04 11:19:37'),
(20,'DEM-2026-0020','Ferhat','Lina',NULL,'Demande d\'accompagnement juridique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En attente',NULL,NULL,'site',NULL,'2026-02-13 10:00:00','2026-06-04 11:19:37'),
(21,'DEM-2026-0021','Said','Amine','AGN19-19-040-MA-2026','Demande de partenariat','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Haute','En attente',NULL,NULL,'site',NULL,'2026-11-13 10:00:00','2026-06-04 11:19:37'),
(22,'DEM-2026-0022','Boudiaf','Karim',NULL,'Demande d\'accompagnement juridique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Basse','Résolue',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-03-06 10:00:00','2026-06-04 11:19:37'),
(23,'DEM-2026-0023','Brahimi','Mohamed','AGN19-05-034-AD-2026','Mise à jour de mes coordonnées','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En attente',NULL,NULL,'site',NULL,'2026-07-11 10:00:00','2026-06-04 11:19:37'),
(24,'DEM-2026-0024','Saadi','Yasmine','AGN19-19-019-MA-2026','Mise à jour de mes coordonnées','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Haute','En attente',NULL,NULL,'site',NULL,'2026-05-07 10:00:00','2026-06-04 11:19:37'),
(25,'DEM-2026-0025','Ziani','Mohamed','AGN19-19-016-MA-2026','Demande de certificat d\'adhésion','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Urgente','Résolue',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-06-06 10:00:00','2026-06-04 11:19:37'),
(26,'DEM-2026-0026','Ferhat','Karim','AGN19-31-011-CR-2026','Participation au forum économique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Normale','En cours',NULL,NULL,'site',NULL,'2026-11-21 10:00:00','2026-06-04 11:19:37'),
(27,'DEM-2026-0027','Haddad','Toufik','AGN19-06-037-AD-2026','Demande d\'accompagnement juridique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Haute','En cours',NULL,NULL,'site',NULL,'2026-06-24 10:00:00','2026-06-04 11:19:37'),
(28,'DEM-2026-0028','Tahar','Bilal',NULL,'Réclamation administrative','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Basse','Résolue',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-07-28 10:00:00','2026-06-04 11:19:37'),
(29,'DEM-2026-0029','Said','Nadia',NULL,'Participation au forum économique','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Basse','Résolue',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-10-14 10:00:00','2026-06-04 11:19:37'),
(30,'DEM-2026-0030','Kaci','Yasmine','AGN19-06-011-AD-2026','Demande de certificat d\'adhésion','Bonjour, je vous adresse cette demande via le site web de l\'OPA. Merci de votre suivi.','Basse','Résolue',NULL,'Votre demande a été traitée avec succès.','site',NULL,'2026-10-22 10:00:00','2026-06-04 11:19:37');
/*!40000 ALTER TABLE `demandes` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `adherent_id` int(11) DEFAULT NULL,
  `titre` varchar(200) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_doc_adherent` (`adherent_id`),
  CONSTRAINT `fk_doc_adherent` FOREIGN KEY (`adherent_id`) REFERENCES `adherents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'admin@opa.dz','$2b$10$TeNSDeTFVDjHyYRVqu0u0OOSAAt8c4F86GOEhqGgV01NpUC8AOyyG','admin','2026-06-04 11:19:37'),
(2,'president@opa.dz','$2b$10$PWaT97WrwG4FkNcbKIzIYOvvFQy3bzw/WuUBd47dcsLfqaYSqUoiO','president','2026-06-04 11:19:37');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

