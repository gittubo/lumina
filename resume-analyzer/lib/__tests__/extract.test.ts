/** @jest-environment node */
import { extractFromFile, extractFromText, InputError, MAX_FILE_BYTES } from '../extract';

const longText = 'Jane Doe — Software Engineer. '.repeat(10);

describe('extractFromText', () => {
  it('trims and returns pasted text', () => {
    expect(extractFromText(`  ${longText}  `)).toEqual({ kind: 'text', text: longText.trim() });
  });

  it('rejects text that is too short', () => {
    expect(() => extractFromText('too short')).toThrow(InputError);
  });
});

describe('extractFromFile', () => {
  it('passes PDFs through as base64', async () => {
    const pdf = new File(['%PDF-1.7 fake body'], 'cv.pdf', { type: 'application/pdf' });
    const result = await extractFromFile(pdf);
    expect(result.kind).toBe('pdf');
    if (result.kind === 'pdf') {
      expect(Buffer.from(result.base64, 'base64').toString()).toBe('%PDF-1.7 fake body');
      expect(result.fileName).toBe('cv.pdf');
    }
  });

  it('rejects files named .pdf that are not PDFs', async () => {
    const fake = new File(['hello'], 'cv.pdf', { type: 'application/pdf' });
    await expect(extractFromFile(fake)).rejects.toThrow('valid PDF');
  });

  it('reads plain text files', async () => {
    const txt = new File([longText], 'cv.txt', { type: 'text/plain' });
    await expect(extractFromFile(txt)).resolves.toMatchObject({ kind: 'text', text: longText.trim() });
  });

  it('reports unreadable Word documents', async () => {
    const docx = new File(['not a zip'], 'cv.docx');
    await expect(extractFromFile(docx)).rejects.toThrow('Word document');
  });

  it('rejects unsupported, empty and oversized files', async () => {
    await expect(extractFromFile(new File(['x'], 'cv.png', { type: 'image/png' }))).rejects.toThrow('Unsupported');
    await expect(extractFromFile(new File([], 'cv.pdf'))).rejects.toThrow('empty');
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'cv.pdf');
    await expect(extractFromFile(big)).rejects.toThrow('5 MB');
  });
});
