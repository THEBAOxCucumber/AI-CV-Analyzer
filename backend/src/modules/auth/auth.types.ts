import type { RowDataPacket } from "mysql2";

export type UserRole = "USER" | "ADMIN";

export interface UserRow extends RowDataPacket {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface PublicUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date | null;
}