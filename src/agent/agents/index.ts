import { AgentConfig } from './types';
import { beirutCrisisAgent } from './beirut-crisis.agent';

// Register all agents here
const agents: AgentConfig[] = [beirutCrisisAgent];

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
