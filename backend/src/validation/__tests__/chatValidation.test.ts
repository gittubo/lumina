import { createConversationSchema, sendMessageSchema, CHAT_MESSAGE_MAX_LENGTH } from '../chatValidation';

describe('createConversationSchema', () => {
  it('accepts an empty body', () => {
    expect(createConversationSchema.validate({}).error).toBeUndefined();
  });

  it('accepts a projectId', () => {
    expect(createConversationSchema.validate({ projectId: 'proj_1' }).error).toBeUndefined();
  });
});

describe('sendMessageSchema', () => {
  it('accepts a normal message and trims it', () => {
    const { error, value } = sendMessageSchema.validate({ message: '  hello  ' });
    expect(error).toBeUndefined();
    expect(value.message).toBe('hello');
  });

  it('rejects a missing or blank message', () => {
    expect(sendMessageSchema.validate({}).error).toBeDefined();
    expect(sendMessageSchema.validate({ message: '   ' }).error).toBeDefined();
  });

  it('rejects an oversized message', () => {
    const { error } = sendMessageSchema.validate({ message: 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1) });
    expect(error).toBeDefined();
  });
});
