import { Injectable } from '@nestjs/common';
import { CasualtyEstimate } from '../dto/scenario.dto';

interface BuildingData {
  id: number;
  status: 'SEVERE' | 'MILD';
  apartments?: number;
  floors?: number;
  vulnerabilityScore?: number;
}

interface AffectedBuildingsData {
  buildings: BuildingData[];
  summary?: {
    totalBuildings: number;
    severeCount: number;
    mildCount: number;
  };
}

@Injectable()
export class CasualtyCalculator {
  // Average population per apartment
  private readonly POPULATION_PER_APARTMENT = 3.2;

  // Mortality and injury rates for severe damage
  private readonly SEVERE_MORTALITY_RATE = 0.15;
  private readonly SEVERE_INJURY_RATE = 0.4;

  // Injury rate for mild damage
  private readonly MILD_INJURY_RATE = 0.1;

  // Time of day multipliers (occupancy factor)
  private readonly TIME_OF_DAY_MULTIPLIERS: Record<string, number> = {
    night: 0.95, // Most people home
    afternoon: 0.85, // Many home, some at work
    morning: 0.7, // Many at work/school
  };

  calculate(
    affectedBuildings: AffectedBuildingsData,
    timeOfDay: string = 'afternoon',
  ): CasualtyEstimate {
    const timeMultiplier =
      this.TIME_OF_DAY_MULTIPLIERS[timeOfDay] ||
      this.TIME_OF_DAY_MULTIPLIERS.afternoon;

    let totalPopulationAtRisk = 0;
    let fatalities = 0;
    let severeInjuries = 0;
    let mildInjuries = 0;

    for (const building of affectedBuildings.buildings) {
      const population = this.estimateBuildingPopulation(building);
      const occupiedPopulation = population * timeMultiplier;

      totalPopulationAtRisk += occupiedPopulation;

      if (building.status === 'SEVERE') {
        // Severe damage: high mortality and injury rates
        const damageMultiplier = this.getDamageMultiplier(
          building.vulnerabilityScore,
        );
        fatalities += occupiedPopulation * this.SEVERE_MORTALITY_RATE * damageMultiplier;
        severeInjuries += occupiedPopulation * this.SEVERE_INJURY_RATE * damageMultiplier;
      } else {
        // Mild damage: lower injury rate, minimal fatalities
        mildInjuries += occupiedPopulation * this.MILD_INJURY_RATE;
      }
    }

    // Round to whole numbers
    fatalities = Math.round(fatalities);
    severeInjuries = Math.round(severeInjuries);
    mildInjuries = Math.round(mildInjuries);
    totalPopulationAtRisk = Math.round(totalPopulationAtRisk);

    return {
      fatalities,
      severeInjuries,
      mildInjuries,
      totalAffected: fatalities + severeInjuries + mildInjuries,
      populationAtRisk: totalPopulationAtRisk,
      timeOfDayFactor: timeMultiplier,
    };
  }

  private estimateBuildingPopulation(building: BuildingData): number {
    // Use apartments if available, otherwise estimate from floors
    if (building.apartments && building.apartments > 0) {
      return building.apartments * this.POPULATION_PER_APARTMENT;
    }

    // Estimate: 2 apartments per floor on average
    const floors = building.floors || 3;
    const estimatedApartments = floors * 2;
    return estimatedApartments * this.POPULATION_PER_APARTMENT;
  }

  private getDamageMultiplier(vulnerabilityScore?: number): number {
    // Higher vulnerability = more casualties
    if (!vulnerabilityScore) return 1.0;

    // Vulnerability score typically 0-1, higher is more vulnerable
    // Multiplier ranges from 0.8 to 1.5
    return 0.8 + vulnerabilityScore * 0.7;
  }
}
