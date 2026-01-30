import { BuildingStatus } from '../../common/enums/status.enum';
import { DisasterType } from '../../common/enums/disaster-type.enum';

export interface HospitalBeds {
  medicine: number | null;
  obgyn: number | null;
  icuCcu: number | null;
  surgery: number | null;
  pediatrics: number | null;
  total: number;
}

export interface HospitalListItem {
  id: number;
  name: string;
  type: string;
  sector: string;
  totalBeds: number;
}

export interface HospitalListResponse {
  total: number;
  hospitals: HospitalListItem[];
}

export interface BuildingData {
  floors?: number;
  apartments?: number;
  status?: string;
  yearCompleted?: number;
  heightMeters?: number;
  use?: string;
  sector?: string;
  cadastral?: string;
}

export interface HospitalDetail {
  id: number;
  name: string;
  nameArabic: string;
  type: string;
  phone: string;
  address: string;
  coordinates: { lon: number; lat: number };
  sector: string;
  cadastral: string;
  beds: HospitalBeds;
  building: BuildingData | null;
}

export interface NearestHospital {
  id: number;
  name: string;
  type: string;
  distanceKm: number;
  totalBeds: number;
  coordinates: { lon: number; lat: number };
}

export interface NearestHospitalsResponse {
  reference: { lon: number; lat: number };
  hospitals: NearestHospital[];
}

export interface AffectedHospital {
  id: number;
  name: string;
  status: BuildingStatus;
  distanceKm: number;
  totalBeds: number;
}

export interface BedsAffectedByType {
  medicine: number;
  obgyn: number;
  icuCcu: number;
  surgery: number;
  pediatrics: number;
}

export interface BedsAffectedSummary {
  total: number;
  severe: number;
  mild: number;
  byType: BedsAffectedByType;
}

export interface OperationalHospitals {
  count: number;
  totalBeds: number;
  nearest: { id: number; name: string; distanceKm: number } | null;
}

export interface AffectedHospitalsResponse {
  type: DisasterType;
  center: { lon: number; lat: number };
  parameters: { yield?: number; magnitude?: number; severeRadius?: number; mildRadius?: number };
  summary: {
    totalAffected: number;
    severeCount: number;
    mildCount: number;
    bedsAffected: BedsAffectedSummary;
  };
  operational: OperationalHospitals;
  affected: AffectedHospital[];
}
