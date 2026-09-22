export interface Job {
  externalJobId: string
  title: string
  company: string | null
  description: string
  location: string
  salary: string | null
  postedAt: string | null
  sourceUrl: string
  source: "CAREERJET"
}

export interface JobSearchResult {
  totalCount: number
  pages: number
  jobs: Job[]
}