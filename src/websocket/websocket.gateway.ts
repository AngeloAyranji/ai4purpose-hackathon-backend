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
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PublisherService } from './publisher.service';
import { AgentService } from '../agent/agent.service';
import { getAgent, getDefaultAgent } from '../agent/agents';
import { ChatSessionService } from '../chat-session/chat-session.service';
import { ScenarioService } from '../scenario/scenario.service';

interface ChatMessagePayload {
  sessionId: string;
  message: string;
  agentId?: string;
}

interface RunScenarioPayload {
  sessionId: string;
  scenario: {
    name: string;
    disasterType: 'blast' | 'earthquake';
    epicenter: { lat: number; lon: number };
    parameters: {
      yield?: number;
      magnitude?: number;
      timeOfDay?: string;
    };
    customInput?: string; // User's additional context or notes
  };
}

interface CancelAnalysisPayload {
  scenarioId: string;
}

interface CompareMitigationPayload {
  scenarioId: string;
  planId: string;
}

interface GetScenarioStatusPayload {
  scenarioId: string;
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
    @Inject(forwardRef(() => ScenarioService))
    private readonly scenarioService: ScenarioService,
  ) {}

  afterInit(server: Server) {
    this.publisherService.setServer(server);
    this.scenarioService.setPublisherService(this.publisherService);
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

  // Scenario Analysis Handlers
  @SubscribeMessage('runScenarioAnalysis')
  async handleRunScenarioAnalysis(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RunScenarioPayload,
  ) {
    const { sessionId, scenario } = payload;
    this.logger.log(
      `Starting scenario analysis for session ${sessionId}: ${scenario.name}`,
    );

    try {
      // Create the scenario
      const scenarioId = await this.scenarioService.createScenario({
        sessionId,
        name: scenario.name,
        disasterType: scenario.disasterType,
        lat: scenario.epicenter.lat,
        lon: scenario.epicenter.lon,
        yield: scenario.parameters.yield,
        magnitude: scenario.parameters.magnitude,
        timeOfDay: scenario.parameters.timeOfDay,
        includeVulnerability: true,
        customInput: scenario.customInput,
      });

      // Join the session room to receive updates
      client.join(sessionId);

      // Run analysis in background (non-blocking)
      this.scenarioService.runAnalysis(scenarioId).catch((error) => {
        this.logger.error(`Scenario analysis failed: ${error.message}`);
      });

      return {
        success: true,
        scenarioId,
        message: 'Scenario analysis started. Listen for SCENARIO_PROGRESS events.',
      };
    } catch (error) {
      this.logger.error(`Error starting scenario analysis: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('cancelAnalysis')
  async handleCancelAnalysis(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CancelAnalysisPayload,
  ) {
    const { scenarioId } = payload;
    this.logger.log(`Cancelling scenario analysis: ${scenarioId}`);

    try {
      await this.scenarioService.cancel(scenarioId);
      return { success: true, message: 'Cancellation requested' };
    } catch (error) {
      this.logger.error(`Error cancelling analysis: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('compareMitigation')
  async handleCompareMitigation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CompareMitigationPayload,
  ) {
    const { scenarioId, planId } = payload;
    this.logger.log(
      `Comparing mitigation for scenario ${scenarioId}, plan ${planId}`,
    );

    try {
      const comparison = await this.scenarioService.simulateWithMitigation({
        scenarioId,
        mitigationPlanId: planId,
      });

      // Get scenario to find sessionId
      const scenario = await this.scenarioService.getScenario(scenarioId);
      if (scenario) {
        this.publisherService.emitMitigationComparison(
          scenario.sessionId,
          scenarioId,
          comparison,
        );
      }

      return { success: true, comparison };
    } catch (error) {
      this.logger.error(`Error comparing mitigation: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('getScenarioStatus')
  async handleGetScenarioStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GetScenarioStatusPayload,
  ) {
    const { scenarioId } = payload;
    this.logger.log(`Getting scenario status: ${scenarioId}`);

    try {
      const scenario = await this.scenarioService.getScenario(scenarioId);

      if (!scenario) {
        return { success: false, error: 'Scenario not found' };
      }

      return {
        success: true,
        scenario: {
          scenarioId: scenario.scenarioId,
          name: scenario.name,
          status: scenario.status,
          progress: scenario.progress,
          steps: scenario.steps,
          results: scenario.results,
          reportMarkdown: scenario.reportMarkdown,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting scenario status: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
