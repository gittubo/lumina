import type { ResumeAnalysis } from '../schema';

export const sampleAnalysis: ResumeAnalysis = {
  candidateName: 'Jane Doe',
  targetRole: 'Senior Backend Engineer',
  overallScore: 72,
  summary: 'Solid backend experience with room to quantify impact.',
  categoryScores: { impact: 60, clarity: 80, structure: 75, skills: 70 },
  strengths: ['Clear progression across three roles'],
  weaknesses: ['Few quantified achievements'],
  sections: [{ name: 'Experience', score: 68, feedback: 'Duties over outcomes.', suggestions: ['Lead with results'] }],
  ats: { score: 85, issues: [{ severity: 'medium', issue: 'Two-column layout', fix: 'Use a single column' }] },
  jobMatch: {
    matchScore: 64,
    verdict: 'Good fit, missing cloud keywords.',
    matchedKeywords: ['Node.js', 'PostgreSQL'],
    missingKeywords: ['Kubernetes'],
    tailoringTips: ['Mention container orchestration work'],
  },
  rewrites: [{ original: 'Worked on APIs', improved: 'Built 12 REST APIs serving [N] requests/day', reason: 'Shows scope' }],
};
