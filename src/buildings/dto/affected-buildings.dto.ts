import { BuildingStatus } from '../../common/enums/status.enum';
import { DisasterType } from '../../common/enums/disaster-type.enum';

export interface BuildingProperties {
  BULBuildingID: number;
  NoofApartments: number;
  [key: string]: any;
}

export interface BuildingResult {
  id: number;
  apartments: number | null;
  status: BuildingStatus;
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
