import { z } from "zod";

const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(10_000)
  .default(1);

const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20);

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const listAnalysesQuerySchema = z.object({
  status: z
    .enum(["ALL", "ACTIVE", "STUCK", "COMPLETED", "FAILED"])
    .default("ALL"),
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const listAuditLogsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const trendsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((value) => value === 7 || value === 30, "days ต้องเป็น 7 หรือ 30")
    .default(7),
});

export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const promoteAdminBodySchema = z.object({
  email: z
    .string()
    .trim()
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .max(255)
    .transform((value) => value.toLowerCase()),
});

export const changeRoleBodySchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});
