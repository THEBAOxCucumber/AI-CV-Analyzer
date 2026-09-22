import {
  searchCareerjetJobs,
} from "./providers/careerjet.provider.js";

import {
  createExternalJobDescription,
  findJobDescriptionByExternalId,
} from "../job-description/job-description.repository.js";

import {
  createHash,
} from "node:crypto";

export interface SearchJobsInput {
  keywords: string;
  location?: string;
  page?: number;
  pageSize?: number;

  userIp: string;
  userAgent: string;
  referer: string;
}

export async function searchJobs(
  input: SearchJobsInput,
) {
  return searchCareerjetJobs({
    keywords:
      input.keywords,

    location:
      input.location ??
      "Thailand",

    page:
      input.page ?? 1,

    pageSize:
      input.pageSize ?? 20,

    userIp:
      input.userIp,

    userAgent:
      input.userAgent,

    referer:
      input.referer,
  });
}

export interface ImportCareerjetJobInput {
  userId: number;

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

function createCareerjetJobId(
  sourceUrl: string,
): string {
  return createHash("sha256")
    .update(sourceUrl)
    .digest("hex");
}

export async function importCareerjetJob(
  input: ImportCareerjetJobInput,
) {
  const expectedExternalJobId =
    createCareerjetJobId(
      input.sourceUrl,
    );

  if (
    expectedExternalJobId !==
    input.externalJobId
  ) {
    throw new Error(
      "Invalid Careerjet job identity",
    );
  }

  const existing =
    await findJobDescriptionByExternalId(
      input.userId,
      "CAREERJET",
      input.externalJobId,
    );

  if (existing) {
    return existing;
  }

  return createExternalJobDescription({
    userId:
      input.userId,

    title:
      input.title,

    company:
      input.company,

    description:
      input.description,

    source:
      "CAREERJET",

    externalJobId:
      input.externalJobId,

    sourceUrl:
      input.sourceUrl,

    location:
      input.location,

    employmentType:
      null,

    salary:
      input.salary,

    postedAt:
      input.postedAt
        ? new Date(input.postedAt)
        : null,
  });
}