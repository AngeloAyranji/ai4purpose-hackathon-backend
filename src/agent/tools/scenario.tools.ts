import { tool } from 'ai';
import { z } from 'zod';
import { ScenarioService } from '../../scenario/scenario.service';

export function createScenarioTools(scenarioService: ScenarioService) {
  return {
    getAffectedBuildings: tool({
      description:
        'Query all buildings within disaster radius. Returns buildings affected by a blast or earthquake at the specified location.',
      inputSchema: z.object({
        disasterType: z
          .enum(['blast', 'earthquake'])
          .describe('Type of disaster to simulate'),
        lat: z.number().describe('Latitude of disaster epicenter'),
        lon: z.number().describe('Longitude of disaster epicenter'),
        yield: z
          .number()
          .optional()
          .describe('Explosive yield in kg TNT equivalent (for blast)'),
        magnitude: z
          .number()
          .optional()
          .describe('Earthquake magnitude on Richter scale'),
        includeVulnerability: z
          .boolean()
          .optional()
          .describe('Include vulnerability analysis for each building'),
      }),
      execute: async (args) => scenarioService.getAffectedBuildings(args),
    }),

    getAffectedHospitals: tool({
      description:
        'Query all hospitals within disaster radius. Returns hospitals affected by a blast or earthquake.',
      inputSchema: z.object({
        disasterType: z
          .enum(['blast', 'earthquake'])
          .describe('Type of disaster to simulate'),
        lat: z.number().describe('Latitude of disaster epicenter'),
        lon: z.number().describe('Longitude of disaster epicenter'),
        yield: z
          .number()
          .optional()
          .describe('Explosive yield in kg TNT equivalent (for blast)'),
        magnitude: z
          .number()
          .optional()
          .describe('Earthquake magnitude on Richter scale'),
      }),
      execute: async (args) => scenarioService.getAffectedHospitals(args),
    }),

    getCriticalInfrastructure: tool({
      description:
        'Find critical infrastructure (schools, universities, embassies, police stations, religious sites) in the disaster zone.',
      inputSchema: z.object({
        disasterType: z
          .enum(['blast', 'earthquake'])
          .describe('Type of disaster to simulate'),
        lat: z.number().describe('Latitude of disaster epicenter'),
        lon: z.number().describe('Longitude of disaster epicenter'),
        yield: z
          .number()
          .optional()
          .describe('Explosive yield in kg TNT equivalent (for blast)'),
        magnitude: z
          .number()
          .optional()
          .describe('Earthquake magnitude on Richter scale'),
        types: z
          .array(z.string())
          .optional()
          .describe('Specific infrastructure types to filter'),
      }),
      execute: async (args) => scenarioService.getCriticalInfrastructure(args),
    }),

    calculateCasualties: tool({
      description:
        'Calculate estimated casualties based on affected buildings and time of day. Uses population density and building damage data.',
      inputSchema: z.object({
        affectedBuildings: z
          .object({
            total: z.number(),
            severe: z.number(),
            mild: z.number(),
            byType: z.record(z.string(), z.number()).optional(),
          })
          .describe('Summary of affected buildings from getAffectedBuildings'),
        timeOfDay: z
          .enum(['morning', 'afternoon', 'night'])
          .optional()
          .describe('Time of day affects occupancy rates'),
      }),
      execute: async (args) => scenarioService.calculateCasualties(args),
    }),

    estimateEconomicImpact: tool({
      description:
        'Estimate total economic impact including building damage, infrastructure, business disruption, and medical costs.',
      inputSchema: z.object({
        affectedBuildings: z
          .object({
            total: z.number(),
            severe: z.number(),
            mild: z.number(),
            byType: z.record(z.string(), z.number()).optional(),
          })
          .describe('Summary of affected buildings'),
        affectedHospitals: z
          .object({
            total: z.number(),
            severe: z.number(),
            mild: z.number(),
            bedsAtRisk: z.number(),
            functionalBeds: z.number(),
          })
          .describe('Summary of affected hospitals'),
        criticalInfrastructure: z
          .object({
            schools: z.number(),
            universities: z.number(),
            embassies: z.number(),
            police: z.number(),
            mosques: z.number(),
            churches: z.number(),
            total: z.number(),
          })
          .describe('Summary of affected critical infrastructure'),
      }),
      execute: async (args) => scenarioService.estimateEconomicImpact(args),
    }),

    identifyHighRiskBuildings: tool({
      description:
        'Identify buildings with high vulnerability scores that should be prioritized for mitigation efforts.',
      inputSchema: z.object({
        affectedBuildings: z
          .object({
            total: z.number(),
            severe: z.number(),
            mild: z.number(),
            byType: z.record(z.string(), z.number()).optional(),
          })
          .describe('Summary of affected buildings'),
        vulnerabilityThreshold: z
          .number()
          .optional()
          .describe('Minimum vulnerability score to include (default: 0.6)'),
      }),
      execute: async (args) => scenarioService.identifyHighRiskBuildings(args),
    }),

    generateMitigationPlan: tool({
      description:
        'Generate mitigation plans for high-risk buildings. Returns cost estimates, projected lives saved, and ROI for different mitigation strategies.',
      inputSchema: z.object({
        highRiskBuildings: z
          .object({
            total: z.number(),
            averageVulnerability: z.number(),
            byCondition: z.record(z.string(), z.number()).optional(),
            priorityList: z.array(z.any()).optional(),
          })
          .describe('High-risk buildings from identifyHighRiskBuildings'),
        budget: z
          .number()
          .optional()
          .describe('Optional budget constraint in USD'),
      }),
      execute: async (args) => scenarioService.generateMitigationPlan(args),
    }),

    simulateWithMitigation: tool({
      description:
        'Re-run scenario analysis with a specific mitigation plan applied. Compares baseline vs mitigated outcomes.',
      inputSchema: z.object({
        scenarioId: z.string().describe('ID of the scenario to simulate'),
        mitigationPlanId: z
          .string()
          .describe('ID of the mitigation plan to apply'),
      }),
      execute: async (args) => scenarioService.simulateWithMitigation(args),
    }),

    getSectorAnalysis: tool({
      description:
        'Get breakdown of impact by sector/neighborhood. Identifies most and least affected areas.',
      inputSchema: z.object({
        affectedBuildings: z
          .object({
            total: z.number(),
            severe: z.number(),
            mild: z.number(),
            byType: z.record(z.string(), z.number()).optional(),
          })
          .describe('Summary of affected buildings'),
      }),
      execute: async (args) => scenarioService.getSectorAnalysis(args),
    }),

    getBuildingDetails: tool({
      description:
        'Get detailed information about a specific building including its damage status in a scenario.',
      inputSchema: z.object({
        scenarioId: z.string().describe('ID of the scenario for context'),
        buildingId: z.number().describe('Building ID to look up'),
      }),
      execute: async (args) => scenarioService.getBuildingDetails(args),
    }),
  };
}
