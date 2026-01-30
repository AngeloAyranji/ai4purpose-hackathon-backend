import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import {
  BuildingProperties,
  BuildingResult,
  AffectedBuildingsResponse,
  VulnerabilityFactors,
  Statistics,
  BuildingTypeCount,
  BuildingsByUse,
  BuildingsByCondition,
} from './dto/affected-buildings.dto';
import { BuildingStatus } from '../common/enums/status.enum';
import { DisasterType } from '../common/enums/disaster-type.enum';

const CONDITION_SCORES: Record<string, number> = {
  'Evicted Building': 1.0,
  'Old threat of Eviction': 0.9,
  'Old-Bldg-Inhabited': 0.8,
  'Construction on-Hold': 0.6,
  'Cancelled Construction': 0.5,
  'Under Construction': 0.5,
  'Empty Lot': 0.3,
  'Demolished': 0.3,
  'Not Available': 0.5,
  'Non-Residential Building': 0.3,
  'Parking Lot': 0.2,
  'Complete Residential': 0.2,
  'Renovated': 0.1,
};

const USE_TYPE_SCORES: Record<string, number> = {
  'Run down': 1.0,
  'Building is not available': 0.7,
  'Religious': 0.7,
  'Industrial': 0.6,
  'Silos': 0.6,
  'Recreational': 0.5,
  'Not Available': 0.5,
  'Construction Site': 0.5,
  'Residential': 0.4,
  'Commercial': 0.4,
  'Mixed-use': 0.4,
  'Institutional': 0.3,
  'Parking': 0.2,
};

@Injectable()
export class BuildingsService implements OnModuleInit {
  private readonly logger = new Logger(BuildingsService.name);
  private geojsonData: FeatureCollection<Geometry, BuildingProperties>;

  onModuleInit() {
    this.loadGeoJSON();
  }

