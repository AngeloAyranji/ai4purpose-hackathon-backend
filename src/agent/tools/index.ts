import { BuildingsService } from '../../buildings/buildings.service';
import { HospitalsService } from '../../hospitals/hospitals.service';
import { createBuildingsTools } from './buildings.tools';
import { createHospitalsTools } from './hospitals.tools';

export type ToolName =
  | 'getBuildingById'
  | 'analyzeBlastImpactOnBuildings'
  | 'analyzeEarthquakeImpactOnBuildings'
  | 'findBuildingsByType'
  | 'listHospitals'
  | 'getHospitalById'
  | 'findNearestHospitals'
  | 'analyzeBlastImpactOnHospitals'
  | 'analyzeEarthquakeImpactOnHospitals';

export function createAllTools(
  buildingsService: BuildingsService,
  hospitalsService: HospitalsService,
) {
  return {
    ...createBuildingsTools(buildingsService),
    ...createHospitalsTools(hospitalsService),
  };
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
