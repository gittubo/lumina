import { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { AuthenticatedRequest } from '../types/auth';
import { CreateConversationRequest, SendMessageRequest } from '../types/chat';
import chatService, { ChatError } from '../services/chatService';
import projectService from '../services/projectService';

class ChatController {
  async createConversation(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
      }

      const { projectId } = req.body as CreateConversationRequest;

      // Same IDOR guard as generations: only attach a project the user owns.
      if (projectId) {
        const project = await projectService.getProjectById(projectId, req.userId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
        }
      }

      const conversation = await chatService.createConversation(req.userId, projectId);
      return res.status(201).json(conversation);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to create conversation',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async listConversations(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
      }

      const conversations = await chatService.listConversations(req.userId);
      return res.status(200).json({ conversations });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to fetch conversations',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async getConversation(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
      }

      const conversation = await chatService.getConversation(req.params.id, req.userId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found', code: 'NOT_FOUND' });
      }

      return res.status(200).json(conversation);
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to fetch conversation',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  async deleteConversation(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
      }

      const deleted = await chatService.deleteConversation(req.params.id, req.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Conversation not found', code: 'NOT_FOUND' });
      }

      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Failed to delete conversation',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Streams the assistant's reply as Server-Sent Events:
   *   event: delta  data: { text }                                   (repeated)
   *   event: done   data: { userMessage, assistantMessage, title }
   *   event: error  data: { error, code }
   * Errors that happen before the first token (unknown conversation, missing
   * API key, ...) are returned as a normal JSON error response instead.
   */
  async sendMessage(req: AuthenticatedRequest, res: Response) {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    }

    const { message } = req.body as SendMessageRequest;

    // Stop generating (and stop paying for tokens) if the user navigates away.
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    const sendEvent = (event: string, data: unknown) => {
      if (!res.headersSent) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        // Stops nginx-style reverse proxies from buffering the stream.
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
      }
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await chatService.sendMessage(
        req.params.id,
        req.userId,
        message,
        (text) => sendEvent('delta', { text }),
        abortController.signal
      );
      sendEvent('done', result);
      return res.end();
    } catch (error: any) {
      if (error instanceof Anthropic.APIUserAbortError) {
        return res.end();
      }

      const status = error instanceof ChatError ? error.status : 500;
      const body = {
        error: error instanceof ChatError ? error.message : 'Failed to get a reply',
        code: error instanceof ChatError ? error.code : 'INTERNAL_ERROR',
      };
      if (!(error instanceof ChatError)) console.error(error);

      if (res.headersSent) {
        sendEvent('error', body);
        return res.end();
      }
      return res.status(status).json(body);
    }
  }
}

export default new ChatController();
