import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { generateText, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { BuildingsService } from '../buildings/buildings.service';
import { HospitalsService } from '../hospitals/hospitals.service';
import { ScenarioService } from '../scenario/scenario.service';
import { PublisherService } from '../websocket/publisher.service';
import { createAllTools, selectTools, wrapToolsWithPublisher, ToolName } from './tools';
import { AgentInvokeOptions, AgentResponse } from './dto/agent.dto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private allTools: ReturnType<typeof createAllTools>;

  constructor(
    private readonly buildingsService: BuildingsService,
    private readonly hospitalsService: HospitalsService,
    private readonly publisherService: PublisherService,
    @Optional()
    @Inject(forwardRef(() => ScenarioService))
    private readonly scenarioService?: ScenarioService,
  ) {
    this.allTools = createAllTools(
      buildingsService,
      hospitalsService,
      scenarioService,
    );
  }

  async invoke(options: AgentInvokeOptions): Promise<AgentResponse> {
    const {
      message,
      systemPrompt,
      tools: toolNames,
      maxSteps = 10,
      history = [],
      sessionId,
    } = options;

    // Select tools (all if not specified)
    let selectedTools = toolNames?.length
      ? selectTools(this.allTools, toolNames as any)
      : this.allTools;

    // Wrap with publisher if sessionId is provided
    if (sessionId) {
      selectedTools = wrapToolsWithPublisher(selectedTools, this.publisherService, sessionId);
    }

    this.logger.log(`Invoking agent with ${Object.keys(selectedTools).length} tools`);

    // Build messages array
    const messages = [
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    // Execute agent loop using generateText with stopWhen
    const result = await generateText({
      model: google('gemini-3-pro-preview'),
      system: systemPrompt,
      messages,
      tools: selectedTools,
      stopWhen: stepCountIs(maxSteps),
      onStepFinish: (step) => {
        this.logger.debug(`Step completed with ${step.toolCalls.length} tool calls`);
      },
    });

    // Collect all tool calls from all steps
    const toolCalls = result.steps.flatMap((step) =>
      step.toolCalls
        .filter((call): call is NonNullable<typeof call> => call !== undefined)
        .map((call) => ({
          toolName: call.toolName,
          args: call.input as Record<string, any>,
          result: step.toolResults.find((r) => r?.toolCallId === call.toolCallId)?.output,
        })),
    );

    const response = {
      text: result.text,
      toolCalls,
      steps: result.steps.length,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      },
    };

    // Emit agent response via WebSocket if sessionId provided
    if (sessionId) {
      this.publisherService.emitAgentResponse(sessionId, response);
    }

    return response;
  }
}
