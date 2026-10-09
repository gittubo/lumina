import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConversationResponse, ConversationWithMessages, ChatMessageResponse } from '../types/chat';

const prisma = new PrismaClient();

export const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-opus-5-5';
const MAX_TOKENS = 16000;
const TITLE_MAX_LENGTH = 60;
// How many of a project's most recent generation prompts the assistant sees.
const PROJECT_CONTEXT_GENERATIONS = 15;

// Kept byte-for-byte stable across requests so it stays in the prompt cache —
// anything per-user or per-project goes in a separate system block after it.
const SYSTEM_PROMPT = `You are the Lumina Assistant, the creative partner built into LUMINA, an AI creative platform where people generate images, video, 3D models, and voice audio inside projects.

What LUMINA can generate:
- Images with Stability AI (Stable Diffusion XL). Options: style (photorealistic, anime, digital-art, cinematic, fantasy-art, low-poly), aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4), and a negative prompt.
- Video with Runway (Gen-4.5). Options: ratio (1280:720, 720:1280, 1920:1080) and duration (5 or 10 seconds), optionally starting from a source image URL.
- 3D models with Meshy. Options: triangle or quad topology, optional PBR textures.
- Speech with Eleven Labs. The prompt is the exact text to be spoken; the user picks a voice.

How to help:
- Brainstorm concepts, then turn them into concrete, ready-to-use prompts for the right generator.
- Put each final prompt in its own fenced code block, with nothing inside the block except the prompt itself. Label the block's opening fence with the generator and the settings you recommend, because LUMINA reads that label to fill in its generate form when the user clicks "Use this prompt". The label format is the generator (image, video, 3d, or audio) followed by key=value settings, using only these keys and values:
  - image: style=photorealistic|anime|digital-art|cinematic|fantasy-art|low-poly, aspectRatio=1:1|16:9|9:16|4:3|3:4, negativePrompt="comma, separated, things to avoid" (quoted)
  - video: ratio=1280:720|720:1280|1920:1080, duration=5|10
  - 3d: topology=triangle|quad, pbr=true|false
  - audio: voice=Rachel|Domi|Bella|Antoni
  For example, an image prompt's block opens with: \`\`\`image style=cinematic aspectRatio=16:9 negativePrompt="text, watermark"
  Leave out any setting you have no opinion on. Use a plain unlabelled fence for anything that isn't a generator prompt.
- Good image and video prompts name the subject, setting, composition, lighting, mood, and medium or camera details. Video prompts should also describe motion. 3D prompts should describe a single object clearly, without background or scene. Speech prompts are the script itself, so write natural spoken language.
- When the user's goal is vague, offer two or three distinct directions rather than asking many questions up front.
- You cannot start generations yourself; the user runs them from their project page. If asked, say so briefly and give them the prompt to use.
- Keep answers focused and skimmable. Use Markdown sparingly.`;

export class ChatError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ChatError(
        'The Lumina Assistant is not configured (missing ANTHROPIC_API_KEY).',
        503,
        'CHAT_NOT_CONFIGURED'
      );
    }
    client = new Anthropic();
  }
  return client;
}

