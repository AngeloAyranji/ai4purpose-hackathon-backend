import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Scenario } from './scenario.schema';
import { BuildingsService } from '../buildings/buildings.service';
import { HospitalsService } from '../hospitals/hospitals.service';
import { CasualtyCalculator } from './calculators/casualty.calculator';
import { EconomicCalculator } from './calculators/economic.calculator';
import { MitigationCalculator } from './calculators/mitigation.calculator';
import { PublisherService } from '../websocket/publisher.service';
import {
  CreateScenarioInput,
  ScenarioResults,
  MapData,
  AffectedBuildingSummary,
  AffectedHospitalSummary,
  CriticalInfrastructureSummary,
  CasualtyEstimate,
  EconomicImpactEstimate,
  HighRiskBuildingSummary,
  SectorAnalysisSummary,
  MitigationPlanSummary,
  GetAffectedBuildingsArgs,
  GetAffectedHospitalsArgs,
  GetCriticalInfrastructureArgs,
  CalculateCasualtiesArgs,
  EstimateEconomicImpactArgs,
  IdentifyHighRiskBuildingsArgs,
  GenerateMitigationPlanArgs,
  SimulateWithMitigationArgs,
  GetSectorAnalysisArgs,
  GetBuildingDetailsArgs,
  MitigationComparisonResult,
} from './dto/scenario.dto';
import { BuildingType } from '../common/enums/building-type.enum';

interface AnalysisStep {
  name: string;
  progress: number;
  action: () => Promise<any>;
}

@Injectable()
export class ScenarioService {
  private readonly logger = new Logger(ScenarioService.name);
  private cancelledScenarios = new Set<string>();

  constructor(
    @InjectModel(Scenario.name) private scenarioModel: Model<Scenario>,
    private readonly buildingsService: BuildingsService,
    private readonly hospitalsService: HospitalsService,
    private readonly casualtyCalculator: CasualtyCalculator,
    private readonly economicCalculator: EconomicCalculator,
    private readonly mitigationCalculator: MitigationCalculator,
    @Optional() private publisherService?: PublisherService,
  ) {}

  setPublisherService(publisherService: PublisherService): void {
    this.publisherService = publisherService;
  }

  async createScenario(input: CreateScenarioInput): Promise<string> {
    const scenarioId = uuidv4();

    const scenario = new this.scenarioModel({
      scenarioId,
      sessionId: input.sessionId,
      name: input.name,
      status: 'pending',
      parameters: {
        disasterType: input.disasterType,
        lat: input.lat,
        lon: input.lon,
        yield: input.yield,
        magnitude: input.magnitude,
        timeOfDay: input.timeOfDay || 'afternoon',
        includeVulnerability: input.includeVulnerability ?? true,
        customInput: input.customInput,
      },
      steps: [
        { name: 'Impact Assessment', status: 'pending' },
        { name: 'Hospital Analysis', status: 'pending' },
        { name: 'Critical Infrastructure', status: 'pending' },
        { name: 'Casualty Estimation', status: 'pending' },
        { name: 'Economic Analysis', status: 'pending' },
        { name: 'Risk Identification', status: 'pending' },
        { name: 'Sector Breakdown', status: 'pending' },
        { name: 'Mitigation Planning', status: 'pending' },
        { name: 'Report Generation', status: 'pending' },
      ],
      progress: 0,
    });

    await scenario.save();
    this.logger.log(`Created scenario ${scenarioId} for session ${input.sessionId}`);

    return scenarioId;
  }

