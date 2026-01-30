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
        buildings: [],
      };
    }

    const affectedBuildings: BuildingResult[] = [];
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

          if (apartments !== null && apartments > 0) {
            totalApartments += apartments;
          }
        }
      } catch (error) {
        continue;
      }
    }

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
        buildings: [],
      };
    }

    const affectedBuildings: BuildingResult[] = [];
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

          if (apartments !== null && apartments > 0) {
            totalApartments += apartments;
          }
        }
      } catch (error) {
        continue;
      }
    }

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
      buildings: affectedBuildings,
    };
  }
}
