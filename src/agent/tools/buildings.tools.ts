import { tool } from 'ai';
import { z } from 'zod';
import { BuildingsService } from '../../buildings/buildings.service';

export function createBuildingsTools(buildingsService: BuildingsService) {
  return {
    getBuildingById: tool({
      description: 'Get detailed information about a specific building by its ID',
      inputSchema: z.object({
        id: z.number().describe('The building ID (BULBuildingID)'),
      }),
      execute: async ({ id }) => buildingsService.findById(id),
    }),

    analyzeBlastImpactOnBuildings: tool({
      description: 'Analyze buildings affected by a blast at given coordinates with specified yield',
      inputSchema: z.object({
        lon: z.number().describe('Longitude of blast center'),
        lat: z.number().describe('Latitude of blast center'),
        yieldKg: z.number().describe('Explosive yield in kilograms'),
        includeVulnerability: z.boolean().optional().describe('Include vulnerability analysis'),
      }),
      execute: async ({ lon, lat, yieldKg, includeVulnerability }) =>
        buildingsService.findByBlast(lon, lat, yieldKg, includeVulnerability ?? false),
    }),

    analyzeEarthquakeImpactOnBuildings: tool({
      description: 'Analyze buildings affected by an earthquake at given coordinates',
      inputSchema: z.object({
        lon: z.number().describe('Longitude of epicenter'),
        lat: z.number().describe('Latitude of epicenter'),
        magnitude: z.number().min(1).max(10).describe('Earthquake magnitude (Richter scale)'),
        includeVulnerability: z.boolean().optional().describe('Include vulnerability analysis'),
      }),
      execute: async ({ lon, lat, magnitude, includeVulnerability }) =>
        buildingsService.findByEarthquake(lon, lat, magnitude, includeVulnerability ?? false),
    }),

    findBuildingsByType: tool({
      description: 'Find buildings by their type/use (hospital, school, mosque, etc.)',
      inputSchema: z.object({
        types: z.array(z.enum([
          'hospital', 'school', 'university', 'educational', 'public',
          'mosque', 'church', 'religious', 'police', 'embassy', 'port', 'army'
        ])).describe('Array of building types to find'),
      }),
      execute: async ({ types }) => buildingsService.findByTypes(types as any),
    }),
  };
}
