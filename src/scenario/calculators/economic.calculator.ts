import { Injectable } from '@nestjs/common';
import { EconomicImpactEstimate } from '../dto/scenario.dto';

interface BuildingData {
  id: number;
  status: 'SEVERE' | 'MILD';
  floors?: number;
  area?: number;
  buildingType?: string;
  condition?: string;
}

interface HospitalData {
  id: number;
  status: 'SEVERE' | 'MILD';
  beds?: number;
}

interface CriticalInfrastructureData {
  type: string;
  count: number;
}

interface AffectedData {
  buildings: BuildingData[];
}

interface AffectedHospitalsData {
  hospitals: HospitalData[];
}

interface CriticalInfrastructureSummary {
  items: CriticalInfrastructureData[];
}

@Injectable()
export class EconomicCalculator {
  // Cost per square meter for building replacement
  private readonly COST_PER_SQM = 2500;

  // Average floor area in square meters
  private readonly AVG_FLOOR_AREA = 200;

  // Damage cost ratios
  private readonly SEVERE_DAMAGE_RATIO = 1.0; // Full replacement
  private readonly MILD_DAMAGE_RATIO = 0.3; // Repair cost

  // Infrastructure costs (per unit)
  private readonly INFRASTRUCTURE_COSTS: Record<string, number> = {
    school: 5000000,
    university: 25000000,
    embassy: 15000000,
    police: 3000000,
    mosque: 2000000,
    church: 2000000,
    hospital: 50000000,
  };

  // Business disruption factor (months of lost revenue)
  private readonly BUSINESS_DISRUPTION_MONTHS = 6;
  private readonly AVG_BUSINESS_REVENUE_PER_BUILDING = 50000;

  // Medical costs per casualty type
  private readonly FATALITY_COST = 5000000; // Statistical value of life
  private readonly SEVERE_INJURY_COST = 500000;
  private readonly MILD_INJURY_COST = 50000;

  calculate(
    affectedBuildings: AffectedData,
    affectedHospitals: AffectedHospitalsData,
    criticalInfrastructure: CriticalInfrastructureSummary,
    casualties?: { fatalities: number; severeInjuries: number; mildInjuries: number },
  ): EconomicImpactEstimate {
    const buildingDamage = this.calculateBuildingDamage(affectedBuildings);
    const infrastructureDamage = this.calculateInfrastructureDamage(
      affectedHospitals,
      criticalInfrastructure,
    );
    const businessDisruption = this.calculateBusinessDisruption(affectedBuildings);
    const medicalCosts = casualties
      ? this.calculateMedicalCosts(casualties)
      : 0;

    const totalCost =
      buildingDamage + infrastructureDamage + businessDisruption + medicalCosts;

    return {
      buildingDamage: Math.round(buildingDamage),
      infrastructureDamage: Math.round(infrastructureDamage),
      businessDisruption: Math.round(businessDisruption),
      medicalCosts: Math.round(medicalCosts),
      totalCost: Math.round(totalCost),
      currency: 'USD',
    };
  }

  private calculateBuildingDamage(affectedBuildings: AffectedData): number {
    let totalDamage = 0;

    for (const building of affectedBuildings.buildings) {
      const buildingValue = this.estimateBuildingValue(building);
      const damageRatio =
        building.status === 'SEVERE'
          ? this.SEVERE_DAMAGE_RATIO
          : this.MILD_DAMAGE_RATIO;

      totalDamage += buildingValue * damageRatio;
    }

    return totalDamage;
  }

  private estimateBuildingValue(building: BuildingData): number {
    const floors = building.floors || 3;
    const area = building.area || this.AVG_FLOOR_AREA;
    const totalArea = floors * area;

    let baseValue = totalArea * this.COST_PER_SQM;

    // Adjust for building type
    const typeMultiplier = this.getBuildingTypeMultiplier(building.buildingType);
    baseValue *= typeMultiplier;

    // Adjust for condition (older buildings worth less)
    const conditionMultiplier = this.getConditionMultiplier(building.condition);
    baseValue *= conditionMultiplier;

    return baseValue;
  }

  private getBuildingTypeMultiplier(buildingType?: string): number {
    if (!buildingType) return 1.0;

    const multipliers: Record<string, number> = {
      hospital: 2.5,
      university: 2.0,
      embassy: 2.0,
      school: 1.5,
      police: 1.5,
      religious: 1.2,
      residential: 1.0,
      commercial: 1.3,
    };

    return multipliers[buildingType.toLowerCase()] || 1.0;
  }

  private getConditionMultiplier(condition?: string): number {
    if (!condition) return 1.0;

    const multipliers: Record<string, number> = {
      good: 1.0,
      fair: 0.8,
      poor: 0.6,
      critical: 0.4,
    };

    return multipliers[condition.toLowerCase()] || 1.0;
  }

  private calculateInfrastructureDamage(
    affectedHospitals: AffectedHospitalsData,
    criticalInfrastructure: CriticalInfrastructureSummary,
  ): number {
    let totalDamage = 0;

    // Hospital damage
    for (const hospital of affectedHospitals.hospitals) {
      const baseCost = this.INFRASTRUCTURE_COSTS.hospital;
      const damageRatio =
        hospital.status === 'SEVERE'
          ? this.SEVERE_DAMAGE_RATIO
          : this.MILD_DAMAGE_RATIO;
      totalDamage += baseCost * damageRatio;
    }

    // Other critical infrastructure
    for (const item of criticalInfrastructure.items) {
      const unitCost = this.INFRASTRUCTURE_COSTS[item.type.toLowerCase()] || 1000000;
      // Assume 50% severe damage for critical infrastructure
      totalDamage += unitCost * item.count * 0.5;
    }

    return totalDamage;
  }

  private calculateBusinessDisruption(affectedBuildings: AffectedData): number {
    // Estimate number of businesses based on building count
    const businessCount = Math.floor(affectedBuildings.buildings.length * 0.3);
    return (
      businessCount *
      this.AVG_BUSINESS_REVENUE_PER_BUILDING *
      this.BUSINESS_DISRUPTION_MONTHS
    );
  }

  private calculateMedicalCosts(casualties: {
    fatalities: number;
    severeInjuries: number;
    mildInjuries: number;
  }): number {
    return (
      casualties.fatalities * this.FATALITY_COST +
      casualties.severeInjuries * this.SEVERE_INJURY_COST +
      casualties.mildInjuries * this.MILD_INJURY_COST
    );
  }
}
