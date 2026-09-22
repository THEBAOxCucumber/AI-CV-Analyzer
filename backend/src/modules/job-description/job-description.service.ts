import {
  createJobDescription,
  type JobDescriptionRecord,
} from "./job-description.repository.js";

export interface CreateJobDescriptionServiceInput {
  userId: number;
  title?: string;
  company?: string;
  description: string;
}

export async function createJobDescriptionForUser(
  input: CreateJobDescriptionServiceInput,
): Promise<JobDescriptionRecord> {
  return createJobDescription({
    userId: input.userId,
    title: input.title,
    company: input.company,
    description: input.description,
  });
}