export interface JobDescription {
  id: number
  userId: number
  title: string | null
  company: string | null
  description: string
  createdAt: string
  updatedAt: string
}

export interface CreateJobDescriptionInput {
  title?: string
  company?: string
  description: string
}