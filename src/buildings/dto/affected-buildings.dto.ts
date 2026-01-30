import { BuildingStatus } from '../../common/enums/status.enum';
import { DisasterType } from '../../common/enums/disaster-type.enum';

export interface BuildingProperties {
  BULBuildingID: number;
  NoofApartments: number;
  YearCompleted?: number;
  NoofFloor?: number;
  Status2022?: string;
  Building_Use?: string;
  [key: string]: any;
}

export interface VulnerabilityFactors {
  age: number;
  height: number;
  condition: number;
  useType: number;
}

export interface BuildingResult {
  id: number;
  apartments: number | null;
  status: BuildingStatus;
  vulnerabilityScore?: number;
  vulnerabilityFactors?: VulnerabilityFactors;
}

export interface AffectedBuildingsResponse {
  type: DisasterType;
  center: { lon: number; lat: number };
  parameters: Record<string, number>;
  summary: {
    totalBuildings: number;
    totalApartments: number;
    severeCount: number;
    mildCount: number;
  };
  buildings: BuildingResult[];
}
