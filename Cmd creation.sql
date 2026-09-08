CREATE TABLE IF NOT EXISTS finance_comptes (
  code VARCHAR(20) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  montant_initial DECIMAL(15,2) NOT NULL DEFAULT 0,
  observation TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO finance_comptes (code, label, montant_initial, observation) VALUES
  ('BDL', 'BDL — Banque de Développement Local', 0, NULL),
  ('CPA', 'CPA — Crédit Populaire d''Algérie', 0, NULL),
  ('CAISSE', 'Caisse (espèces)', 0, NULL)
ON DUPLICATE KEY UPDATE label = VALUES(label);

CREATE TABLE IF NOT EXISTS finance_mouvements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compte_code VARCHAR(20) NOT NULL,
  sens ENUM('entree','sortie') NOT NULL,
  nature VARCHAR(40) NOT NULL,
  montant DECIMAL(15,2) NOT NULL,
  date_mouvement DATE NOT NULL,
  adherent_id INT DEFAULT NULL,
  cheque_numero VARCHAR(20) DEFAULT NULL,
  motif VARCHAR(150) DEFAULT NULL,
  observation TEXT,
  created_by INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fin_compte FOREIGN KEY (compte_code) REFERENCES finance_comptes(code),
  CONSTRAINT fk_fin_adherent FOREIGN KEY (adherent_id) REFERENCES adherents(id) ON DELETE SET NULL,
  CONSTRAINT fk_fin_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_fin_compte (compte_code),
  INDEX idx_fin_date (date_mouvement),
  INDEX idx_fin_adherent (adherent_id),
  INDEX idx_fin_sens (sens)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;