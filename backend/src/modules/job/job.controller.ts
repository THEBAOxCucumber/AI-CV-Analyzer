import type {
    Request,
    Response,
} from "express";

import {
    importCareerjetJob,
    searchJobs,
} from "./job.service.js";



export async function searchJobsController(
    req: Request,
    res: Response,
): Promise<void> {
    const {
        keywords,
        location,
        page,
        pageSize,
    } = req.query as unknown as {
        keywords: string;
        location?: string;
        page: number;
        pageSize: number;
    };

    const {
        userIp,
        userAgent,
        referer,
    } = getRequestMetadata(req);

    const result =
        await searchJobs({
            keywords,
            location,
            page,
            pageSize,
            userIp,
            userAgent,
            referer,
        });

    res.status(200).json({
        success: true,
        message:
            "Jobs retrieved successfully",
        data: result,
    });
}

/*
 * IP ผู้ใช้สำหรับ Careerjet (ต้องส่ง user_ip)
 * - ใช้ req.ip (ผ่าน trust proxy แล้ว) ไม่อ่าน X-Forwarded-For ดิบ → ปลอมไม่ได้
 * - Careerjet ไม่ตอบเลยถ้า user_ip = "::1" → แปลง loopback/IPv4-mapped เป็น IPv4
 */
function getCareerjetUserIp(
  req: Request,
): string {
  const ip =
    req.ip ||
    req.socket.remoteAddress ||
    "";

  if (!ip || ip === "::1") {
    return "127.0.0.1";
  }

  if (ip.startsWith("::ffff:")) {
    return ip.slice("::ffff:".length);
  }

  return ip;
}

function getRequestMetadata(
  req: Request,
) {
  return {
    userIp:
      getCareerjetUserIp(req),

    userAgent:
      req.get("user-agent") ??
      "Unknown",

    referer:
      req.get("referer") ??
      req.get("origin") ??
      "http://localhost:5173/",
  };
}

export async function importJobController(
  req: Request,
  res: Response,
): Promise<void> {
  const userId =
    req.user!.id;

  const {
  externalJobId,
  title,
  company,
  description,
  location,
  salary,
  postedAt,
  sourceUrl,
  source,
} = req.body;

  const metadata =
    getRequestMetadata(req);

  const jobDescription =
  await importCareerjetJob({
    userId,
    externalJobId,
    title,
    company,
    description,
    location,
    salary,
    postedAt,
    sourceUrl,
    source,
  });

  res.status(200).json({
    success: true,
    message:
      "Job imported successfully",
    data: {
      jobDescription,
    },
  });
}