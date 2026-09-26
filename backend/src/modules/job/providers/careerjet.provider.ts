import { env } from "../../../config/env.js";
import { AppError } from "../../../errors/app-error.js";

import {
  createHash,
} from "node:crypto";

const CAREERJET_TIMEOUT_MS = 15_000;

interface CareerjetApiJob {
  title?: string;
  company?: string;
  description?: string;
  locations?: string;
  salary?: string;
  date?: string;
  url?: string;
}

interface CareerjetApiResponse {
  type?: string;
  hits?: number;
  pages?: number;
  jobs?: CareerjetApiJob[];
  error?: string;
}

function createCareerjetJobId(
  sourceUrl: string,
): string {
  return createHash("sha256")
    .update(sourceUrl)
    .digest("hex");
}

export interface CareerjetJob {
  externalJobId: string;
  title: string;
  company: string | null;
  description: string;
  location: string;
  salary: string | null;
  postedAt: string | null;
  sourceUrl: string;
  source: "CAREERJET";
}

export interface SearchCareerjetJobsInput {
  keywords: string;
  location?: string;
  page?: number;
  pageSize?: number;

  userIp: string;
  userAgent: string;
  referer: string;
}

export interface SearchCareerjetJobsResult {
  totalCount: number;
  pages: number;
  jobs: CareerjetJob[];
}

export async function searchCareerjetJobs(
  input: SearchCareerjetJobsInput,
): Promise<SearchCareerjetJobsResult> {
  const params =
    new URLSearchParams({
      locale_code:
        env.careerjet.localeCode,

      keywords:
        input.keywords,

      location:
        input.location ?? "Thailand",

      page:
        String(input.page ?? 1),

      page_size:
        String(input.pageSize ?? 20),

      user_ip:
        input.userIp,

      user_agent:
        input.userAgent,
    });

  const credentials =
    Buffer.from(
      `${env.careerjet.apiKey}:`,
    ).toString("base64");

  let response: Response;

  try {
    response =
      await fetch(
        `${env.careerjet.baseUrl}/v4/query?${params.toString()}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Basic ${credentials}`,

            Referer:
              input.referer,
          },

          signal: AbortSignal.timeout(
            CAREERJET_TIMEOUT_MS,
          ),
        },
      );
  } catch (error) {
    /*
     * ต่อไม่ติด / timeout
     * log ดิบไว้ฝั่ง server เท่านั้น
     */
    console.error(
      "Careerjet request failed:",
      error,
    );

    throw new AppError(
      "ไม่สามารถเชื่อมต่อบริการค้นหางานได้ กรุณาลองใหม่อีกครั้ง",
      503,
      "CAREERJET_UNAVAILABLE",
    );
  }

  let data: CareerjetApiResponse | null =
    null;

  try {
    data =
      (await response.json()) as CareerjetApiResponse;
  } catch {
    /*
     * เช่น HTML error page
     */
  }

  if (!response.ok || !data) {
    console.error(
      "Careerjet API error:",
      {
        status:
          response.status,
        error:
          data?.error,
      },
    );

    throw new AppError(
      "บริการค้นหางานไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง",
      response.status >= 500 || !data
        ? 503
        : 502,
      "CAREERJET_REQUEST_FAILED",
    );
  }

  return {
    totalCount:
      data.hits ?? 0,

    pages:
      data.pages ?? 0,

    jobs:
  (data.jobs ?? [])
    .filter(
      (job) =>
        Boolean(job.url?.trim()),
    )
    .map((job) => ({
      externalJobId:
        createCareerjetJobId(
          job.url!,
        ),

      title:
        job.title ??
        "Untitled Job",

      company:
        job.company?.trim() ||
        null,

      description:
        job.description ?? "",

      location:
        job.locations ?? "",

      salary:
        job.salary?.trim() ||
        null,

      postedAt:
        job.date ?? null,

      sourceUrl:
        job.url!,

      source:
        "CAREERJET" as const,
    })),
  };
}

