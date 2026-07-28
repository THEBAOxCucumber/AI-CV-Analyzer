ALTER TABLE resumes
    ADD COLUMN chunking_status ENUM(
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING'
        AFTER extraction_error,

    ADD COLUMN chunk_count INT UNSIGNED NOT NULL DEFAULT 0
        AFTER chunking_status,

    ADD COLUMN chunking_error TEXT NULL
        AFTER chunk_count;