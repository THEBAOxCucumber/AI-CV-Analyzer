ALTER TABLE resumes
    ADD COLUMN extracted_text LONGTEXT NULL
        AFTER file_size,

    ADD COLUMN page_count INT UNSIGNED NULL
        AFTER extracted_text,

    ADD COLUMN character_count INT UNSIGNED NOT NULL DEFAULT 0
        AFTER page_count,

    ADD COLUMN extraction_status ENUM(
        'PENDING',
        'COMPLETED',
        'EMPTY',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING'
        AFTER character_count,

    ADD COLUMN extraction_error TEXT NULL
        AFTER extraction_status;