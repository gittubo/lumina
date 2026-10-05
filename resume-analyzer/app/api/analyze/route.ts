import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { AnalysisError, analyzeResume } from '@/lib/analyze';
import { extractFromFile, extractFromText, InputError, type ResumeContent } from '@/lib/extract';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_JD_CHARS = 20_000;

function error(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown';
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return error('Too many analyses. Please try again later.', 429, {
      'Retry-After': String(limit.retryAfterSeconds),
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error('Expected multipart form data.', 400);
  }

  const file = form.get('file');
  const resumeText = form.get('resumeText');
  const jobDescription = form.get('jobDescription');

  if (typeof jobDescription === 'string' && jobDescription.length > MAX_JD_CHARS) {
    return error(`The job description is too long (max ${MAX_JD_CHARS.toLocaleString()} characters).`, 400);
  }

  let resume: ResumeContent;
  try {
    if (file instanceof File && file.size > 0) {
      resume = await extractFromFile(file);
    } else if (typeof resumeText === 'string' && resumeText.trim()) {
      resume = extractFromText(resumeText);
    } else {
      return error('Upload a resume file or paste the resume text.', 400);
    }
  } catch (e) {
    if (e instanceof InputError) return error(e.message, 400);
    throw e;
  }

  try {
    const analysis = await analyzeResume(
      { resume, jobDescription: typeof jobDescription === 'string' ? jobDescription : undefined },
      { model: process.env.ANTHROPIC_MODEL || undefined },
    );
    return NextResponse.json({ analysis });
  } catch (e) {
    if (e instanceof AnalysisError) return error(e.message, e.status);
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic authentication failed; check ANTHROPIC_API_KEY');
      return error('The analyzer is not configured correctly.', 500);
    }
    if (e instanceof Anthropic.RateLimitError) return error('The AI service is busy. Please retry shortly.', 503);
    if (e instanceof Anthropic.BadRequestError) {
      console.error('Anthropic rejected the request:', e.message);
      return error('The document could not be processed. Try a different file format.', 400);
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${e.status}:`, e.message);
      return error('The AI service returned an error. Please retry.', 502);
    }
    console.error('Unexpected analysis failure:', e);
    return error('Something went wrong while analyzing the resume.', 500);
  }
}
