import { Controller, Get, Query } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { AffectedBuildingsResponse } from './dto/affected-buildings.dto';
import { BlastQueryDto } from './dto/blast-query.dto';
import { EarthquakeQueryDto } from './dto/earthquake-query.dto';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get('affected/blast')
  getByBlast(@Query() query: BlastQueryDto): AffectedBuildingsResponse {
    return this.buildingsService.findByBlast(
      query.lon,
      query.lat,
      query.yield,
      query.includeVulnerability ?? false,
    );
  }

  @Get('affected/earthquake')
  getByEarthquake(@Query() query: EarthquakeQueryDto): AffectedBuildingsResponse {
    return this.buildingsService.findByEarthquake(
      query.lon,
      query.lat,
      query.magnitude,
      query.includeVulnerability ?? false,
    );
  }
}
