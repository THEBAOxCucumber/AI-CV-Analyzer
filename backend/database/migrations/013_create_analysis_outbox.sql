CREATE TABLE analysis_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  analysis_run_id BIGINT UNSIGNED NOT NULL,

  event_type VARCHAR(100) NOT NULL,

  status ENUM(
    'PENDING',
    'DISPATCHED'
  ) NOT NULL DEFAULT 'PENDING',

  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,

  last_error TEXT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  dispatched_at TIMESTAMP NULL DEFAULT NULL,

  PRIMARY KEY (id),

  UNIQUE KEY uq_analysis_outbox_run_event (
    analysis_run_id,
    event_type
  ),

  KEY idx_analysis_outbox_pending (
    status,
    created_at,
    id
  ),

  CONSTRAINT fk_analysis_outbox_analysis_run
    FOREIGN KEY (analysis_run_id)
    REFERENCES resume_analysis_runs(id)
    ON DELETE CASCADE
);