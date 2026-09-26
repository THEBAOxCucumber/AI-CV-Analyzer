-- Settings (Figma): Location, Headline, Last login

ALTER TABLE user_profiles
  ADD COLUMN location VARCHAR(255) NULL AFTER phone,
  ADD COLUMN headline VARCHAR(255) NULL AFTER location;

ALTER TABLE users
  ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL AFTER role;
