-- ล็อกอินด้วย Google / LinkedIn
--
-- password_set = 0 : บัญชีที่สร้างผ่าน OAuth และยังไม่ได้ตั้งรหัสผ่าน
--                    (password_hash เป็นค่าสุ่มที่ไม่มีใครรู้ → ล็อกอินด้วยรหัสผ่านไม่ได้)
--                    frontend บังคับให้ตั้งรหัสผ่านก่อนใช้งาน
ALTER TABLE users
  ADD COLUMN password_set TINYINT(1) NOT NULL DEFAULT 1
  AFTER password_hash;

-- บัญชีผู้ให้บริการที่เชื่อมกับผู้ใช้ (1 ผู้ใช้เชื่อมได้หลาย provider)
CREATE TABLE user_oauth_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  user_id INT UNSIGNED NOT NULL,

  provider ENUM('GOOGLE', 'LINKEDIN') NOT NULL,

  -- "sub" จาก OpenID Connect (คงที่ต่อบัญชี แม้ผู้ใช้เปลี่ยนอีเมล)
  provider_user_id VARCHAR(255) NOT NULL,

  email VARCHAR(255) NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  last_login_at TIMESTAMP NULL DEFAULT NULL,

  PRIMARY KEY (id),

  UNIQUE KEY uq_user_oauth_provider_subject (
    provider,
    provider_user_id
  ),

  UNIQUE KEY uq_user_oauth_user_provider (
    user_id,
    provider
  ),

  CONSTRAINT fk_user_oauth_accounts_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);
