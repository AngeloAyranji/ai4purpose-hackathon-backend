import { BuildingsService } from '../../buildings/buildings.service';
import { HospitalsService } from '../../hospitals/hospitals.service';
import { ScenarioService } from '../../scenario/scenario.service';
import { PublisherService } from '../../websocket/publisher.service';
import { createBuildingsTools } from './buildings.tools';
import { createHospitalsTools } from './hospitals.tools';
import { createScenarioTools } from './scenario.tools';

export type ToolName =
  | 'getBuildingById'
  | 'analyzeBlastImpactOnBuildings'
  | 'analyzeEarthquakeImpactOnBuildings'
  | 'findBuildingsByType'
  | 'listHospitals'
  | 'getHospitalById'
  | 'findNearestHospitals'
  | 'analyzeBlastImpactOnHospitals'
  | 'analyzeEarthquakeImpactOnHospitals'
  // Scenario tools
  | 'getAffectedBuildings'
  | 'getAffectedHospitals'
  | 'getCriticalInfrastructure'
  | 'calculateCasualties'
  | 'estimateEconomicImpact'
  | 'identifyHighRiskBuildings'
  | 'generateMitigationPlan'
  | 'simulateWithMitigation'
  | 'getSectorAnalysis'
  | 'getBuildingDetails';

export function createAllTools(
  buildingsService: BuildingsService,
  hospitalsService: HospitalsService,
  scenarioService?: ScenarioService,
) {
  const tools = {
    ...createBuildingsTools(buildingsService),
    ...createHospitalsTools(hospitalsService),
  };

  if (scenarioService) {
    Object.assign(tools, createScenarioTools(scenarioService));
  }

  return tools;
}

export function selectTools<T extends Record<string, any>>(
  allTools: T,
  toolNames: (keyof T)[],
): Partial<T> {
  const selected: Partial<T> = {};
  for (const name of toolNames) {
    if (allTools[name]) {
      selected[name] = allTools[name];
    }
  }
  return selected;
}

export { createBuildingsTools } from './buildings.tools';
export { createHospitalsTools } from './hospitals.tools';
export { createScenarioTools } from './scenario.tools';

// Wrap tools with event emission for WebSocket publishing
export function wrapToolsWithPublisher<T extends Record<string, any>>(
  tools: T,
  publisherService: PublisherService,
  sessionId: string,
): T {
  const wrapped = {} as T;

  for (const [name, toolDef] of Object.entries(tools)) {
    const originalExecute = toolDef.execute;

    wrapped[name as keyof T] = {
      ...toolDef,
      execute: async (args: any) => {
        // Emit STARTED event
        publisherService.emitToolStarted(sessionId, name, args);

        // Execute original tool
        const result = await originalExecute(args);

        // Emit ENDED event
        publisherService.emitToolEnded(sessionId, name, args, result);

        return result;
      },
    } as T[keyof T];
  }

  return wrapped;
}
