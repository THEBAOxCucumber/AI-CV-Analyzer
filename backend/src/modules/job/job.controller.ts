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

    const forwardedFor =
        req.headers["x-forwarded-for"];

    const userIp =
        typeof forwardedFor === "string"
            ? forwardedFor
                .split(",")[0]
                .trim()
            : req.ip ||
            req.socket.remoteAddress ||
            "";

    const userAgent =
        req.get("user-agent") ??
        "Unknown";

    const referer =
        req.get("referer") ??
        req.get("origin") ??
        "http://localhost:5173/";

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

function getRequestMetadata(
  req: Request,
) {
  const forwardedFor =
    req.headers["x-forwarded-for"];

  const userIp =
    typeof forwardedFor === "string"
      ? forwardedFor
          .split(",")[0]
          .trim()
      : req.ip ||
        req.socket.remoteAddress ||
        "";

  return {
    userIp,

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