import { Injectable } from '@nestjs/common';
import { MitigationPlanSummary } from '../dto/scenario.dto';
import { v4 as uuidv4 } from 'uuid';

interface HighRiskBuilding {
  id: number;
  vulnerabilityScore: number;
  condition: string;
  floors: number;
  sector?: string;
}

interface HighRiskBuildingsData {
  buildings: HighRiskBuilding[];
  total: number;
  averageVulnerability: number;
}

interface MitigationOption {
  type: string;
  name: string;
  vulnerabilityReduction: number;
  costPerFloor: number;
  applicableConditions: string[];
}

@Injectable()
export class MitigationCalculator {
  // Statistical value of a life for ROI calculation
  private readonly VALUE_OF_LIFE = 5000000;

  // Average vulnerability reduction from reinforcement
  private readonly AVG_VULNERABILITY_REDUCTION = 0.47;

  // Mitigation options
  private readonly MITIGATION_OPTIONS: MitigationOption[] = [
    {
      type: 'structural_reinforcement',
      name: 'Structural Reinforcement',
      vulnerabilityReduction: 0.5,
      costPerFloor: 75000,
      applicableConditions: ['poor', 'fair', 'critical'],
    },
    {
      type: 'seismic_retrofit',
      name: 'Seismic Retrofit',
      vulnerabilityReduction: 0.6,
      costPerFloor: 100000,
      applicableConditions: ['poor', 'fair', 'critical', 'good'],
    },
    {
      type: 'foundation_strengthening',
      name: 'Foundation Strengthening',
      vulnerabilityReduction: 0.4,
      costPerFloor: 50000,
      applicableConditions: ['poor', 'critical'],
    },
    {
      type: 'evacuation_infrastructure',
      name: 'Evacuation Infrastructure',
      vulnerabilityReduction: 0.2,
      costPerFloor: 25000,
      applicableConditions: ['poor', 'fair', 'critical', 'good'],
    },
  ];

  generatePlans(
    highRiskBuildings: HighRiskBuildingsData,
    budget?: number,
  ): MitigationPlanSummary[] {
    const plans: MitigationPlanSummary[] = [];

    // Generate a plan for each mitigation type
    for (const option of this.MITIGATION_OPTIONS) {
      const applicableBuildings = highRiskBuildings.buildings.filter(
        (b) =>
          option.applicableConditions.includes(b.condition?.toLowerCase() || 'fair'),
      );

      if (applicableBuildings.length === 0) continue;

      // Calculate costs and benefits
      const totalCost = this.calculateTotalCost(applicableBuildings, option);
      const livesSaved = this.estimateLivesSaved(
        applicableBuildings,
        option.vulnerabilityReduction,
      );
      const costReduction = this.estimateCostReduction(
        applicableBuildings,
        option.vulnerabilityReduction,
      );
      const roi = (livesSaved * this.VALUE_OF_LIFE) / totalCost;

      // Skip if over budget
      if (budget && totalCost > budget) continue;

      plans.push({
        id: uuidv4(),
        name: option.name,
        type: option.type,
        cost: Math.round(totalCost),
        targetBuildingCount: applicableBuildings.length,
        projectedLivesSaved: Math.round(livesSaved),
        projectedCostReduction: Math.round(costReduction),
        roi: Math.round(roi * 100) / 100,
      });
    }

    // Sort by ROI descending
    plans.sort((a, b) => b.roi - a.roi);

    return plans;
  }

  calculateReinforcementCost(building: HighRiskBuilding): number {
    const floors = building.floors || 3;
    const baseOption = this.MITIGATION_OPTIONS[0]; // Structural reinforcement

    let costMultiplier = 1.0;

    // Adjust for condition
    switch (building.condition?.toLowerCase()) {
      case 'critical':
        costMultiplier = 1.5;
        break;
      case 'poor':
        costMultiplier = 1.3;
        break;
      case 'fair':
        costMultiplier = 1.0;
        break;
      case 'good':
        costMultiplier = 0.8;
        break;
      default:
        costMultiplier = 1.0;
    }

    return floors * baseOption.costPerFloor * costMultiplier;
  }

  calculateAdjustedVulnerability(
    originalScore: number,
    mitigationType: string,
  ): number {
    const option = this.MITIGATION_OPTIONS.find((o) => o.type === mitigationType);
    if (!option) return originalScore;

    const reduction = option.vulnerabilityReduction;
    const newScore = originalScore * (1 - reduction);

    // Ensure score doesn't go below 0
    return Math.max(0, Math.round(newScore * 100) / 100);
  }

  private calculateTotalCost(
    buildings: HighRiskBuilding[],
    option: MitigationOption,
  ): number {
    let totalCost = 0;

    for (const building of buildings) {
      const floors = building.floors || 3;
      let costMultiplier = 1.0;

      switch (building.condition?.toLowerCase()) {
        case 'critical':
          costMultiplier = 1.5;
          break;
        case 'poor':
          costMultiplier = 1.3;
          break;
        case 'fair':
          costMultiplier = 1.0;
          break;
        case 'good':
          costMultiplier = 0.8;
          break;
      }

      totalCost += floors * option.costPerFloor * costMultiplier;
    }

    return totalCost;
  }

  private estimateLivesSaved(
    buildings: HighRiskBuilding[],
    vulnerabilityReduction: number,
  ): number {
    // Estimate based on population at risk and vulnerability reduction
    // Assume 3.2 people per apartment, 2 apartments per floor
    const populationPerBuilding = 3.2 * 2;
    const totalPopulation = buildings.reduce(
      (sum, b) => sum + (b.floors || 3) * populationPerBuilding,
      0,
    );

    // Average mortality rate in severe damage zone: 15%
    // Vulnerability reduction directly reduces mortality
    const mortalityReduction = 0.15 * vulnerabilityReduction;

    return totalPopulation * mortalityReduction;
  }

  private estimateCostReduction(
    buildings: HighRiskBuilding[],
    vulnerabilityReduction: number,
  ): number {
    // Estimate damage cost reduction
    const avgFloors =
      buildings.reduce((sum, b) => sum + (b.floors || 3), 0) / buildings.length;
    const avgBuildingValue = avgFloors * 200 * 2500; // floors * area/floor * cost/sqm
    const totalBuildingValue = avgBuildingValue * buildings.length;

    // Damage reduction proportional to vulnerability reduction
    return totalBuildingValue * vulnerabilityReduction * 0.5;
  }
}
