CREATE TABLE resume_analysis_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    resume_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,

    job_description_id BIGINT UNSIGNED NULL,

    analysis_type ENUM(
        'BASE',
        'JOB_MATCH',
        'COMBINED'
    ) NOT NULL DEFAULT 'BASE',

    status ENUM(
        'PENDING',
        'QUEUED',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING',

    base_resume_score INT NULL,
    job_match_score INT NULL,

    contact_information_score INT NULL,
    professional_summary_score INT NULL,
    skills_score INT NULL,
    experience_score INT NULL,
    projects_score INT NULL,
    education_score INT NULL,
    readability_score INT NULL,

    matched_skills JSON NULL,
    missing_skills JSON NULL,
    keyword_matches JSON NULL,

    summary TEXT NULL,

    strengths JSON NULL,
    weaknesses JSON NULL,
    recommendations JSON NULL,

    model VARCHAR(100) NULL,
    prompt_version VARCHAR(100) NOT NULL,

    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,

    error_code VARCHAR(100) NULL,
    error_message TEXT NULL,

    queued_at DATETIME NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    failed_at DATETIME NULL,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_analysis_runs_resume
        FOREIGN KEY (resume_id)
        REFERENCES resumes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_analysis_runs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_analysis_runs_job_description
        FOREIGN KEY (job_description_id)
        REFERENCES job_descriptions(id)
        ON DELETE SET NULL,

    INDEX idx_analysis_runs_resume_id (resume_id),
    INDEX idx_analysis_runs_user_id (user_id),
    INDEX idx_analysis_runs_job_description_id (
        job_description_id
    ),
    INDEX idx_analysis_runs_status (status),
    INDEX idx_analysis_runs_created_at (created_at),

    INDEX idx_analysis_runs_resume_history (
        resume_id,
        user_id,
        created_at
    )
);