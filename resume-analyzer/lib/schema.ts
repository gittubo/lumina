import { z } from 'zod';

/**
 * The shape Claude must return. It is sent to the API as a structured-output
 * JSON schema, so the response is guaranteed to parse into `ResumeAnalysis`.
 */

// A factory (not a shared constant) so each score keeps its own description in the JSON schema.
const score = (what = 'Score') => z.number().describe(`${what}: an integer from 0 to 100`);

export const SectionFeedbackSchema = z.object({
  name: z.string().describe('Resume section, e.g. "Summary", "Experience", "Education", "Skills"'),
  score: score('Section quality'),
  feedback: z.string().describe('One or two sentences assessing this section'),
  suggestions: z.array(z.string()).describe('Concrete, actionable improvements for this section'),
});

export const AtsIssueSchema = z.object({
  severity: z.enum(['high', 'medium', 'low']),
  issue: z.string().describe('What would trip an applicant tracking system'),
  fix: z.string().describe('How to fix it'),
});

export const JobMatchSchema = z.object({
  matchScore: score('How well the resume fits the job description'),
  verdict: z.string().describe('One-sentence summary of the fit'),
  matchedKeywords: z.array(z.string()).describe('Important job-description skills/keywords the resume already shows'),
  missingKeywords: z.array(z.string()).describe('Important job-description skills/keywords absent from the resume'),
  tailoringTips: z.array(z.string()).describe('Specific edits that would make the resume fit this job better'),
});

export const RewriteSchema = z.object({
  original: z.string().describe('A bullet point or sentence quoted verbatim from the resume'),
  improved: z.string().describe('The rewritten version. Never invent metrics: use a placeholder like [X%] where a number is needed'),
  reason: z.string().describe('Why the rewrite is stronger'),
});

export const ResumeAnalysisSchema = z.object({
  candidateName: z.string().nullable().describe('Candidate name if present, else null'),
  targetRole: z.string().describe('The role this resume appears aimed at (or the job description role if provided)'),
  overallScore: score('Overall resume quality'),
  summary: z.string().describe('Two to three sentence overall assessment'),
  categoryScores: z.object({
    impact: score('Achievements and quantified results'),
    clarity: score('Concise, readable writing'),
    structure: score('Layout, ordering and section completeness'),
    skills: score('Relevance and presentation of skills'),
  }),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  sections: z.array(SectionFeedbackSchema),
  ats: z.object({
    score: score('How cleanly an ATS would parse the resume'),
    issues: z.array(AtsIssueSchema),
  }),
  jobMatch: JobMatchSchema.nullable().describe('Null when no job description was provided'),
  rewrites: z.array(RewriteSchema).describe('Three to six of the weakest bullet points, rewritten'),
});

export type ResumeAnalysis = z.infer<typeof ResumeAnalysisSchema>;
export type AtsIssue = z.infer<typeof AtsIssueSchema>;
