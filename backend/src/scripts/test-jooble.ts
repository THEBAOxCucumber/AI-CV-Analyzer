import {
  searchJoobleJobs,
} from "../modules/job/providers/jooble.provider.js";

const searches = [
  { keywords: "", location: "Thailand" },
  { keywords: "", location: "Bangkok" },
  { keywords: "developer", location: "Thailand" },
  { keywords: "developer", location: "Bangkok" },
  { keywords: "software engineer", location: "Bangkok" },
  { keywords: "programmer", location: "Bangkok" },
  { keywords: "นักพัฒนา", location: "กรุงเทพมหานคร" },
];

for (const search of searches) {
  const response = await fetch(
    `https://jooble.org/api/${process.env.JOOBLE_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keywords: search.keywords,
        location: search.location,
        page: 1,
      }),
    }
  );

  const data = await response.json();

  console.log("\n============================");
  console.log(search);
  console.log("Status:", response.status);
  console.log("Total:", data.totalCount);
  console.log("Returned:", data.jobs?.length ?? 0);

  console.table(
    (data.jobs ?? []).slice(0, 10).map((job: any) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      updated: job.updated,
      link: job.link,
    }))
  );
}

async function main() {
  for (const search of searches) {
    const result =
      await searchJoobleJobs({
        ...search,
        page: 1,
      });

    console.log("\n==============================");
    console.log(
      `${search.keywords} | ${search.location}`,
    );
    console.log(
      `Total: ${result.totalCount}`,
    );

    console.table(
      result.jobs
        .slice(0, 5)
        .map((job) => ({
          title: job.title,
          company: job.company,
          location: job.location,
          type: job.type,
        })),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});