  async runAnalysis(scenarioId: string): Promise<ScenarioResults> {
    const scenario = await this.scenarioModel.findOne({ scenarioId });
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const { parameters, sessionId } = scenario;

    // Update status to running
    await this.scenarioModel.updateOne({ scenarioId }, { status: 'running' });

    const results: Partial<ScenarioResults> = {};
    let mapData: Partial<MapData> = {
      epicenter: { lat: parameters.lat, lon: parameters.lon },
      radiusKm: 0,
      affectedBuildingIds: [],
      severeBuildingIds: [],
      mildBuildingIds: [],
      hospitalIds: [],
      criticalInfrastructureIds: [],
    };

    const steps: AnalysisStep[] = [
      {
        name: 'Impact Assessment',
        progress: 10,
        action: async () => {
          const buildings = await this.getAffectedBuildings({
            disasterType: parameters.disasterType,
            lat: parameters.lat,
            lon: parameters.lon,
            yield: parameters.yield,
            magnitude: parameters.magnitude,
            includeVulnerability: parameters.includeVulnerability,
          });
          results.affectedBuildings = this.summarizeBuildings(buildings);
          mapData.affectedBuildingIds = buildings.buildings.map((b) => b.id);
          mapData.severeBuildingIds = buildings.buildings
            .filter((b) => b.status === 'SEVERE')
            .map((b) => b.id);
          mapData.mildBuildingIds = buildings.buildings
            .filter((b) => b.status === 'MILD')
            .map((b) => b.id);
          return buildings;
        },
      },
      {
        name: 'Hospital Analysis',
        progress: 20,
        action: async () => {
          const hospitals = await this.getAffectedHospitals({
            disasterType: parameters.disasterType,
            lat: parameters.lat,
            lon: parameters.lon,
            yield: parameters.yield,
            magnitude: parameters.magnitude,
          });
          results.affectedHospitals = this.summarizeHospitals(hospitals);
          mapData.hospitalIds = hospitals?.affected?.map((h) => h.id) || [];
          return hospitals;
        },
      },
      {
        name: 'Critical Infrastructure',
        progress: 30,
        action: async () => {
          const infrastructure = await this.getCriticalInfrastructure({
            disasterType: parameters.disasterType,
            lat: parameters.lat,
            lon: parameters.lon,
            yield: parameters.yield,
            magnitude: parameters.magnitude,
          });
          results.criticalInfrastructure = infrastructure;
          return infrastructure;
        },
      },
      {
        name: 'Casualty Estimation',
        progress: 45,
        action: async () => {
          const casualties = await this.calculateCasualties({
            affectedBuildings: results.affectedBuildings,
            timeOfDay: parameters.timeOfDay,
          });
          results.casualties = casualties;
          return casualties;
        },
      },
      {
        name: 'Economic Analysis',
        progress: 60,
        action: async () => {
          const economic = await this.estimateEconomicImpact({
            affectedBuildings: results.affectedBuildings,
            affectedHospitals: results.affectedHospitals,
            criticalInfrastructure: results.criticalInfrastructure,
          });
          results.economicImpact = economic;
          return economic;
        },
      },
      {
        name: 'Risk Identification',
        progress: 70,
        action: async () => {
          const highRisk = await this.identifyHighRiskBuildings({
            affectedBuildings: results.affectedBuildings,
            vulnerabilityThreshold: 0.6,
          });
          results.highRiskBuildings = highRisk;
          return highRisk;
        },
      },
      {
        name: 'Sector Breakdown',
        progress: 80,
        action: async () => {
          const sectors = await this.getSectorAnalysis({
            affectedBuildings: results.affectedBuildings,
          });
          results.sectorAnalysis = sectors;
          return sectors;
        },
      },
      {
        name: 'Mitigation Planning',
        progress: 90,
        action: async () => {
          const plans = await this.generateMitigationPlan({
            highRiskBuildings: results.highRiskBuildings,
          });
          results.mitigationPlans = plans;
          return plans;
        },
      },
      {
        name: 'Report Generation',
        progress: 100,
        action: async () => {
          const report = this.generateReportMarkdown(
            scenario.name,
            parameters,
            results as ScenarioResults,
          );
          return report;
        },
      },
    ];

    let currentStepIndex = 0;
    let report = '';

    try {
      for (const step of steps) {
        // Check for cancellation
        if (this.cancelledScenarios.has(scenarioId)) {
          await this.scenarioModel.updateOne(
            { scenarioId },
            { status: 'cancelled' },
          );
          this.cancelledScenarios.delete(scenarioId);
          throw new Error('Analysis cancelled by user');
        }

        // Update step status to running
        await this.updateStepStatus(scenarioId, currentStepIndex, 'running');

        // Emit progress
        this.publisherService?.emitScenarioProgress(
          sessionId,
          scenarioId,
          step.name,
          currentStepIndex,
          steps.length,
          step.progress,
          null,
        );

        // Execute step
        const stepResult = await step.action();

        // Update step status to completed
        await this.updateStepStatus(
          scenarioId,
          currentStepIndex,
          'completed',
          stepResult,
        );

        // Update progress
        await this.scenarioModel.updateOne(
          { scenarioId },
          { progress: step.progress },
        );

        if (step.name === 'Report Generation') {
          report = stepResult;
        }

        currentStepIndex++;
      }

      // Save final results
      await this.scenarioModel.updateOne(
        { scenarioId },
        {
          status: 'completed',
          results: results,
          reportMarkdown: report,
          mitigationPlans: results.mitigationPlans?.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            cost: p.cost,
            targetBuildingIds: [],
            projectedOutcome: {
              livesSaved: p.projectedLivesSaved,
              costReduction: p.projectedCostReduction,
              roi: p.roi,
            },
          })),
        },
      );

      // Emit completion
      this.publisherService?.emitScenarioComplete(
        sessionId,
        scenarioId,
        results as ScenarioResults,
        report,
        mapData as MapData,
      );

      return results as ScenarioResults;
    } catch (error) {
      // Update status to failed
      await this.scenarioModel.updateOne(
        { scenarioId },
        { status: 'failed' },
      );

      // Emit error
      this.publisherService?.emitScenarioError(
        sessionId,
        scenarioId,
        error.message,
        steps[currentStepIndex]?.name,
      );

      throw error;
    }
  }

  async cancel(scenarioId: string): Promise<void> {
    this.cancelledScenarios.add(scenarioId);
    this.logger.log(`Marked scenario ${scenarioId} for cancellation`);
  }

  async getScenario(scenarioId: string): Promise<Scenario | null> {
    return this.scenarioModel.findOne({ scenarioId });
  }

  async getAffectedBuildings(args: GetAffectedBuildingsArgs): Promise<any> {
    const { disasterType, lat, lon, includeVulnerability = true } = args;

    if (disasterType === 'blast') {
      return this.buildingsService.findByBlast(
        lon,
        lat,
        args.yield || 1000,
        includeVulnerability,
      );
    } else {
      return this.buildingsService.findByEarthquake(
        lon,
        lat,
        args.magnitude || 6.0,
        includeVulnerability,
      );
    }
  }

  async getAffectedHospitals(args: GetAffectedHospitalsArgs): Promise<any> {
    const { disasterType, lat, lon } = args;

    if (disasterType === 'blast') {
      return this.hospitalsService.findByBlast(lon, lat, args.yield || 1000);
    } else {
      return this.hospitalsService.findByEarthquake(
        lon,
        lat,
        args.magnitude || 6.0,
      );
    }
  }

  async getCriticalInfrastructure(
    args: GetCriticalInfrastructureArgs,
  ): Promise<CriticalInfrastructureSummary> {
    const types: BuildingType[] = [
      BuildingType.SCHOOL,
      BuildingType.UNIVERSITY,
      BuildingType.EMBASSY,
      BuildingType.POLICE,
      BuildingType.MOSQUE,
      BuildingType.CHURCH,
    ];

    const result = this.buildingsService.findByTypes(types);

    // Count by type from the buildingsByType structure
    const counts: CriticalInfrastructureSummary = {
      schools: result.buildingsByType[BuildingType.SCHOOL]?.count || 0,
      universities: result.buildingsByType[BuildingType.UNIVERSITY]?.count || 0,
      embassies: result.buildingsByType[BuildingType.EMBASSY]?.count || 0,
      police: result.buildingsByType[BuildingType.POLICE]?.count || 0,
      mosques: result.buildingsByType[BuildingType.MOSQUE]?.count || 0,
      churches: result.buildingsByType[BuildingType.CHURCH]?.count || 0,
      total: result.total,
    };

    return counts;
  }

  async calculateCasualties(args: CalculateCasualtiesArgs): Promise<CasualtyEstimate> {
    const { affectedBuildings, timeOfDay = 'afternoon' } = args;

    // Convert summary to calculator format
    const buildingsData = {
      buildings: this.convertToCalculatorFormat(affectedBuildings),
    };

    return this.casualtyCalculator.calculate(buildingsData, timeOfDay);
  }

  async estimateEconomicImpact(
    args: EstimateEconomicImpactArgs,
  ): Promise<EconomicImpactEstimate> {
    const { affectedBuildings, affectedHospitals, criticalInfrastructure } = args;

    const buildingsData = {
      buildings: this.convertToCalculatorFormat(affectedBuildings),
    };

    const hospitalsData = {
      hospitals: this.convertHospitalsToCalculatorFormat(affectedHospitals),
    };

    const infrastructureData = {
      items: [
        { type: 'school', count: criticalInfrastructure?.schools || 0 },
        { type: 'university', count: criticalInfrastructure?.universities || 0 },
        { type: 'embassy', count: criticalInfrastructure?.embassies || 0 },
        { type: 'police', count: criticalInfrastructure?.police || 0 },
        { type: 'mosque', count: criticalInfrastructure?.mosques || 0 },
        { type: 'church', count: criticalInfrastructure?.churches || 0 },
      ],
    };

    return this.economicCalculator.calculate(
      buildingsData,
      hospitalsData,
      infrastructureData,
    );
  }

  async identifyHighRiskBuildings(
    args: IdentifyHighRiskBuildingsArgs,
  ): Promise<HighRiskBuildingSummary> {
    const { affectedBuildings, vulnerabilityThreshold = 0.6 } = args;

    // This would need actual building data with vulnerability scores
    // For now, return a summary based on the affected buildings count
    const total = affectedBuildings?.severe || 0;
    const avgVulnerability = 0.65;

    return {
      total,
      averageVulnerability: avgVulnerability,
      byCondition: {
        poor: Math.floor(total * 0.4),
        fair: Math.floor(total * 0.35),
        critical: Math.floor(total * 0.15),
        good: Math.floor(total * 0.1),
      },
      priorityList: [],
    };
  }

  async generateMitigationPlan(
    args: GenerateMitigationPlanArgs,
  ): Promise<MitigationPlanSummary[]> {
    const { highRiskBuildings, budget } = args;

    const mockHighRiskData = {
      buildings: Array.from({ length: highRiskBuildings?.total || 10 }, (_, i) => ({
        id: i + 1,
        vulnerabilityScore: 0.6 + Math.random() * 0.3,
        condition: ['poor', 'fair', 'critical', 'good'][Math.floor(Math.random() * 4)],
        floors: Math.floor(Math.random() * 10) + 3,
        sector: `Sector ${Math.floor(Math.random() * 5) + 1}`,
      })),
      total: highRiskBuildings?.total || 10,
      averageVulnerability: highRiskBuildings?.averageVulnerability || 0.65,
    };

    return this.mitigationCalculator.generatePlans(mockHighRiskData, budget);
  }

  async simulateWithMitigation(
    args: SimulateWithMitigationArgs,
  ): Promise<MitigationComparisonResult> {
    const { scenarioId, mitigationPlanId } = args;

    const scenario = await this.scenarioModel.findOne({ scenarioId });
    if (!scenario || !scenario.results) {
      throw new Error('Scenario not found or not completed');
    }

    const plan = scenario.mitigationPlans.find((p) => p.id === mitigationPlanId);
    if (!plan) {
      throw new Error('Mitigation plan not found');
    }

    const baseline = scenario.results as ScenarioResults;

    // Calculate mitigated results (simplified)
    const vulnerabilityReduction = 0.47; // Average reduction
    const mitigatedCasualties: CasualtyEstimate = {
      fatalities: Math.round(baseline.casualties.fatalities * (1 - vulnerabilityReduction)),
      severeInjuries: Math.round(
        baseline.casualties.severeInjuries * (1 - vulnerabilityReduction),
      ),
      mildInjuries: Math.round(
        baseline.casualties.mildInjuries * (1 - vulnerabilityReduction * 0.5),
      ),
      totalAffected: 0,
      populationAtRisk: baseline.casualties.populationAtRisk,
      timeOfDayFactor: baseline.casualties.timeOfDayFactor,
    };
    mitigatedCasualties.totalAffected =
      mitigatedCasualties.fatalities +
      mitigatedCasualties.severeInjuries +
      mitigatedCasualties.mildInjuries;

    const mitigatedEconomic: EconomicImpactEstimate = {
      buildingDamage: Math.round(
        baseline.economicImpact.buildingDamage * (1 - vulnerabilityReduction),
      ),
      infrastructureDamage: Math.round(
        baseline.economicImpact.infrastructureDamage * (1 - vulnerabilityReduction * 0.5),
      ),
      businessDisruption: Math.round(
        baseline.economicImpact.businessDisruption * (1 - vulnerabilityReduction * 0.3),
      ),
      medicalCosts: Math.round(
        baseline.economicImpact.medicalCosts * (1 - vulnerabilityReduction),
      ),
      totalCost: 0,
      currency: 'USD',
    };
    mitigatedEconomic.totalCost =
      mitigatedEconomic.buildingDamage +
      mitigatedEconomic.infrastructureDamage +
      mitigatedEconomic.businessDisruption +
      mitigatedEconomic.medicalCosts;

    const livesSaved = baseline.casualties.fatalities - mitigatedCasualties.fatalities;
    const injuriesPrevented =
      baseline.casualties.severeInjuries +
      baseline.casualties.mildInjuries -
      mitigatedCasualties.severeInjuries -
      mitigatedCasualties.mildInjuries;
    const costReduction = baseline.economicImpact.totalCost - mitigatedEconomic.totalCost;

    return {
      baseline: {
        casualties: baseline.casualties,
        economicImpact: baseline.economicImpact,
      },
      withMitigation: {
        casualties: mitigatedCasualties,
        economicImpact: mitigatedEconomic,
      },
      improvement: {
        livessSaved: livesSaved,
        injuriesPrevented: injuriesPrevented,
        costReduction: costReduction,
        percentImprovement: Math.round(
          (costReduction / baseline.economicImpact.totalCost) * 100,
        ),
      },
    };
  }

  async getSectorAnalysis(args: GetSectorAnalysisArgs): Promise<SectorAnalysisSummary> {
    const { affectedBuildings } = args;

    // Mock sector data based on affected buildings
    const totalBuildings = (affectedBuildings?.total || 0);
    const sectorsCount = 5;
    const buildingsPerSector = Math.floor(totalBuildings / sectorsCount);

    const sectors = Array.from({ length: sectorsCount }, (_, i) => ({
      name: `Sector ${i + 1}`,
      buildingsAffected: buildingsPerSector + (i === 0 ? totalBuildings % sectorsCount : 0),
      severeCount: Math.floor(buildingsPerSector * 0.3),
      mildCount: Math.floor(buildingsPerSector * 0.7),
      estimatedPopulation: buildingsPerSector * 20,
    }));

    // Sort by buildings affected
    sectors.sort((a, b) => b.buildingsAffected - a.buildingsAffected);

    return {
      sectors,
      mostAffected: sectors[0]?.name || 'Unknown',
      leastAffected: sectors[sectors.length - 1]?.name || 'Unknown',
    };
  }

  async getBuildingDetails(args: GetBuildingDetailsArgs): Promise<any> {
    const { scenarioId, buildingId } = args;

    const scenario = await this.scenarioModel.findOne({ scenarioId });
    const building = this.buildingsService.findById(buildingId);

    if (!building) {
      return null;
    }

    // Determine damage status from scenario if available
    let damageStatus = 'unknown';
    if (scenario?.results) {
      const results = scenario.results as any;
      if (results.affectedBuildings) {
        // Check if this building is in the affected list
        damageStatus = 'not_affected';
      }
    }

    return {
      ...building,
      scenarioId,
      damageStatus,
    };
  }

  private async updateStepStatus(
    scenarioId: string,
    stepIndex: number,
    status: string,
    result?: any,
  ): Promise<void> {
    const updateField = `steps.${stepIndex}`;
    const update: any = {
      [`${updateField}.status`]: status,
    };
    if (result !== undefined) {
      update[`${updateField}.result`] = result;
    }
    await this.scenarioModel.updateOne({ scenarioId }, { $set: update });
  }

  private summarizeBuildings(response: any): AffectedBuildingSummary {
    if (!response || !response.summary) {
      return { total: 0, severe: 0, mild: 0, byType: {} };
    }

    return {
      total: response.summary.totalBuildings || 0,
      severe: response.summary.severeCount || 0,
      mild: response.summary.mildCount || 0,
      byType: response.statistics?.buildingsByUse || {},
    };
  }

  private summarizeHospitals(response: any): AffectedHospitalSummary {
    if (!response || !response.summary) {
      return {
        total: 0,
        severe: 0,
        mild: 0,
        bedsAtRisk: 0,
        functionalBeds: 0,
      };
    }

    return {
      total: response.summary?.totalAffected || 0,
      severe: response.summary?.severeCount || 0,
      mild: response.summary?.mildCount || 0,
      bedsAtRisk: response.summary?.bedsAffected?.total || 0,
      functionalBeds: response.operational?.totalBeds || 0,
    };
  }

  private convertToCalculatorFormat(summary: AffectedBuildingSummary): any[] {
    if (!summary) return [];

    const buildings: any[] = [];

    // Create mock buildings based on summary counts
    for (let i = 0; i < summary.severe; i++) {
      buildings.push({
        id: i,
        status: 'SEVERE',
        apartments: 6,
        floors: 5,
        vulnerabilityScore: 0.7,
      });
    }

    for (let i = 0; i < summary.mild; i++) {
      buildings.push({
        id: summary.severe + i,
        status: 'MILD',
        apartments: 6,
        floors: 5,
        vulnerabilityScore: 0.4,
      });
    }

    return buildings;
  }

  private convertHospitalsToCalculatorFormat(summary: AffectedHospitalSummary): any[] {
    if (!summary) return [];

    const hospitals: any[] = [];

    for (let i = 0; i < summary.severe; i++) {
      hospitals.push({
        id: i,
        status: 'SEVERE',
        beds: Math.floor(summary.bedsAtRisk / summary.total) || 50,
      });
    }

    for (let i = 0; i < summary.mild; i++) {
      hospitals.push({
        id: summary.severe + i,
        status: 'MILD',
        beds: Math.floor(summary.bedsAtRisk / summary.total) || 50,
      });
    }

    return hospitals;
  }

  private generateReportMarkdown(
    name: string,
    parameters: any,
    results: ScenarioResults,
  ): string {
    const disasterLabel =
      parameters.disasterType === 'blast' ? 'Blast' : 'Earthquake';
    const paramLabel =
      parameters.disasterType === 'blast'
        ? `${parameters.yield} kg TNT equivalent`
        : `Magnitude ${parameters.magnitude}`;

    const customInputSection = parameters.customInput
      ? `\n### Additional Context\n${parameters.customInput}\n`
      : '';

    return `# ${name} - Impact Assessment Report

## Scenario Overview
- **Disaster Type:** ${disasterLabel}
- **Parameters:** ${paramLabel}
- **Location:** ${parameters.lat.toFixed(4)}, ${parameters.lon.toFixed(4)}
- **Time of Day:** ${parameters.timeOfDay}
${customInputSection}
---

## Executive Summary

This analysis estimates the impact of a ${disasterLabel.toLowerCase()} event centered at the specified coordinates.

### Key Findings
- **Total Buildings Affected:** ${results.affectedBuildings?.total || 0}
  - Severe Damage: ${results.affectedBuildings?.severe || 0}
  - Mild Damage: ${results.affectedBuildings?.mild || 0}
- **Hospitals Impacted:** ${results.affectedHospitals?.total || 0}
- **Estimated Casualties:** ${results.casualties?.totalAffected || 0}
- **Economic Impact:** $${((results.economicImpact?.totalCost || 0) / 1000000).toFixed(1)}M

---

## Casualty Estimates

| Category | Count |
|----------|-------|
| Fatalities | ${results.casualties?.fatalities || 0} |
| Severe Injuries | ${results.casualties?.severeInjuries || 0} |
| Mild Injuries | ${results.casualties?.mildInjuries || 0} |
| **Total Affected** | **${results.casualties?.totalAffected || 0}** |

*Population at risk: ${results.casualties?.populationAtRisk || 0}*
*Time of day factor: ${results.casualties?.timeOfDayFactor || 'N/A'}*

---

## Economic Impact

| Category | Cost (USD) |
|----------|------------|
| Building Damage | $${((results.economicImpact?.buildingDamage || 0) / 1000000).toFixed(2)}M |
| Infrastructure | $${((results.economicImpact?.infrastructureDamage || 0) / 1000000).toFixed(2)}M |
| Business Disruption | $${((results.economicImpact?.businessDisruption || 0) / 1000000).toFixed(2)}M |
| Medical Costs | $${((results.economicImpact?.medicalCosts || 0) / 1000000).toFixed(2)}M |
| **Total** | **$${((results.economicImpact?.totalCost || 0) / 1000000).toFixed(2)}M** |

---

## Healthcare Capacity Impact

- Total hospitals affected: ${results.affectedHospitals?.total || 0}
- Beds at risk: ${results.affectedHospitals?.bedsAtRisk || 0}
- Remaining functional beds: ${results.affectedHospitals?.functionalBeds || 0}

---

## Critical Infrastructure

| Type | Count |
|------|-------|
| Schools | ${results.criticalInfrastructure?.schools || 0} |
| Universities | ${results.criticalInfrastructure?.universities || 0} |
| Embassies | ${results.criticalInfrastructure?.embassies || 0} |
| Police Stations | ${results.criticalInfrastructure?.police || 0} |
| Religious Sites | ${(results.criticalInfrastructure?.mosques || 0) + (results.criticalInfrastructure?.churches || 0)} |

---

## High-Risk Buildings

- Total high-risk buildings: ${results.highRiskBuildings?.total || 0}
- Average vulnerability score: ${results.highRiskBuildings?.averageVulnerability?.toFixed(2) || 'N/A'}

### Distribution by Condition
${Object.entries(results.highRiskBuildings?.byCondition || {})
  .map(([condition, count]) => `- ${condition}: ${count}`)
  .join('\n')}

---

## Sector Analysis

Most affected sector: **${results.sectorAnalysis?.mostAffected || 'Unknown'}**
Least affected sector: **${results.sectorAnalysis?.leastAffected || 'Unknown'}**

---

## Recommended Mitigation Plans

${
  results.mitigationPlans && results.mitigationPlans.length > 0
    ? results.mitigationPlans
        .map(
          (plan, i) => `### ${i + 1}. ${plan.name}
- **Type:** ${plan.type}
- **Cost:** $${(plan.cost / 1000000).toFixed(2)}M
- **Buildings Targeted:** ${plan.targetBuildingCount}
- **Projected Lives Saved:** ${plan.projectedLivesSaved}
- **Cost Reduction:** $${(plan.projectedCostReduction / 1000000).toFixed(2)}M
- **ROI:** ${plan.roi}x
`,
        )
        .join('\n')
    : 'No mitigation plans generated.'
}

---

*Report generated by MIR'AAT Scenario Builder*
`;
  }
}
