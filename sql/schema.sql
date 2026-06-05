-- Doctors Dashboard MySQL Schema (BD-01 Tables Only)

-- Disable foreign key checks to allow clean recreation of tables
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Doctors Table (Owner: BD-01)
DROP TABLE IF EXISTS `doctors`;
CREATE TABLE `doctors` (
  `doctor_id` INT AUTO_INCREMENT,
  `supabase_uid` VARCHAR(255) UNIQUE DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `specialization` VARCHAR(255) NOT NULL,
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`doctor_id`),
  UNIQUE KEY `idx_email` (`email`),
  KEY `idx_specialization` (`specialization`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Patients Table (Owner: BD-01)
DROP TABLE IF EXISTS `patients`;
CREATE TABLE `patients` (
  `patient_id` INT AUTO_INCREMENT,
  `doctor_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `dob` DATE DEFAULT NULL,
  `gender` VARCHAR(50) DEFAULT NULL,
  `phone` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `diagnosis` TEXT DEFAULT NULL,
  `status` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`patient_id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_status` (`status`),
  KEY `idx_name` (`name`),
  CONSTRAINT `fk_patients_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. User Sessions Table (Owner: BD-01)
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions` (
  `usess_id` INT AUTO_INCREMENT,
  `doctor_id` INT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `device` VARCHAR(255) DEFAULT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`usess_id`),
  KEY `idx_doctor_id` (`doctor_id`),
  KEY `idx_token_hash` (`token_hash`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_user_sessions_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
