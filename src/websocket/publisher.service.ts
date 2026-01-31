import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

export interface ToolEvent {
  toolName: string;
  args: Record<string, any>;
  result?: any;
  timestamp: string;
}

// Convert camelCase to UPPER_SNAKE_CASE
function toUpperSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

@Injectable()
export class PublisherService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToolStarted(sessionId: string, toolName: string, args: Record<string, any>) {
    if (!this.server) return;

    const event: ToolEvent = {
      toolName,
      args,
      timestamp: new Date().toISOString(),
    };

    const eventName = `${toUpperSnakeCase(toolName)}_STARTED`;
    this.server.to(sessionId).emit(eventName, event);
  }

  emitToolEnded(sessionId: string, toolName: string, args: Record<string, any>, result: any) {
    if (!this.server) return;

    const event: ToolEvent = {
      toolName,
      args,
      result,
      timestamp: new Date().toISOString(),
    };

    const eventName = `${toUpperSnakeCase(toolName)}_ENDED`;
    this.server.to(sessionId).emit(eventName, event);
  }

  emitAgentResponse(
    sessionId: string,
    response: {
      text: string;
      toolCalls: any[];
      steps: number;
      usage: any;
    },
  ): void {
    if (!this.server) return;

    this.server.to(sessionId).emit('AGENT_RESPONSE', {
      ...response,
      timestamp: new Date().toISOString(),
    });
  }
}
