import {
  resumeAnalysisQueue,
} from "./resume-analysis.queue.js";

import type {
  ResumeAnalysisRunRecord,
} from "./resume-analysis-run.types.js";

export async function enqueueResumeAnalysis(
  analysisRun: ResumeAnalysisRunRecord,
): Promise<void> {
  console.log(
    "Enqueue resume analysis:",
    {
      analysisRunId: analysisRun.id,
      resumeId: analysisRun.resumeId,
      userId: analysisRun.userId,
      analysisType:
        analysisRun.analysisType,
    },
  );

  const job =
    await resumeAnalysisQueue.add(
      "analyze-resume",
      {
        analysisRunId:
          analysisRun.id,
        resumeId:
          analysisRun.resumeId,
        userId:
          analysisRun.userId,
        jobDescriptionId:
          analysisRun.jobDescriptionId,
        analysisType:
          analysisRun.analysisType,
        promptVersion:
          analysisRun.promptVersion
          ,
      },
      {
        jobId:
          `analysis-${analysisRun.id}`,
      },
    );

  console.log(
    "Resume analysis queued:",
    {
      jobId: job.id,
      queueName:
        resumeAnalysisQueue.name,
    },
  );

  console.log(
  "Enqueue resume analysis:",
  {
    analysisRunId: analysisRun.id,
    resumeId: analysisRun.resumeId,
    userId: analysisRun.userId,
    analysisType:
      analysisRun.analysisType,
    promptVersion:
      analysisRun.promptVersion,
  },
);
}