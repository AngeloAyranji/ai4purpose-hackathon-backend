import { ToolName } from '../tools';

export interface AgentConfig {
  /** Unique identifier for the agent */
  id: string;

  /** Display name */
  name: string;

  /** Short description of what the agent does */
  description: string;

  /** System prompt/instructions for the agent */
  systemPrompt: string;

  /** Which tools to make available (undefined = all tools) */
  tools?: ToolName[];

  /** Maximum agent loop iterations (default: 10) */
  maxSteps?: number;
}
