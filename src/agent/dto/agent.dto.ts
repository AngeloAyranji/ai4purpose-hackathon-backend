import { ToolName } from '../tools';

export interface AgentInvokeOptions {
  /** The user's message/query */
  message: string;

  /** System prompt/instructions for the agent */
  systemPrompt: string;

  /** Which tools to make available (if empty, all tools are available) */
  tools?: ToolName[];

  /** Maximum agent loop iterations (default: 10) */
  maxSteps?: number;

  /** Optional conversation history for context */
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface AgentResponse {
  /** The agent's final text response */
  text: string;

  /** Tool calls made during execution */
  toolCalls: {
    toolName: string;
    args: Record<string, any>;
    result: any;
  }[];

  /** Number of steps taken */
  steps: number;

  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
