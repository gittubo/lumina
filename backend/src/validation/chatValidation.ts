import Joi from 'joi';

// Every message re-sends the whole conversation to Claude, so an oversized
// message costs on every later turn too — 8000 chars is plenty for a
// creative brief or a pasted script.
export const CHAT_MESSAGE_MAX_LENGTH = 8000;

export const createConversationSchema = Joi.object({
  projectId: Joi.string().trim().optional(),
});

export const sendMessageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH).required(),
});
