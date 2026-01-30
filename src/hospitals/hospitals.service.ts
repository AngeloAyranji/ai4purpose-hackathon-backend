import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';
import type { FeatureCollection, Geometry } from 'geojson';
import { BuildingStatus } from '../common/enums/status.enum';
import { DisasterType } from '../common/enums/disaster-type.enum';
import {
  HospitalListResponse,
  HospitalDetail,
  NearestHospitalsResponse,
  AffectedHospitalsResponse,
  HospitalBeds,
  BuildingData,
  BedsAffectedByType,
} from './dto/hospital.dto';

interface HospitalData {
  Name: string;
  Type: string;
  'Name(ar)': string;
  Caza: string;
  Phone: string;
  latitude: string;
  longitude: string;
  formatted_address: string;
  BULBuildingID: number;
  cadastral: string;
  sector: string;
  medicineBeds: number | null;
  obgynBeds: number | null;
  icuCcuBeds: number | null;
  surgeryBeds: number | null;
  pediatricsBeds: number | null;
}

interface BuildingProperties {
  BULBuildingID: number;
  NoofFloor?: number;
  NoofApartments?: number;
  Status2022?: string;
  YearCompleted?: number;
  Building_Hight_m?: number;
  Building_Use?: string;
  Sector_Name?: string;
  Cadastral?: string;
}

@Injectable()
export class HospitalsService implements OnModuleInit {
  private readonly logger = new Logger(HospitalsService.name);
  private hospitals: HospitalData[] = [];
  private buildingsData: FeatureCollection<Geometry, BuildingProperties>;

  onModuleInit() {
    this.loadHospitals();
    this.loadBuildings();
  }

