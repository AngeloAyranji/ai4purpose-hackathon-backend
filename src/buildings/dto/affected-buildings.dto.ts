export interface BuildingProperties {
  BULBuildingID: number;
  NoofApartments: number;
  [key: string]: any;
}

export interface BuildingResult {
  id: number;
  apartments: number | null;
}

export interface AffectedBuildingsResponse {
  center: { lon: number; lat: number };
  radius_meters: number;
  total_buildings: number;
  total_apartments: number;
  buildings: BuildingResult[];
}
