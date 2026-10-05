/** @jest-environment node */
import type Anthropic from '@anthropic-ai/sdk';
import { AnalysisError, analyzeResume, buildUserContent } from '../analyze';
import { sampleAnalysis } from '../__fixtures__/analysis';

function mockClient(message: Record<string, unknown>) {
  const stream = jest.fn().mockReturnValue({ finalMessage: async () => message });
  return { client: { beta: { messages: { stream } } } as unknown as Anthropic, stream };
}

const resume = { kind: 'text' as const, text: 'Jane Doe resume text' };

describe('buildUserContent', () => {
  it('sends PDFs as document blocks', () => {
    const content = buildUserContent({ resume: { kind: 'pdf', base64: 'QUJD', fileName: 'cv.pdf' } });
    expect(content[0]).toMatchObject({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' },
    });
  });

  it('wraps text and includes the job description only when provided', () => {
    const without = buildUserContent({ resume, jobDescription: '   ' });
    expect(without).toHaveLength(2);
    expect(JSON.stringify(without)).toContain('set jobMatch to null');

    const withJd = buildUserContent({ resume, jobDescription: 'Kubernetes engineer' });
    expect(withJd).toHaveLength(3);
    expect(withJd[1]).toEqual({ type: 'text', text: '<job_description>\nKubernetes engineer\n</job_description>' });
  });
});

describe('analyzeResume', () => {
  it('requests structured output with fallbacks and returns the parsed analysis', async () => {
    const { client, stream } = mockClient({ stop_reason: 'end_turn', parsed_output: sampleAnalysis });
    await expect(analyzeResume({ resume }, { client })).resolves.toEqual(sampleAnalysis);

    const params = stream.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toContain('server-side-fallback-2026-07-01');
    expect(params.output_config.format.type).toBe('json_schema');
  });

  it('clamps out-of-range scores', async () => {
    const wild = { ...sampleAnalysis, overallScore: 140, ats: { ...sampleAnalysis.ats, score: -5 } };
    const { client } = mockClient({ stop_reason: 'end_turn', parsed_output: wild });
    const result = await analyzeResume({ resume }, { client });
    expect(result.overallScore).toBe(100);
    expect(result.ats.score).toBe(0);
  });

  it.each([
    ['refusal', 'declined'],
    ['max_tokens', 'cut off'],
  ])('raises an AnalysisError on stop_reason %s', async (stop_reason, text) => {
    const { client } = mockClient({ stop_reason, parsed_output: null });
    await expect(analyzeResume({ resume }, { client })).rejects.toThrow(text);
  });

  it('raises when the output could not be parsed', async () => {
    const { client } = mockClient({ stop_reason: 'end_turn', parsed_output: null });
    await expect(analyzeResume({ resume }, { client })).rejects.toBeInstanceOf(AnalysisError);
  });
});
