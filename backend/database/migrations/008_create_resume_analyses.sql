CREATE TABLE resume_analyses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    resume_id INT UNSIGNED NOT NULL UNIQUE,
    user_id INT UNSIGNED NOT NULL,

    status ENUM(
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING',

    overall_score INT NULL,

    contact_information_score INT NULL,
    professional_summary_score INT NULL,
    skills_score INT NULL,
    experience_score INT NULL,
    projects_score INT NULL,
    education_score INT NULL,
    readability_score INT NULL,
    job_relevance_score INT NULL,

    summary TEXT NULL,

    strengths JSON NULL,
    weaknesses JSON NULL,
    recommendations JSON NULL,

    model VARCHAR(100) NULL,
    prompt_version VARCHAR(100) NULL,

    error_message TEXT NULL,
    analyzed_at DATETIME NULL,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_resume_analyses_resume
        FOREIGN KEY (resume_id)
        REFERENCES resumes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_resume_analyses_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_resume_analyses_resume_id (resume_id),
    INDEX idx_resume_analyses_user_id (user_id),
    INDEX idx_resume_analyses_status (status)
);