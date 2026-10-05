# AI Resume Analyzer

A standalone Next.js app that analyzes resumes with Claude. It's separate from the main Lumina platform: it has its own dependencies and needs no database, Redis or login.

## Features

- **Score and feedback**: an overall score, four category scores (impact, clarity, structure, skills), strengths and weaknesses, and section-by-section suggestions
- **Job description match**: paste a job posting to get a match score, matched and missing keywords, and tailoring tips
- **ATS check**: formatting and keyword issues that trip applicant tracking systems, ranked by severity, each with a fix
- **Rewrite suggestions**: the weakest bullet points rewritten with a copy button. Claude never invents numbers. It inserts placeholders like `[X%]` for you to fill in.

Accepts **PDF**, **DOCX**, **TXT** and **MD** uploads (up to 5 MB), or pasted text.

## How it works

```
Browser ──multipart──▶ POST /api/analyze ──▶ Claude (structured output) ──▶ JSON ──▶ results dashboard
```

| File | Role |
|---|---|
| `app/page.tsx`, `components/` | Upload form and results dashboard (React + Tailwind) |
| `app/api/analyze/route.ts` | Validates input, rate-limits per IP, maps errors to HTTP responses |
| `lib/extract.ts` | Sends PDFs to Claude as-is (it reads them natively, layout included); converts DOCX to text with `mammoth` |
| `lib/analyze.ts` | Calls Claude through `@anthropic-ai/sdk` with a structured-output schema |
| `lib/schema.ts` | Zod schema for the analysis. Claude's response is constrained to it. |

The Claude request uses:
- model `claude-opus-5-5` (override with `ANTHROPIC_MODEL`) at `medium` effort
- **structured outputs**, so the response always parses into the typed `ResumeAnalysis` shape
- streaming, to avoid HTTP timeouts on long documents
- server-side **refusal fallbacks** (`fallbacks: "default"`), so a request declined by a safety classifier is retried on a recommended fallback model instead of failing

Resumes go to the Anthropic API for analysis. This app doesn't store them.

## Getting started

```bash
cd resume-analyzer
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3100
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — | API key from https://console.anthropic.com |
| `ANTHROPIC_MODEL` | no | `claude-opus-5-5` | Claude model to use |
| `RATE_LIMIT_PER_HOUR` | no | `10` | Analyses allowed per client IP per hour |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3100 |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Jest unit and component tests (Claude is mocked, so no API key is needed) |
| `npm run lint` / `npm run type-check` | ESLint / TypeScript |

## Notes

- The rate limiter is in memory. It resets on restart and isn't shared across instances. Use a shared store such as Redis if you deploy more than one server.
- The API route sets `maxDuration = 300` for platforms such as Vercel. A typical analysis takes 20–60 seconds.
