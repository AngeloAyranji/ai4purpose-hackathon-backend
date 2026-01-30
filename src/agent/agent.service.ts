import { Injectable, Logger } from '@nestjs/common';
import { generateText, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { BuildingsService } from '../buildings/buildings.service';
import { HospitalsService } from '../hospitals/hospitals.service';
import { createAllTools, selectTools, ToolName } from './tools';
import { AgentInvokeOptions, AgentResponse } from './dto/agent.dto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private allTools: ReturnType<typeof createAllTools>;

  constructor(
    private readonly buildingsService: BuildingsService,
    private readonly hospitalsService: HospitalsService,
  ) {
    this.allTools = createAllTools(buildingsService, hospitalsService);
  }

  async invoke(options: AgentInvokeOptions): Promise<AgentResponse> {
    const {
      message,
      systemPrompt,
      tools: toolNames,
      maxSteps = 10,
      history = [],
    } = options;

    // Select tools (all if not specified)
    const selectedTools = toolNames?.length
      ? selectTools(this.allTools, toolNames)
      : this.allTools;

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

    return {
      text: result.text,
      toolCalls,
      steps: result.steps.length,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      },
    };
  }
}
