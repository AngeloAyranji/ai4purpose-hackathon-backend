import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import {
  BuildingProperties,
  BuildingResult,
  AffectedBuildingsResponse,
} from './dto/affected-buildings.dto';
import { BuildingStatus } from '../common/enums/status.enum';
import { DisasterType } from '../common/enums/disaster-type.enum';

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

  findByRadius(
    lon: number,
    lat: number,
    radiusMeters: number,
    severeRadiusMeters: number,
  ): AffectedBuildingsResponse {
    const centerPoint = turf.point([lon, lat]);
    const radiusKm = radiusMeters / 1000;
    const buffer = turf.buffer(centerPoint, radiusKm, { units: 'kilometers' });

    if (!buffer) {
      return {
        type: DisasterType.RADIUS,
        center: { lon, lat },
        parameters: { radius: radiusMeters, severeRadius: severeRadiusMeters },
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

          // Determine status based on distance
          const status = distanceMeters <= severeRadiusMeters
            ? BuildingStatus.SEVERE
            : BuildingStatus.MILD;

          if (status === BuildingStatus.SEVERE) {
            severeCount++;
          } else {
            mildCount++;
          }

          affectedBuildings.push({
            id: buildingId,
            apartments: apartments,
            status: status,
          });

          if (apartments !== null && apartments > 0) {
            totalApartments += apartments;
          }
        }
      } catch (error) {
        continue;
      }
    }

    return {
      type: DisasterType.RADIUS,
      center: { lon, lat },
      parameters: { radius: radiusMeters, severeRadius: severeRadiusMeters },
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
  ): AffectedBuildingsResponse {
    // Calculate affected radii based on magnitude
    const severeRadiusKm = Math.pow(10, 0.5 * magnitude - 2.5);
    const mildRadiusKm = Math.pow(10, 0.5 * magnitude - 1.8);

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

          // Determine status based on distance from epicenter
          const status = distanceKm <= severeRadiusKm
            ? BuildingStatus.SEVERE
            : BuildingStatus.MILD;

          if (status === BuildingStatus.SEVERE) {
            severeCount++;
          } else {
            mildCount++;
          }

          affectedBuildings.push({
            id: buildingId,
            apartments: apartments,
            status: status,
          });

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
