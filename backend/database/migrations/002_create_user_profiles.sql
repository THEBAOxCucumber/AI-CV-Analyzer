CREATE TABLE user_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL UNIQUE,

    phone VARCHAR(20),

    university VARCHAR(255),

    faculty VARCHAR(255),

    major VARCHAR(255),

    education_level ENUM(
        'HIGH_SCHOOL',
        'VOCATIONAL',
        'BACHELOR',
        'MASTER',
        'DOCTORATE'
    ) DEFAULT 'BACHELOR',

    graduation_year YEAR,

    interested_position VARCHAR(255),

    experience_level ENUM(
        'FRESH_GRADUATE',
        'JUNIOR',
        'MID_LEVEL',
        'SENIOR'
    ) DEFAULT 'FRESH_GRADUATE',

    bio TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_profile_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);