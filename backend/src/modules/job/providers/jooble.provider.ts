import { env } from "../../../config/env.js";

export interface JoobleJob {
  id: string;
  title: string;
  location: string;
  snippet: string;
  salary: string | null;
  source: string | null;
  type: string | null;
  link: string;
  company: string | null;
  updated: string | null;
}

interface JoobleApiJob {
  id?: string | number;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
}

interface JoobleApiResponse {
  totalCount?: number;
  jobs?: JoobleApiJob[];
}

export interface SearchJoobleJobsInput {
  keywords: string;
  location?: string;
  page?: number;
}

export interface SearchJoobleJobsResult {
  totalCount: number;
  jobs: JoobleJob[];
}

export async function searchJoobleJobs(
  input: SearchJoobleJobsInput,
): Promise<SearchJoobleJobsResult> {
  const response = await fetch(
  `${env.jooble.baseUrl}/${env.jooble.apiKey}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      keywords: input.keywords,
      location:
        input.location ?? "Thailand",
      page: input.page ?? 1,
    }),
  },
);

  if (!response.ok) {
    throw new Error(
      `Jooble API request failed: ${response.status}`,
    );
  }

  const data =
    (await response.json()) as JoobleApiResponse;

  return {
    totalCount:
      data.totalCount ?? 0,

    jobs: (data.jobs ?? []).map(
      (job) => ({
        id: String(job.id ?? ""),
        title:
          job.title ?? "Untitled Job",
        location:
          job.location ?? "",
        snippet:
          job.snippet ?? "",
        salary:
          job.salary ?? null,
        source:
          job.source ?? null,
        type:
          job.type ?? null,
        link:
          job.link ?? "",
        company:
          job.company ?? null,
        updated:
          job.updated ?? null,
      }),
    ),
  };
}