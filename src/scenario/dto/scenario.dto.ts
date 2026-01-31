export interface CreateScenarioInput {
  sessionId: string;
  name: string;
  disasterType: 'blast' | 'earthquake';
  lat: number;
  lon: number;
  yield?: number;
  magnitude?: number;
  timeOfDay?: string;
  includeVulnerability?: boolean;
  customInput?: string; // User's additional context or notes
}

export interface ScenarioProgressEvent {
  scenarioId: string;
  step: string;
  stepIndex: number;
  totalSteps: number;
  progress: number;
  partialData?: Record<string, any>;
}

export interface ScenarioCompleteEvent {
  scenarioId: string;
  report: string;
  structured: ScenarioResults;
  mapData: MapData;
}

export interface ScenarioErrorEvent {
  scenarioId: string;
  error: string;
  step?: string;
}

export interface ScenarioResults {
  affectedBuildings: AffectedBuildingSummary;
  affectedHospitals: AffectedHospitalSummary;
  criticalInfrastructure: CriticalInfrastructureSummary;
  casualties: CasualtyEstimate;
  economicImpact: EconomicImpactEstimate;
  highRiskBuildings: HighRiskBuildingSummary;
  sectorAnalysis: SectorAnalysisSummary;
  mitigationPlans: MitigationPlanSummary[];
}

export interface AffectedBuildingSummary {
  total: number;
  severe: number;
  mild: number;
  byType: Record<string, number>;
}

export interface AffectedHospitalSummary {
  total: number;
  severe: number;
  mild: number;
  bedsAtRisk: number;
  functionalBeds: number;
}

export interface CriticalInfrastructureSummary {
  schools: number;
  universities: number;
  embassies: number;
  police: number;
  mosques: number;
  churches: number;
  total: number;
}

export interface CasualtyEstimate {
  fatalities: number;
  severeInjuries: number;
  mildInjuries: number;
  totalAffected: number;
  populationAtRisk: number;
  timeOfDayFactor: number;
}

export interface EconomicImpactEstimate {
  buildingDamage: number;
  infrastructureDamage: number;
  businessDisruption: number;
  medicalCosts: number;
  totalCost: number;
  currency: string;
}

export interface HighRiskBuildingSummary {
  total: number;
  averageVulnerability: number;
  byCondition: Record<string, number>;
  priorityList: HighRiskBuilding[];
}

export interface HighRiskBuilding {
  id: number;
  vulnerabilityScore: number;
  condition: string;
  floors: number;
  sector: string;
}

export interface SectorAnalysisSummary {
  sectors: SectorData[];
  mostAffected: string;
  leastAffected: string;
}

export interface SectorData {
  name: string;
  buildingsAffected: number;
  severeCount: number;
  mildCount: number;
  estimatedPopulation: number;
}

export interface MitigationPlanSummary {
  id: string;
  name: string;
  type: string;
  cost: number;
  targetBuildingCount: number;
  projectedLivesSaved: number;
  projectedCostReduction: number;
  roi: number;
}

export interface MapData {
  epicenter: { lat: number; lon: number };
  radiusKm: number;
  affectedBuildingIds: number[];
  severeBuildingIds: number[];
  mildBuildingIds: number[];
  hospitalIds: number[];
  criticalInfrastructureIds: number[];
}

export interface MitigationComparisonResult {
  baseline: {
    casualties: CasualtyEstimate;
    economicImpact: EconomicImpactEstimate;
  };
  withMitigation: {
    casualties: CasualtyEstimate;
    economicImpact: EconomicImpactEstimate;
  };
  improvement: {
    livessSaved: number;
    injuriesPrevented: number;
    costReduction: number;
    percentImprovement: number;
  };
}

export interface GetAffectedBuildingsArgs {
  disasterType: 'blast' | 'earthquake';
  lat: number;
  lon: number;
  yield?: number;
  magnitude?: number;
  includeVulnerability?: boolean;
}

export interface GetAffectedHospitalsArgs {
  disasterType: 'blast' | 'earthquake';
  lat: number;
  lon: number;
  yield?: number;
  magnitude?: number;
}

export interface GetCriticalInfrastructureArgs {
  disasterType: 'blast' | 'earthquake';
  lat: number;
  lon: number;
  yield?: number;
  magnitude?: number;
  types?: string[];
}

export interface CalculateCasualtiesArgs {
  affectedBuildings: any;
  timeOfDay?: string;
}

export interface EstimateEconomicImpactArgs {
  affectedBuildings: any;
  affectedHospitals: any;
  criticalInfrastructure: any;
}

export interface IdentifyHighRiskBuildingsArgs {
  affectedBuildings: any;
  vulnerabilityThreshold?: number;
}

export interface GenerateMitigationPlanArgs {
  highRiskBuildings: any;
  budget?: number;
}

export interface SimulateWithMitigationArgs {
  scenarioId: string;
  mitigationPlanId: string;
}

export interface GetSectorAnalysisArgs {
  affectedBuildings: any;
}

export interface GetBuildingDetailsArgs {
  scenarioId: string;
  buildingId: number;
}
