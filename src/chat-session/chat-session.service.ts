import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession, ChatMessage } from './chat-session.schema';

@Injectable()
export class ChatSessionService {
  constructor(
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSession>,
  ) {}

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = await this.chatSessionModel.findOne({ sessionId });
    return session?.messages || [];
  }

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    await this.chatSessionModel.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: { role, content, timestamp: new Date() } },
      },
      { upsert: true, new: true },
    );
  }

  async clearHistory(sessionId: string): Promise<void> {
    await this.chatSessionModel.deleteOne({ sessionId });
  }
}
