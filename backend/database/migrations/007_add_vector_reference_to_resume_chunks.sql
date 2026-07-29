ALTER TABLE resume_chunks
    ADD COLUMN vector_point_id VARCHAR(100) NULL
        AFTER embedding_status,

    ADD COLUMN embedding_model VARCHAR(100) NULL
        AFTER vector_point_id,

    ADD COLUMN embedding_dimensions INT UNSIGNED NULL
        AFTER embedding_model,

    ADD COLUMN embedding_error TEXT NULL
        AFTER embedding_dimensions,

    ADD COLUMN embedded_at TIMESTAMP NULL
        AFTER embedding_error,

    ADD UNIQUE INDEX uq_resume_chunks_vector_point_id (
        vector_point_id
    );