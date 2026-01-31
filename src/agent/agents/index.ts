import { AgentConfig } from './types';
import { beirutCrisisAgent } from './beirut-crisis.agent';
import { scenarioBuilderAgent } from './scenario-builder.agent';

// Register all agents here
const agents: AgentConfig[] = [beirutCrisisAgent, scenarioBuilderAgent];

// Create lookup map
const agentMap = new Map<string, AgentConfig>(
  agents.map((agent) => [agent.id, agent]),
);

export function getAgent(agentId: string): AgentConfig | undefined {
  return agentMap.get(agentId);
}

export function getAllAgents(): AgentConfig[] {
  return agents;
}

export function getDefaultAgent(): AgentConfig {
  return beirutCrisisAgent;
}

export { AgentConfig } from './types';
export { beirutCrisisAgent } from './beirut-crisis.agent';
export { scenarioBuilderAgent } from './scenario-builder.agent';
