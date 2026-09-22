import { env } from "../config/env.js";

const searches = [
  "Frontend Developer",
  "Software Developer",
  "React",
  "UX UI Designer",
];

async function searchJobs(
  keywords: string,
) {
  const params =
    new URLSearchParams({
      locale_code:
        env.careerjet.localeCode,
      keywords,
      location: "Thailand",
      page: "1",
      page_size: "10",

      // Local connection test only
      user_ip: "127.0.0.1",
      user_agent:
        "AI-CV-Analyzer-Development-Test",
    });

  const credentials =
    Buffer.from(
      `${env.careerjet.apiKey}:`,
    ).toString("base64");

  const response =
    await fetch(
      `${env.careerjet.baseUrl}/v4/query?${params.toString()}`,
      {
        headers: {
          Authorization:
            `Basic ${credentials}`,
          Referer:
            "http://localhost:5173/",
        },
      },
    );

  const data =
    (await response.json()) as {
      type?: string;
      hits?: number;
      jobs?: Array<{
        title?: string;
        company?: string;
        locations?: string;
        salary?: string;
        date?: string;
        url?: string;
      }>;
      error?: string;
    };

  console.log(
    "\n==============================",
  );
  console.log(
    `${keywords} | Thailand`,
  );
  console.log(
    `HTTP: ${response.status}`,
  );
  console.log(
    `Hits: ${data.hits ?? 0}`,
  );

  console.table(
    (data.jobs ?? [])
      .slice(0, 5)
      .map((job) => ({
        title: job.title ?? "",
        company:
          job.company ?? "",
        location:
          job.locations ?? "",
        salary:
          job.salary ?? "",
      })),
  );
}

async function main() {
  for (const keywords of searches) {
    await searchJobs(keywords);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});