  private loadGeoJSON() {
    const filePath = path.join(process.cwd(), 'datasets', 'beirut-buildings.geojson');

    this.logger.log(`Loading GeoJSON from: ${filePath}`);

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      this.geojsonData = JSON.parse(fileContent);
      this.logger.log(
        `Loaded ${this.geojsonData.features.length} building features`,
      );
    } catch (error) {
      this.logger.error(`Failed to load GeoJSON: ${error.message}`);
      throw error;
    }
  }

  private calculateAgeScore(yearCompleted: number | undefined): number {
    if (yearCompleted === undefined || yearCompleted === -999) return 0.5;
    const age = 2026 - yearCompleted;
    return Math.min(Math.max(age / 100, 0), 1.0);
  }

  private calculateHeightScore(floors: number | undefined): number {
    if (floors === undefined || floors === -999) return 0.5;
    return Math.min(floors / 30, 1.0);
  }

  private calculateVulnerabilityFactors(props: BuildingProperties): VulnerabilityFactors {
    return {
      age: this.calculateAgeScore(props.YearCompleted),
      height: this.calculateHeightScore(props.NoofFloor),
      condition: CONDITION_SCORES[props.Status2022 ?? ''] ?? 0.5,
      useType: USE_TYPE_SCORES[props.Building_Use ?? ''] ?? 0.5,
    };
  }

  private calculateVulnerabilityScore(factors: VulnerabilityFactors): number {
    return (
      0.30 * factors.age +
      0.25 * factors.height +
      0.30 * factors.condition +
      0.15 * factors.useType
    );
  }

  private createEmptyBuildingTypeCount(): BuildingTypeCount {
    return { total: 0, severe: 0, mild: 0 };
  }

  private mapBuildingUseToCategory(buildingUse: string | undefined): keyof BuildingsByUse {
    if (!buildingUse) return 'other';
    const use = buildingUse.toLowerCase();
    if (use.includes('residential')) return 'residential';
    if (use.includes('commercial')) return 'commercial';
    if (use.includes('industrial') || use.includes('silos')) return 'industrial';
    if (use.includes('institutional')) return 'institutional';
    if (use.includes('mixed')) return 'mixedUse';
    if (use.includes('religious')) return 'religious';
    if (use.includes('construction')) return 'constructionSite';
    return 'other';
  }

  private mapConditionToCategory(status: string | undefined): keyof BuildingsByCondition {
    if (!status) return 'other';
    const s = status.toLowerCase();
    if (s.includes('complete') || s.includes('parking')) return 'complete';
    if (s.includes('under construction') || s.includes('construction on-hold') || s.includes('cancelled construction')) return 'underConstruction';
    if (s.includes('evicted') || s.includes('threat of eviction')) return 'evicted';
    if (s.includes('demolished')) return 'demolished';
    if (s.includes('renovated')) return 'renovated';
    if (s.includes('empty lot')) return 'emptyLot';
    return 'other';
  }

  private calculateStatistics(
    buildings: BuildingResult[],
    buildingProps: BuildingProperties[],
    includeVulnerability: boolean,
  ): Statistics {
    // Initialize accumulators
    const buildingsByUse: BuildingsByUse = {
      residential: this.createEmptyBuildingTypeCount(),
      commercial: this.createEmptyBuildingTypeCount(),
      industrial: this.createEmptyBuildingTypeCount(),
      institutional: this.createEmptyBuildingTypeCount(),
      mixedUse: this.createEmptyBuildingTypeCount(),
      religious: this.createEmptyBuildingTypeCount(),
      constructionSite: this.createEmptyBuildingTypeCount(),
      other: this.createEmptyBuildingTypeCount(),
    };

    const buildingsByCondition: BuildingsByCondition = {
      complete: this.createEmptyBuildingTypeCount(),
      underConstruction: this.createEmptyBuildingTypeCount(),
      evicted: this.createEmptyBuildingTypeCount(),
      demolished: this.createEmptyBuildingTypeCount(),
      renovated: this.createEmptyBuildingTypeCount(),
      emptyLot: this.createEmptyBuildingTypeCount(),
      other: this.createEmptyBuildingTypeCount(),
    };

    let totalApartments = 0;
    let severeApartments = 0;
    let mildApartments = 0;
    let residentialBuildings = 0;

    let totalFloors = 0;
    let maxFloors = 0;
    let buildingsWithFloors = 0;
    let buildingsAbove10Floors = 0;

    const years: number[] = [];
    const sectors = new Set<string>();

    // Vulnerability tracking
    let vulnerabilitySum = 0;
    let maxVulnerability = 0;
    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;

    for (let i = 0; i < buildings.length; i++) {
      const building = buildings[i];
      const props = buildingProps[i];
      const isSevere = building.status === BuildingStatus.SEVERE;

      // Building use category
      const useCategory = this.mapBuildingUseToCategory(props.Building_Use);
      buildingsByUse[useCategory].total++;
      if (isSevere) {
        buildingsByUse[useCategory].severe++;
      } else {
        buildingsByUse[useCategory].mild++;
      }

      // Building condition category
      const conditionCategory = this.mapConditionToCategory(props.Status2022);
      buildingsByCondition[conditionCategory].total++;
      if (isSevere) {
        buildingsByCondition[conditionCategory].severe++;
      } else {
        buildingsByCondition[conditionCategory].mild++;
      }

      // Apartments and residential tracking
      const apartments = props.NoofApartments !== -999 ? props.NoofApartments : 0;
      if (apartments > 0) {
        totalApartments += apartments;
        if (isSevere) {
          severeApartments += apartments;
        } else {
          mildApartments += apartments;
        }
      }

      // Count residential buildings (by use type or having apartments)
      if (useCategory === 'residential' || useCategory === 'mixedUse' || apartments > 0) {
        residentialBuildings++;
      }

      // Floor tracking
      const floors = props.NoofFloor;
      if (floors !== undefined && floors !== -999 && floors > 0) {
        totalFloors += floors;
        buildingsWithFloors++;
        if (floors > maxFloors) maxFloors = floors;
        if (floors > 10) buildingsAbove10Floors++;
      }

      // Year tracking
      const year = props.YearCompleted;
      if (year !== undefined && year !== -999 && year > 1800 && year <= 2026) {
        years.push(year);
      }

      // Sector tracking
      const sector = props.Sector_Name;
      if (sector && sector !== 'Not Available') {
        sectors.add(sector);
      }

      // Vulnerability tracking
      if (includeVulnerability && building.vulnerabilityScore !== undefined) {
        const score = building.vulnerabilityScore;
        vulnerabilitySum += score;
        if (score > maxVulnerability) maxVulnerability = score;
        if (score >= 0.7) highRisk++;
        else if (score >= 0.4) mediumRisk++;
        else lowRisk++;
      }
    }

    // Calculate averages
    const avgFloors = buildingsWithFloors > 0 ? Math.round((totalFloors / buildingsWithFloors) * 10) / 10 : 0;
    const avgBuildingAge = years.length > 0
      ? Math.round((years.reduce((sum, y) => sum + (2026 - y), 0) / years.length) * 10) / 10
      : null;
    const oldestBuilding = years.length > 0 ? Math.min(...years) : null;
    const newestBuilding = years.length > 0 ? Math.max(...years) : null;

    // Population estimates (3.5 persons per apartment average)
    const estimatedResidents = Math.round(totalApartments * 3.5);
    const estimatedResidentsSevere = Math.round(severeApartments * 3.5);
    const estimatedResidentsMild = Math.round(mildApartments * 3.5);

    const statistics: Statistics = {
      populationImpact: {
        estimatedResidents,
        estimatedResidentsSevere,
        estimatedResidentsMild,
        residentialUnits: totalApartments,
        residentialBuildings,
      },
      buildingsByUse,
      buildingsByCondition,
      structuralAnalysis: {
        avgFloors,
        maxFloors,
        totalFloors,
        buildingsAbove10Floors,
        avgBuildingAge,
        oldestBuilding,
        newestBuilding,
      },
      affectedAreas: {
        sectors: Array.from(sectors).sort(),
        sectorCount: sectors.size,
      },
    };

    if (includeVulnerability && buildings.length > 0) {
      statistics.vulnerabilityDistribution = {
        highRisk,
        mediumRisk,
        lowRisk,
        avgScore: Math.round((vulnerabilitySum / buildings.length) * 1000) / 1000,
        maxScore: Math.round(maxVulnerability * 1000) / 1000,
      };
    }

    return statistics;
  }

  private determineStatusWithVulnerability(
    distanceMeters: number,
    severeRadiusMeters: number,
    vulnerabilityScore: number,
  ): BuildingStatus {
    const expansionFactor = 1 + (vulnerabilityScore - 0.5);
    const adjustedSevereRadius = severeRadiusMeters * expansionFactor;

    if (distanceMeters <= adjustedSevereRadius) {
      return BuildingStatus.SEVERE;
    }
    return BuildingStatus.MILD;
  }

  findByBlast(
    lon: number,
    lat: number,
    yieldKg: number,
    includeVulnerability: boolean = false,
  ): AffectedBuildingsResponse {
    // Hopkinson-Cranz cube-root scaling law
    const cubeRoot = Math.pow(yieldKg, 1 / 3);
    const severeRadiusMeters = 5 * cubeRoot;  // ~5 psi - structural collapse
    const mildRadiusMeters = 20 * cubeRoot;   // ~1 psi - heavy damage

    const centerPoint = turf.point([lon, lat]);
    const mildRadiusKm = mildRadiusMeters / 1000;
    const buffer = turf.buffer(centerPoint, mildRadiusKm, { units: 'kilometers' });

    const emptyStatistics = this.calculateStatistics([], [], includeVulnerability);

    if (!buffer) {
      return {
        type: DisasterType.BLAST,
        center: { lon, lat },
        parameters: { yield: yieldKg, severeRadius: severeRadiusMeters, mildRadius: mildRadiusMeters },
        summary: {
          totalBuildings: 0,
          totalApartments: 0,
          severeCount: 0,
          mildCount: 0,
        },
        statistics: emptyStatistics,
        buildings: [],
      };
    }

    const affectedBuildings: BuildingResult[] = [];
    const affectedBuildingProps: BuildingProperties[] = [];
    let totalApartments = 0;
    let severeCount = 0;
    let mildCount = 0;

    for (const feature of this.geojsonData.features) {
      try {
        if (turf.booleanIntersects(feature as Feature, buffer)) {
          const props = feature.properties;
          const buildingId = props.BULBuildingID;

          const apartments =
            props.NoofApartments === -999 ? null : props.NoofApartments;

          // Calculate distance from center to building centroid
          const centroid = turf.centroid(feature as Feature);
          const distanceKm = turf.distance(centerPoint, centroid, { units: 'kilometers' });
          const distanceMeters = distanceKm * 1000;

          let status: BuildingStatus;
          let vulnerabilityScore: number | undefined;
          let vulnerabilityFactors: VulnerabilityFactors | undefined;

          if (includeVulnerability) {
            vulnerabilityFactors = this.calculateVulnerabilityFactors(props);
            vulnerabilityScore = this.calculateVulnerabilityScore(vulnerabilityFactors);
            status = this.determineStatusWithVulnerability(
              distanceMeters,
              severeRadiusMeters,
              vulnerabilityScore,
            );
          } else {
            status = distanceMeters <= severeRadiusMeters
              ? BuildingStatus.SEVERE
              : BuildingStatus.MILD;
          }

          if (status === BuildingStatus.SEVERE) {
            severeCount++;
          } else {
            mildCount++;
          }

          const buildingResult: BuildingResult = {
            id: buildingId,
            apartments: apartments,
            status: status,
          };

          if (includeVulnerability) {
            buildingResult.vulnerabilityScore = vulnerabilityScore;
            buildingResult.vulnerabilityFactors = vulnerabilityFactors;
          }

          affectedBuildings.push(buildingResult);
          affectedBuildingProps.push(props);

          if (apartments !== null && apartments > 0) {
            totalApartments += apartments;
          }
        }
      } catch (error) {
        continue;
      }
    }

    const statistics = this.calculateStatistics(affectedBuildings, affectedBuildingProps, includeVulnerability);

    return {
      type: DisasterType.BLAST,
      center: { lon, lat },
      parameters: { yield: yieldKg, severeRadius: severeRadiusMeters, mildRadius: mildRadiusMeters },
      summary: {
        totalBuildings: affectedBuildings.length,
        totalApartments: totalApartments,
        severeCount: severeCount,
        mildCount: mildCount,
      },
      statistics,
      buildings: affectedBuildings,
    };
  }

  findByEarthquake(
    lon: number,
    lat: number,
    magnitude: number,
    includeVulnerability: boolean = false,
  ): AffectedBuildingsResponse {
    // Calculate affected radii based on magnitude
    const severeRadiusKm = Math.pow(10, 0.5 * magnitude - 2.5);
    const mildRadiusKm = Math.pow(10, 0.5 * magnitude - 1.8);
    const severeRadiusMeters = severeRadiusKm * 1000;

    const centerPoint = turf.point([lon, lat]);
    const buffer = turf.buffer(centerPoint, mildRadiusKm, { units: 'kilometers' });

    const emptyStatistics = this.calculateStatistics([], [], includeVulnerability);

    if (!buffer) {
      return {
        type: DisasterType.EARTHQUAKE,
        center: { lon, lat },
        parameters: { magnitude },
        summary: {
          totalBuildings: 0,
          totalApartments: 0,
          severeCount: 0,
          mildCount: 0,
        },
        statistics: emptyStatistics,
        buildings: [],
      };
    }

    const affectedBuildings: BuildingResult[] = [];
    const affectedBuildingProps: BuildingProperties[] = [];
    let totalApartments = 0;
    let severeCount = 0;
    let mildCount = 0;

    for (const feature of this.geojsonData.features) {
      try {
        if (turf.booleanIntersects(feature as Feature, buffer)) {
          const props = feature.properties;
          const buildingId = props.BULBuildingID;

          const apartments =
            props.NoofApartments === -999 ? null : props.NoofApartments;

          // Calculate distance from center to building centroid
          const centroid = turf.centroid(feature as Feature);
          const distanceKm = turf.distance(centerPoint, centroid, { units: 'kilometers' });
          const distanceMeters = distanceKm * 1000;

          let status: BuildingStatus;
          let vulnerabilityScore: number | undefined;
          let vulnerabilityFactors: VulnerabilityFactors | undefined;

          if (includeVulnerability) {
            vulnerabilityFactors = this.calculateVulnerabilityFactors(props);
            vulnerabilityScore = this.calculateVulnerabilityScore(vulnerabilityFactors);
            status = this.determineStatusWithVulnerability(
              distanceMeters,
              severeRadiusMeters,
              vulnerabilityScore,
            );
          } else {
            status = distanceKm <= severeRadiusKm
              ? BuildingStatus.SEVERE
              : BuildingStatus.MILD;
          }

          if (status === BuildingStatus.SEVERE) {
            severeCount++;
          } else {
            mildCount++;
          }

          const buildingResult: BuildingResult = {
            id: buildingId,
            apartments: apartments,
            status: status,
          };

          if (includeVulnerability) {
            buildingResult.vulnerabilityScore = vulnerabilityScore;
            buildingResult.vulnerabilityFactors = vulnerabilityFactors;
          }

          affectedBuildings.push(buildingResult);
          affectedBuildingProps.push(props);

          if (apartments !== null && apartments > 0) {
            totalApartments += apartments;
          }
        }
      } catch (error) {
        continue;
      }
    }

    const statistics = this.calculateStatistics(affectedBuildings, affectedBuildingProps, includeVulnerability);

    return {
      type: DisasterType.EARTHQUAKE,
      center: { lon, lat },
      parameters: { magnitude },
      summary: {
        totalBuildings: affectedBuildings.length,
        totalApartments: totalApartments,
        severeCount: severeCount,
        mildCount: mildCount,
      },
      statistics,
      buildings: affectedBuildings,
    };
  }
}
