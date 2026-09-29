-- Fresh-install script: this drops and recreates MovieHub tables.
-- Do not re-import this file into a database containing data you need to keep.
CREATE DATABASE IF NOT EXISTS moviehub_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE moviehub_db;

DROP TABLE IF EXISTS download_logs;
DROP TABLE IF EXISTS purchases;
DROP TABLE IF EXISTS payment_submissions;
DROP TABLE IF EXISTS payment_orders;
DROP TABLE IF EXISTS payment_settings;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

CREATE TABLE roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_id (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE movies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED DEFAULT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  genre VARCHAR(100) DEFAULT NULL,
  release_year YEAR DEFAULT NULL,
  duration_minutes INT UNSIGNED DEFAULT NULL,
  language VARCHAR(100) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  poster_path VARCHAR(500) DEFAULT NULL,
  movie_file_path VARCHAR(500) NOT NULL,
  movie_file_size BIGINT UNSIGNED NOT NULL,
  movie_file_mime_type VARCHAR(100) NOT NULL,
  price_rwf DECIMAL(12,2) NOT NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_movies_slug (slug),
  KEY idx_movies_category_id (category_id),
  KEY idx_movies_uploaded_by (uploaded_by),
  KEY idx_movies_status (status),
  CONSTRAINT fk_movies_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_movies_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_name VARCHAR(100) NOT NULL,
  payment_phone_number VARCHAR(30) NOT NULL,
  account_name VARCHAR(150) DEFAULT NULL,
  instructions TEXT DEFAULT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'RWF',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by BIGINT UNSIGNED DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_settings_updated_by (updated_by),
  CONSTRAINT fk_payment_settings_user FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  movie_id BIGINT UNSIGNED NOT NULL,
  order_reference VARCHAR(100) NOT NULL,
  amount_rwf DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'RWF',
  status ENUM('pending','submitted','approved','rejected','expired','cancelled') NOT NULL DEFAULT 'pending',
  expires_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_orders_reference (order_reference),
  KEY idx_payment_orders_user_id (user_id),
  KEY idx_payment_orders_movie_id (movie_id),
  KEY idx_payment_orders_status (status),
  CONSTRAINT fk_payment_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_payment_orders_movie FOREIGN KEY (movie_id) REFERENCES movies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_reference VARCHAR(150) DEFAULT NULL,
  sender_phone VARCHAR(30) DEFAULT NULL,
  submitted_amount_rwf DECIMAL(12,2) NOT NULL,
  proof_file_path VARCHAR(500) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_submissions_order_id (payment_order_id),
  KEY idx_payment_submissions_user_id (user_id),
  KEY idx_payment_submissions_status (status),
  CONSTRAINT fk_payment_submissions_order FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id),
  CONSTRAINT fk_payment_submissions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_payment_submissions_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  movie_id BIGINT UNSIGNED NOT NULL,
  payment_order_id BIGINT UNSIGNED NOT NULL,
  payment_submission_id BIGINT UNSIGNED NOT NULL,
  amount_paid_rwf DECIMAL(12,2) NOT NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchases_user_movie_active (user_id, movie_id, status),
  KEY idx_purchases_user_id (user_id),
  KEY idx_purchases_movie_id (movie_id),
  KEY idx_purchases_payment_order_id (payment_order_id),
  KEY idx_purchases_payment_submission_id (payment_submission_id),
  CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_purchases_movie FOREIGN KEY (movie_id) REFERENCES movies(id),
  CONSTRAINT fk_purchases_order FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id),
  CONSTRAINT fk_purchases_submission FOREIGN KEY (payment_submission_id) REFERENCES payment_submissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE download_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  movie_id BIGINT UNSIGNED NOT NULL,
  purchase_id BIGINT UNSIGNED NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_download_logs_user_id (user_id),
  KEY idx_download_logs_movie_id (movie_id),
  KEY idx_download_logs_purchase_id (purchase_id),
  CONSTRAINT fk_download_logs_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_download_logs_movie FOREIGN KEY (movie_id) REFERENCES movies(id),
  CONSTRAINT fk_download_logs_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) DEFAULT NULL,
  entity_id BIGINT UNSIGNED DEFAULT NULL,
  description TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user_id (user_id),
  KEY idx_audit_logs_action (action),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_reset_tokens_user_id (user_id),
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name) VALUES ('admin'), ('user');

INSERT INTO categories (name, description) VALUES
('Action', 'Fast-paced action and adventure movies.'),
('Drama', 'Character-driven stories and emotional narratives.'),
('Comedy', 'Humorous and light-hearted entertainment.'),
('Documentary', 'Real-life stories, culture and education.'),
('Animation', 'Animated films for all ages.'),
('Short Film', 'Compact and creative cinematic stories.');

CREATE INDEX idx_movies_title ON movies (title);
CREATE INDEX idx_movies_genre ON movies (genre);
CREATE INDEX idx_movies_price ON movies (price_rwf);
CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_payment_orders_user_movie ON payment_orders (user_id, movie_id);
CREATE INDEX idx_payment_submissions_order_status ON payment_submissions (payment_order_id, status);
CREATE INDEX idx_purchases_user_movie ON purchases (user_id, movie_id);

SELECT 'MovieHub schema initialized successfully.' AS status;
