CREATE INDEX idx_analysis_runs_history
ON resume_analysis_runs (
  resume_id,
  user_id,
  created_at DESC,
  id DESC
);

CREATE INDEX idx_analysis_runs_active
ON resume_analysis_runs (
  resume_id,
  user_id,
  status,
  created_at DESC,
  id DESC
);