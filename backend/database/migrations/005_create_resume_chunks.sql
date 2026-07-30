CREATE TABLE IF NOT EXISTS resume_chunks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    resume_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL UNIQUE,

    section VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    chunk_index INT UNSIGNED NOT NULL,

    content TEXT NOT NULL,
    character_count INT UNSIGNED NOT NULL,

    embedding_status ENUM(
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_resume_chunks_resume
        FOREIGN KEY (resume_id)
        REFERENCES resumes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_resume_chunks_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_resume_chunk_index
        UNIQUE (resume_id, chunk_index),

    INDEX idx_resume_chunks_resume_id (resume_id),
    INDEX idx_resume_chunks_user_id (user_id),
    INDEX idx_resume_chunks_section (section),
    INDEX idx_resume_chunks_embedding_status (embedding_status)
);