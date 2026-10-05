export interface CreateConversationRequest {
  projectId?: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface ConversationResponse {
  id: string;
  title: string;
  userId: string;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageResponse {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: Date;
}

export interface ConversationWithMessages extends ConversationResponse {
  messages: ChatMessageResponse[];
}