function makeTitle(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > TITLE_MAX_LENGTH
    ? `${singleLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : singleLine;
}

function toMessageResponse(m: {
  id: string;
  role: string;
  text: string;
  createdAt: Date;
}): ChatMessageResponse {
  return { id: m.id, role: m.role as ChatMessageResponse['role'], text: m.text, createdAt: m.createdAt };
}

async function buildProjectContext(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      generations: {
        orderBy: { createdAt: 'desc' },
        take: PROJECT_CONTEXT_GENERATIONS,
        select: { type: true, prompt: true, status: true },
      },
    },
  });
  if (!project) return null;

  const lines = [
    'The user is working in this LUMINA project. Use it as context for your suggestions.',
    `<project>`,
    `Title: ${project.title}`,
    project.description ? `Description: ${project.description}` : null,
    project.generations.length > 0 ? 'Recent generations (newest first):' : 'No generations yet.',
    ...project.generations.map((g) => `- [${g.type}, ${g.status}] ${g.prompt}`),
    `</project>`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

class ChatService {
  async createConversation(userId: string, projectId?: string): Promise<ConversationResponse> {
    return prisma.conversation.create({
      data: { userId, projectId: projectId ?? null, title: 'New chat' },
    });
  }

  async listConversations(userId: string): Promise<ConversationResponse[]> {
    return prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(id: string, userId: string): Promise<ConversationWithMessages | null> {
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          // Skip `content` (raw API blocks, thinking included) — only the
          // replay in sendMessage needs it.
          select: { id: true, role: true, text: true, createdAt: true },
        },
      },
    });
    if (!conversation) return null;
    const { messages, ...rest } = conversation;
    return { ...rest, messages: messages.map(toMessageResponse) };
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const { count } = await prisma.conversation.deleteMany({ where: { id, userId } });
    return count > 0;
  }

  /**
   * Sends the user's message to Claude with the full conversation history,
   * calling `onText` with each streamed text fragment. Both turns are saved
   * only once the reply completes, so an aborted or failed request leaves the
   * conversation unchanged and can simply be retried.
   */
  async sendMessage(
    conversationId: string,
    userId: string,
    text: string,
    onText: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<{ userMessage: ChatMessageResponse; assistantMessage: ChatMessageResponse; title: string }> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw new ChatError('Conversation not found', 404, 'NOT_FOUND');
    }

    const anthropic = getClient();

    // Assistant turns are replayed with their original content blocks
    // (thinking included) so the history is append-only, as the API expects.
    const history: Anthropic.Beta.BetaMessageParam[] = conversation.messages.map((m) =>
      m.role === 'assistant' && m.content
        ? { role: 'assistant', content: m.content as unknown as Anthropic.Beta.BetaContentBlockParam[] }
        : { role: m.role as 'user' | 'assistant', content: m.text }
    );

    const system: Anthropic.Beta.BetaTextBlockParam[] = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ];
    if (conversation.projectId) {
      const projectContext = await buildProjectContext(conversation.projectId);
      if (projectContext) system.push({ type: 'text', text: projectContext });
    }

    const stream = anthropic.beta.messages.stream(
      {
        model: CHAT_MODEL,
        max_tokens: MAX_TOKENS,
        // Conversational work: medium effort keeps replies quick and cheap.
        output_config: { effort: 'medium' },
        // If a safety classifier declines, retry server-side on the model
        // Anthropic recommends for that refusal category.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // Caches the whole conversation prefix so each new turn only pays
        // full price for the latest message.
        cache_control: { type: 'ephemeral' },
        system,
        messages: [...history, { role: 'user', content: text }],
      },
      { signal }
    );

    stream.on('text', (delta) => onText(delta));

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await stream.finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.APIUserAbortError) throw error;
      if (error instanceof Anthropic.RateLimitError) {
        throw new ChatError('The assistant is busy right now. Please try again shortly.', 429, 'RATE_LIMITED');
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new ChatError('The Lumina Assistant is misconfigured (invalid API key).', 503, 'CHAT_NOT_CONFIGURED');
      }
      if (error instanceof Anthropic.APIError) {
        console.error('Claude API error:', error.status, error.message);
        throw new ChatError('The assistant could not respond. Please try again.', 502, 'UPSTREAM_ERROR');
      }
      throw error;
    }

    if (response.stop_reason === 'refusal') {
      throw new ChatError(
        "The assistant can't help with that request. Try rephrasing it.",
        422,
        'REFUSED'
      );
    }

    const replyText = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const isFirstMessage = conversation.messages.length === 0;
    const title = isFirstMessage ? makeTitle(text) : conversation.title;

    // Both rows are written in one request, so @default(now()) would give
    // them the same timestamp and leave their order (which history replay
    // depends on) up to the database. Stamp them explicitly instead.
    const userCreatedAt = new Date();
    const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1);

    const [userMessage, assistantMessage] = await prisma.$transaction([
      prisma.chatMessage.create({ data: { conversationId, role: 'user', text, createdAt: userCreatedAt } }),
      prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          createdAt: assistantCreatedAt,
          text: replyText,
          content: response.content as unknown as Prisma.InputJsonValue,
        },
      }),
      // Also bumps updatedAt so the conversation sorts to the top of the list.
      prisma.conversation.update({ where: { id: conversationId }, data: { title } }),
    ]);

    return {
      userMessage: toMessageResponse(userMessage),
      assistantMessage: toMessageResponse(assistantMessage),
      title,
    };
  }
}

export default new ChatService();