  private loadHospitals() {
    const filePath = path.join(process.cwd(), 'datasets', 'beirut-hospitals.json');
    this.logger.log(`Loading hospitals from: ${filePath}`);

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      this.hospitals = JSON.parse(fileContent);
      this.logger.log(`Loaded ${this.hospitals.length} hospitals`);
    } catch (error) {
      this.logger.error(`Failed to load hospitals: ${error.message}`);
      throw error;
    }
  }

  private loadBuildings() {
    const filePath = path.join(process.cwd(), 'datasets', 'beirut-buildings.geojson');
    this.logger.log(`Loading buildings from: ${filePath}`);

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      this.buildingsData = JSON.parse(fileContent);
      this.logger.log(`Loaded ${this.buildingsData.features.length} buildings`);
    } catch (error) {
      this.logger.error(`Failed to load buildings: ${error.message}`);
      throw error;
    }
  }

  private calculateTotalBeds(hospital: HospitalData): number {
    return (
      (hospital.medicineBeds || 0) +
      (hospital.obgynBeds || 0) +
      (hospital.icuCcuBeds || 0) +
      (hospital.surgeryBeds || 0) +
      (hospital.pediatricsBeds || 0)
    );
  }

  private getBeds(hospital: HospitalData): HospitalBeds {
    return {
      medicine: hospital.medicineBeds,
      obgyn: hospital.obgynBeds,
      icuCcu: hospital.icuCcuBeds,
      surgery: hospital.surgeryBeds,
      pediatrics: hospital.pediatricsBeds,
      total: this.calculateTotalBeds(hospital),
    };
  }

  private cleanValue<T>(value: T, invalidValues: (string | number | null)[] = ['Not Available', 'Not Available Info', -999, null]): T | undefined {
    return invalidValues.includes(value as string | number | null) ? undefined : value;
  }

  private findBuildingById(buildingId: number): BuildingData | null {
    const feature = this.buildingsData.features.find(
      (f) => f.properties.BULBuildingID === buildingId,
    );

    if (!feature) {
      return null;
    }

    const props = feature.properties;
    return {
      floors: this.cleanValue(props.NoofFloor),
      apartments: this.cleanValue(props.NoofApartments),
      status: this.cleanValue(props.Status2022),
      yearCompleted: this.cleanValue(props.YearCompleted),
      heightMeters: this.cleanValue(props.Building_Hight_m),
      use: this.cleanValue(props.Building_Use),
      sector: this.cleanValue(props.Sector_Name),
      cadastral: this.cleanValue(props.Cadastral),
    };
  }

  private getCoordinates(hospital: HospitalData): { lon: number; lat: number } {
    return {
      lon: parseFloat(hospital.longitude),
      lat: parseFloat(hospital.latitude),
    };
  }

  private calculateDistance(
    lon1: number,
    lat1: number,
    lon2: number,
    lat2: number,
  ): number {
    const from = turf.point([lon1, lat1]);
    const to = turf.point([lon2, lat2]);
    return turf.distance(from, to, { units: 'kilometers' });
  }

  findAll(type?: string): HospitalListResponse {
    let filteredHospitals = this.hospitals;

    if (type) {
      const typeFilter = type.toLowerCase();
      filteredHospitals = this.hospitals.filter((h) => {
        const hospitalType = h.Type.toLowerCase();
        if (typeFilter === 'public') {
          return hospitalType.includes('public');
        } else if (typeFilter === 'private') {
          return hospitalType.includes('private');
        }
        return true;
      });
    }

    return {
      total: filteredHospitals.length,
      hospitals: filteredHospitals.map((h) => ({
        id: h.BULBuildingID,
        name: h.Name,
        type: h.Type,
        sector: h.sector,
        totalBeds: this.calculateTotalBeds(h),
      })),
    };
  }

  findById(id: number): HospitalDetail | null {
    const hospital = this.hospitals.find((h) => h.BULBuildingID === id);

    if (!hospital) {
      return null;
    }

    return {
      id: hospital.BULBuildingID,
      name: hospital.Name,
      nameArabic: hospital['Name(ar)'],
      type: hospital.Type,
      phone: hospital.Phone,
      address: hospital.formatted_address,
      coordinates: this.getCoordinates(hospital),
      sector: hospital.sector,
      cadastral: hospital.cadastral,
      beds: this.getBeds(hospital),
      building: this.findBuildingById(hospital.BULBuildingID),
    };
  }

  findNearest(lon: number, lat: number, limit: number = 5): NearestHospitalsResponse {
    const hospitalsWithDistance = this.hospitals.map((h) => {
      const coords = this.getCoordinates(h);
      const distanceKm = this.calculateDistance(lon, lat, coords.lon, coords.lat);
      return {
        id: h.BULBuildingID,
        name: h.Name,
        type: h.Type,
        distanceKm: Math.round(distanceKm * 1000) / 1000,
        totalBeds: this.calculateTotalBeds(h),
        coordinates: coords,
      };
    });

    hospitalsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      reference: { lon, lat },
      hospitals: hospitalsWithDistance.slice(0, limit),
    };
  }

  findByBlast(lon: number, lat: number, yieldKg: number): AffectedHospitalsResponse {
    const cubeRoot = Math.pow(yieldKg, 1 / 3);
    const severeRadiusMeters = 5 * cubeRoot;
    const mildRadiusMeters = 20 * cubeRoot;
    const severeRadiusKm = severeRadiusMeters / 1000;
    const mildRadiusKm = mildRadiusMeters / 1000;

    const affected: { hospital: HospitalData; status: BuildingStatus; distanceKm: number }[] = [];
    const operational: { hospital: HospitalData; distanceKm: number }[] = [];

    for (const hospital of this.hospitals) {
      const coords = this.getCoordinates(hospital);
      const distanceKm = this.calculateDistance(lon, lat, coords.lon, coords.lat);

      if (distanceKm <= mildRadiusKm) {
        const status = distanceKm <= severeRadiusKm ? BuildingStatus.SEVERE : BuildingStatus.MILD;
        affected.push({ hospital, status, distanceKm });
      } else {
        operational.push({ hospital, distanceKm });
      }
    }

    operational.sort((a, b) => a.distanceKm - b.distanceKm);

    let severeCount = 0;
    let mildCount = 0;
    let severeBeds = 0;
    let mildBeds = 0;
    const bedsAffectedByType: BedsAffectedByType = {
      medicine: 0,
      obgyn: 0,
      icuCcu: 0,
      surgery: 0,
      pediatrics: 0,
    };

    for (const { hospital, status } of affected) {
      const beds = this.calculateTotalBeds(hospital);
      if (status === BuildingStatus.SEVERE) {
        severeCount++;
        severeBeds += beds;
      } else {
        mildCount++;
        mildBeds += beds;
      }

      bedsAffectedByType.medicine += hospital.medicineBeds || 0;
      bedsAffectedByType.obgyn += hospital.obgynBeds || 0;
      bedsAffectedByType.icuCcu += hospital.icuCcuBeds || 0;
      bedsAffectedByType.surgery += hospital.surgeryBeds || 0;
      bedsAffectedByType.pediatrics += hospital.pediatricsBeds || 0;
    }

    const operationalBeds = operational.reduce(
      (sum, { hospital }) => sum + this.calculateTotalBeds(hospital),
      0,
    );

    return {
      type: DisasterType.BLAST,
      center: { lon, lat },
      parameters: {
        yield: yieldKg,
        severeRadius: severeRadiusMeters,
        mildRadius: mildRadiusMeters,
      },
      summary: {
        totalAffected: affected.length,
        severeCount,
        mildCount,
        bedsAffected: {
          total: severeBeds + mildBeds,
          severe: severeBeds,
          mild: mildBeds,
          byType: bedsAffectedByType,
        },
      },
      operational: {
        count: operational.length,
        totalBeds: operationalBeds,
        nearest: operational.length > 0
          ? {
              id: operational[0].hospital.BULBuildingID,
              name: operational[0].hospital.Name,
              distanceKm: Math.round(operational[0].distanceKm * 1000) / 1000,
            }
          : null,
      },
      affected: affected.map(({ hospital, status, distanceKm }) => ({
        id: hospital.BULBuildingID,
        name: hospital.Name,
        status,
        distanceKm: Math.round(distanceKm * 1000) / 1000,
        totalBeds: this.calculateTotalBeds(hospital),
      })),
    };
  }

  findByEarthquake(lon: number, lat: number, magnitude: number): AffectedHospitalsResponse {
    const severeRadiusKm = Math.pow(10, 0.5 * magnitude - 2.5);
    const mildRadiusKm = Math.pow(10, 0.5 * magnitude - 1.8);
    const severeRadiusMeters = severeRadiusKm * 1000;
    const mildRadiusMeters = mildRadiusKm * 1000;

    const affected: { hospital: HospitalData; status: BuildingStatus; distanceKm: number }[] = [];
    const operational: { hospital: HospitalData; distanceKm: number }[] = [];

    for (const hospital of this.hospitals) {
      const coords = this.getCoordinates(hospital);
      const distanceKm = this.calculateDistance(lon, lat, coords.lon, coords.lat);

      if (distanceKm <= mildRadiusKm) {
        const status = distanceKm <= severeRadiusKm ? BuildingStatus.SEVERE : BuildingStatus.MILD;
        affected.push({ hospital, status, distanceKm });
      } else {
        operational.push({ hospital, distanceKm });
      }
    }

    operational.sort((a, b) => a.distanceKm - b.distanceKm);

    let severeCount = 0;
    let mildCount = 0;
    let severeBeds = 0;
    let mildBeds = 0;
    const bedsAffectedByType: BedsAffectedByType = {
      medicine: 0,
      obgyn: 0,
      icuCcu: 0,
      surgery: 0,
      pediatrics: 0,
    };

    for (const { hospital, status } of affected) {
      const beds = this.calculateTotalBeds(hospital);
      if (status === BuildingStatus.SEVERE) {
        severeCount++;
        severeBeds += beds;
      } else {
        mildCount++;
        mildBeds += beds;
      }

      bedsAffectedByType.medicine += hospital.medicineBeds || 0;
      bedsAffectedByType.obgyn += hospital.obgynBeds || 0;
      bedsAffectedByType.icuCcu += hospital.icuCcuBeds || 0;
      bedsAffectedByType.surgery += hospital.surgeryBeds || 0;
      bedsAffectedByType.pediatrics += hospital.pediatricsBeds || 0;
    }

    const operationalBeds = operational.reduce(
      (sum, { hospital }) => sum + this.calculateTotalBeds(hospital),
      0,
    );

    return {
      type: DisasterType.EARTHQUAKE,
      center: { lon, lat },
      parameters: {
        magnitude,
        severeRadius: severeRadiusMeters,
        mildRadius: mildRadiusMeters,
      },
      summary: {
        totalAffected: affected.length,
        severeCount,
        mildCount,
        bedsAffected: {
          total: severeBeds + mildBeds,
          severe: severeBeds,
          mild: mildBeds,
          byType: bedsAffectedByType,
        },
      },
      operational: {
        count: operational.length,
        totalBeds: operationalBeds,
        nearest: operational.length > 0
          ? {
              id: operational[0].hospital.BULBuildingID,
              name: operational[0].hospital.Name,
              distanceKm: Math.round(operational[0].distanceKm * 1000) / 1000,
            }
          : null,
      },
      affected: affected.map(({ hospital, status, distanceKm }) => ({
        id: hospital.BULBuildingID,
        name: hospital.Name,
        status,
        distanceKm: Math.round(distanceKm * 1000) / 1000,
        totalBeds: this.calculateTotalBeds(hospital),
      })),
    };
  }
}
