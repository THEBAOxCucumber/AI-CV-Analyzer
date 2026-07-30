CREATE TABLE job_descriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NOT NULL,

    title VARCHAR(255) NULL,
    company VARCHAR(255) NULL,

    description LONGTEXT NOT NULL,

    created_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_job_descriptions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_job_descriptions_user_id (user_id),
    INDEX idx_job_descriptions_created_at (created_at)
);