-- ทำให้ DB ที่สร้างจาก migration ตรงกับ DB dev (เคยแก้ด้วยมือ ไม่มี migration)
-- รันซ้ำได้: ทุกคำสั่งเช็คก่อนว่าต้องทำไหม (MySQL 8 ไม่มี ADD COLUMN / DROP INDEX IF EXISTS)

-- 1) resume_chunks.user_id เคยเป็น UNIQUE (005) → ผู้ใช้มี chunk ได้แถวเดียว
--    FK ยังใช้ idx_resume_chunks_user_id ได้
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resume_chunks'
      AND INDEX_NAME = 'user_id') > 0,
  'ALTER TABLE resume_chunks DROP INDEX user_id',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) job id ของ BullMQ ที่กำลังประมวลผล (worker ใช้กัน job ซ้ำ / stale)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resume_analysis_runs'
      AND COLUMN_NAME = 'processing_job_id') = 0,
  'ALTER TABLE resume_analysis_runs ADD COLUMN processing_job_id VARCHAR(255) NULL AFTER attempt_count',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) index จาก 012 (DB dev ไม่เคยรัน)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resume_analysis_runs'
      AND INDEX_NAME = 'idx_analysis_runs_history') = 0,
  'CREATE INDEX idx_analysis_runs_history ON resume_analysis_runs (resume_id, user_id, created_at DESC, id DESC)',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'resume_analysis_runs'
      AND INDEX_NAME = 'idx_analysis_runs_active') = 0,
  'CREATE INDEX idx_analysis_runs_active ON resume_analysis_runs (resume_id, user_id, status, created_at DESC, id DESC)',
  'DO 0'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
