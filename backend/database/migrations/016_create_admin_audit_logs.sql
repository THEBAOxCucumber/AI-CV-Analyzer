-- บันทึกการกระทำของ Admin (เปลี่ยน role, ปลดล็อก, ลองใหม่, ยกเลิกงานค้าง)
-- admin ถูกลบแล้ว log ยังอยู่ (SET NULL + เก็บอีเมล ณ ตอนนั้น)
CREATE TABLE admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  admin_id INT UNSIGNED NULL,

  admin_email VARCHAR(255) NOT NULL,

  action VARCHAR(50) NOT NULL,

  target_type VARCHAR(30) NULL,

  target_id BIGINT UNSIGNED NULL,

  details JSON NULL,

  ip_address VARCHAR(45) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_admin_audit_logs_created (
    created_at,
    id
  ),

  KEY idx_admin_audit_logs_admin (
    admin_id,
    created_at
  ),

  CONSTRAINT fk_admin_audit_logs_admin
    FOREIGN KEY (admin_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);
