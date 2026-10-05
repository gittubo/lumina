import { render, screen } from '@testing-library/react';
import ChatMessageContent, { splitFencedCode, renderInline } from '../ChatMessageContent';

describe('splitFencedCode', () => {
  it('returns plain text unchanged', () => {
    expect(splitFencedCode('Just some ideas.')).toEqual([{ kind: 'text', value: 'Just some ideas.' }]);
  });

  it('splits out fenced code blocks with their language', () => {
    const text = 'Try this:\n```image\na fox in the snow, golden hour\n```\nWant variations?';
    expect(splitFencedCode(text)).toEqual([
      { kind: 'text', value: 'Try this:\n' },
      { kind: 'code', lang: 'image', value: 'a fox in the snow, golden hour' },
      { kind: 'text', value: '\nWant variations?' },
    ]);
  });

  it('treats an unclosed fence (mid-stream) as code', () => {
    expect(splitFencedCode('Here:\n```\na fox in')).toEqual([
      { kind: 'text', value: 'Here:\n' },
      { kind: 'code', lang: '', value: 'a fox in' },
    ]);
  });
});

describe('ChatMessageContent', () => {
  it('renders prompts in a copyable block', () => {
    render(<ChatMessageContent text={'Prompt:\n```\na fox in the snow\n```'} />);
    // getBy* throws if the element is missing, so these double as presence checks.
    expect(screen.getByText('Prompt:').tagName).toBe('P');
    expect(screen.getByText('a fox in the snow').tagName).toBe('CODE');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });
});

describe('renderInline', () => {
  it('renders bold and inline code, leaving other text alone', () => {
    render(<p>{renderInline('Use style **cinematic** and ratio `16:9`, 2 * 3 = 6')}</p>);
    expect(screen.getByText('cinematic').tagName).toBe('STRONG');
    expect(screen.getByText('16:9').tagName).toBe('CODE');
    expect(screen.getByText(/2 \* 3 = 6/)).toBeInTheDocument();
  });
});
