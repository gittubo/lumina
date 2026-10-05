import mammoth from 'mammoth';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_CHARS = 60_000;

/** The resume as Claude will receive it: a PDF document block, or plain text. */
export type ResumeContent =
  | { kind: 'pdf'; base64: string; fileName: string }
  | { kind: 'text'; text: string; fileName?: string };

export class InputError extends Error {}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function checkTextLength(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 100) {
    throw new InputError('The resume text is too short to analyze (need at least 100 characters).');
  }
  if (trimmed.length > MAX_TEXT_CHARS) {
    throw new InputError(`The resume text is too long (max ${MAX_TEXT_CHARS.toLocaleString()} characters).`);
  }
  return trimmed;
}

/**
 * Turns an uploaded file into content Claude can read. PDFs are passed
 * through untouched (Claude reads PDFs natively, including layout), DOCX is
 * converted to plain text, and TXT/MD are read as UTF-8.
 */
export async function extractFromFile(file: File): Promise<ResumeContent> {
  if (file.size === 0) throw new InputError('The uploaded file is empty.');
  if (file.size > MAX_FILE_BYTES) throw new InputError('The file is larger than 5 MB.');

  const ext = extensionOf(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (ext === 'pdf' || file.type === 'application/pdf') {
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new InputError('The file does not look like a valid PDF.');
    }
    return { kind: 'pdf', base64: buffer.toString('base64'), fileName: file.name };
  }

  if (ext === 'docx' || file.type === DOCX_MIME) {
    let text: string;
    try {
      ({ value: text } = await mammoth.extractRawText({ buffer }));
    } catch {
      throw new InputError('Could not read the Word document. Try saving it as PDF.');
    }
    return { kind: 'text', text: checkTextLength(text), fileName: file.name };
  }

  if (ext === 'txt' || ext === 'md' || file.type.startsWith('text/')) {
    return { kind: 'text', text: checkTextLength(buffer.toString('utf8')), fileName: file.name };
  }

  throw new InputError('Unsupported file type. Upload a PDF, DOCX, TXT or MD file.');
}

export function extractFromText(text: string): ResumeContent {
  return { kind: 'text', text: checkTextLength(text) };
}
