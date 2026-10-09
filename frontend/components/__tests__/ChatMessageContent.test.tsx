import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
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

  it('keeps the whole fence label, settings included', () => {
    expect(splitFencedCode('```image style=cinematic aspectRatio=16:9\na fox\n```')).toEqual([
      { kind: 'code', lang: 'image style=cinematic aspectRatio=16:9', value: 'a fox' },
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

  it('leaves markers that do not form a pair on one line as typed', () => {
    const { container } = render(<p>{renderInline('`a\nb` and **c\nd**')}</p>);
    expect(container.querySelector('code, strong')).toBeNull();
    expect(container.textContent).toBe('`a\nb` and **c\nd**');
  });
});

describe('Use this prompt', () => {
  const project = {
    id: 'proj_1',
    title: 'Forest Film',
    description: null,
    userId: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const reply = 'Try:\n```image style=cinematic aspectRatio=16:9\na fox at dawn\n```';

  it('links straight to the chat\'s project with the prompt and settings', () => {
    render(<ChatMessageContent text={reply} target={{ projectId: 'proj_1', projects: [project] }} />);
    const link = screen.getByRole('link', { name: 'Use this prompt' });
    const url = new URL(link.getAttribute('href') ?? '', 'http://x');
    expect(url.pathname).toBe('/dashboard/projects/proj_1');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      use: 'image',
      prompt: 'a fox at dawn',
      style: 'cinematic',
      aspectRatio: '16:9',
    });
    expect(screen.getByText('Image prompt · cinematic · 16:9')).toBeInTheDocument();
  });

  it('asks which project to use when the chat has none', async () => {
    const user = userEvent.setup();
    render(<ChatMessageContent text={reply} target={{ projectId: null, projects: [project] }} />);
    await user.click(screen.getByRole('button', { name: 'Use this prompt' }));
    await user.selectOptions(screen.getByLabelText('Choose a project for this prompt'), 'proj_1');
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/dashboard\/projects\/proj_1\?use=image&prompt=a\+fox\+at\+dawn/));
  });

  it('is hidden on unlabelled blocks and while a reply is streaming', () => {
    const { rerender } = render(
      <ChatMessageContent text={'```\njust code\n```'} target={{ projectId: 'proj_1', projects: [project] }} />
    );
    expect(screen.queryByText('Use this prompt')).toBeNull();
    rerender(<ChatMessageContent text={reply} />);
    expect(screen.queryByText('Use this prompt')).toBeNull();
  });
});
