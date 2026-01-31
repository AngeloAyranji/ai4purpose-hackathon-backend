import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PublisherService } from './publisher.service';
import { AgentService } from '../agent/agent.service';
import { getAgent, getDefaultAgent } from '../agent/agents';
import { ChatSessionService } from '../chat-session/chat-session.service';

interface ChatMessagePayload {
  sessionId: string;
  message: string;
  agentId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(
    private readonly publisherService: PublisherService,
    private readonly agentService: AgentService,
    private readonly chatSessionService: ChatSessionService,
  ) {}

  afterInit(server: Server) {
    this.publisherService.setServer(server);
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinSession')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() sessionId: string,
  ) {
    client.join(sessionId);
    this.logger.log(`Client ${client.id} joined session: ${sessionId}`);
    return { success: true, sessionId };
  }

  @SubscribeMessage('leaveSession')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() sessionId: string,
  ) {
    client.leave(sessionId);
    this.logger.log(`Client ${client.id} left session: ${sessionId}`);
    return { success: true };
  }

  @SubscribeMessage('crisisManagementMapAgent')
  async handleCrisisManagementMapAgent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatMessagePayload,
  ) {
    const { sessionId, message, agentId } = payload;
    this.logger.log(
      `Crisis management map agent message from session ${sessionId}: ${message}`,
    );

    // Get agent config
    const agent = agentId ? getAgent(agentId) : getDefaultAgent();
    if (!agent) {
      return { success: false, error: `Agent '${agentId}' not found` };
    }

    // Get conversation history from MongoDB
    const history = await this.chatSessionService.getHistory(sessionId);

    try {
      const response = await this.agentService.invoke({
        message,
        systemPrompt: agent.systemPrompt,
        tools: agent.tools,
        maxSteps: agent.maxSteps,
        history,
        sessionId,
      });

      // Store messages in MongoDB
      await this.chatSessionService.addMessage(sessionId, 'user', message);
      await this.chatSessionService.addMessage(
        sessionId,
        'assistant',
        response.text,
      );

      return { success: true, response };
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
