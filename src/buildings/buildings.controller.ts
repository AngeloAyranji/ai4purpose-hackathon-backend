import { Controller, Get, Query } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { AffectedBuildingsResponse } from './dto/affected-buildings.dto';
import { RadiusQueryDto } from './dto/radius-query.dto';
import { EarthquakeQueryDto } from './dto/earthquake-query.dto';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get('affected/radius')
  getByRadius(@Query() query: RadiusQueryDto): AffectedBuildingsResponse {
    return this.buildingsService.findByRadius(
      query.lon,
      query.lat,
      query.radius,
      query.severeRadius,
    );
  }

  @Get('affected/earthquake')
  getByEarthquake(@Query() query: EarthquakeQueryDto): AffectedBuildingsResponse {
    return this.buildingsService.findByEarthquake(
      query.lon,
      query.lat,
      query.magnitude,
    );
  }
}
