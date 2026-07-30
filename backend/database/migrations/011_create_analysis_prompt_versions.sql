CREATE TABLE analysis_prompt_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    version VARCHAR(100) NOT NULL UNIQUE,

    analysis_type ENUM(
        'BASE',
        'JOB_MATCH',
        'COMBINED'
    ) NOT NULL,

    system_prompt LONGTEXT NOT NULL,
    user_prompt_template LONGTEXT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_prompt_versions_type (
        analysis_type
    ),

    INDEX idx_prompt_versions_active (
        is_active
    )
);