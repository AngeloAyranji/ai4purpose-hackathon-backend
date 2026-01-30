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

  findAffectedBuildings(
    lon: number,
    lat: number,
    radiusMeters: number,
  ): AffectedBuildingsResponse {
    // Create a point from the coordinates
    const centerPoint = turf.point([lon, lat]);

    // Create a buffer circle around the point (radius in kilometers)
    const radiusKm = radiusMeters / 1000;
    const buffer = turf.buffer(centerPoint, radiusKm, { units: 'kilometers' });

    if (!buffer) {
      return {
        center: { lon, lat },
        radius_meters: radiusMeters,
        total_buildings: 0,
        total_apartments: 0,
        buildings: [],
      };
    }

    // Find all buildings that intersect with the buffer
    const affectedBuildings: BuildingResult[] = [];
    let totalApartments = 0;

    for (const feature of this.geojsonData.features) {
      try {
        // Check if the building polygon intersects with the buffer
        if (turf.booleanIntersects(feature as Feature, buffer)) {
          const props = feature.properties;
          const buildingId = props.BULBuildingID;

          // Handle -999 as "not available" (treat as null, count as 0)
          const apartments =
            props.NoofApartments === -999 ? null : props.NoofApartments;

          affectedBuildings.push({
            id: buildingId,
            apartments: apartments,
          });

          // Add to total (treat null/negative as 0)
          if (apartments !== null && apartments > 0) {
            totalApartments += apartments;
          }
        }
      } catch (error) {
        // Skip invalid geometries
        continue;
      }
    }

    return {
      center: { lon, lat },
      radius_meters: radiusMeters,
      total_buildings: affectedBuildings.length,
      total_apartments: totalApartments,
      buildings: affectedBuildings,
    };
  }
}
