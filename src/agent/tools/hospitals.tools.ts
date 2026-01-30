import { tool } from 'ai';
import { z } from 'zod';
import { HospitalsService } from '../../hospitals/hospitals.service';

export function createHospitalsTools(hospitalsService: HospitalsService) {
  return {
    listHospitals: tool({
      description: 'List all hospitals, optionally filtered by type (public/private)',
      inputSchema: z.object({
        type: z.enum(['public', 'private']).optional().describe('Filter by hospital type'),
      }),
      execute: async ({ type }) => hospitalsService.findAll(type),
    }),

    getHospitalById: tool({
      description: 'Get detailed information about a specific hospital including beds and building data',
      inputSchema: z.object({
        id: z.number().describe('The hospital ID (BULBuildingID)'),
      }),
      execute: async ({ id }) => hospitalsService.findById(id),
    }),

    findNearestHospitals: tool({
      description: 'Find the nearest hospitals to a given location',
      inputSchema: z.object({
        lon: z.number().describe('Longitude of reference point'),
        lat: z.number().describe('Latitude of reference point'),
        limit: z.number().min(1).max(20).optional().describe('Maximum number of results (default 5)'),
      }),
      execute: async ({ lon, lat, limit }) => hospitalsService.findNearest(lon, lat, limit ?? 5),
    }),

    analyzeBlastImpactOnHospitals: tool({
      description: 'Analyze hospitals affected by a blast, including bed capacity impact',
      inputSchema: z.object({
        lon: z.number().describe('Longitude of blast center'),
        lat: z.number().describe('Latitude of blast center'),
        yieldKg: z.number().describe('Explosive yield in kilograms'),
      }),
      execute: async ({ lon, lat, yieldKg }) => hospitalsService.findByBlast(lon, lat, yieldKg),
    }),

    analyzeEarthquakeImpactOnHospitals: tool({
      description: 'Analyze hospitals affected by an earthquake, including bed capacity impact',
      inputSchema: z.object({
        lon: z.number().describe('Longitude of epicenter'),
        lat: z.number().describe('Latitude of epicenter'),
        magnitude: z.number().min(1).max(10).describe('Earthquake magnitude'),
      }),
      execute: async ({ lon, lat, magnitude }) => hospitalsService.findByEarthquake(lon, lat, magnitude),
    }),
  };
}
