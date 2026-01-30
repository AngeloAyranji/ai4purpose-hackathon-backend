import { BuildingStatus } from '../../common/enums/status.enum';
import { DisasterType } from '../../common/enums/disaster-type.enum';

export interface BuildingProperties {
  BULBuildingID: number;
  NoofApartments: number;
  YearCompleted?: number;
  NoofFloor?: number;
  Status2022?: string;
  Building_Use?: string;
  Sector_Name?: string;
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

// Statistics interfaces
export interface PopulationImpact {
  estimatedResidents: number;
  estimatedResidentsSevere: number;
  estimatedResidentsMild: number;
  residentialUnits: number;
  residentialBuildings: number;
}

export interface BuildingTypeCount {
  total: number;
  severe: number;
  mild: number;
}

export interface BuildingsByUse {
  residential: BuildingTypeCount;
  commercial: BuildingTypeCount;
  industrial: BuildingTypeCount;
  institutional: BuildingTypeCount;
  mixedUse: BuildingTypeCount;
  religious: BuildingTypeCount;
  constructionSite: BuildingTypeCount;
  other: BuildingTypeCount;
}

export interface BuildingsByCondition {
  complete: BuildingTypeCount;
  underConstruction: BuildingTypeCount;
  evicted: BuildingTypeCount;
  demolished: BuildingTypeCount;
  renovated: BuildingTypeCount;
  emptyLot: BuildingTypeCount;
  other: BuildingTypeCount;
}

export interface StructuralAnalysis {
  avgFloors: number;
  maxFloors: number;
  totalFloors: number;
  buildingsAbove10Floors: number;
  avgBuildingAge: number | null;
  oldestBuilding: number | null;
  newestBuilding: number | null;
}

export interface VulnerabilityDistribution {
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  avgScore: number;
  maxScore: number;
}

export interface AffectedAreas {
  sectors: string[];
  sectorCount: number;
}

export interface Statistics {
  populationImpact: PopulationImpact;
  buildingsByUse: BuildingsByUse;
  buildingsByCondition: BuildingsByCondition;
  structuralAnalysis: StructuralAnalysis;
  vulnerabilityDistribution?: VulnerabilityDistribution;
  affectedAreas: AffectedAreas;
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
  statistics: Statistics;
  buildings: BuildingResult[];
}
