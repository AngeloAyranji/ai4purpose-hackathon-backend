import { Controller, Get, Query } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { AffectedBuildingsResponse } from './dto/affected-buildings.dto';
import { CoordinateQueryDto } from '../common/dto/coordinates.dto';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get('affected')
  getAffectedBuildings(
    @Query() query: CoordinateQueryDto,
  ): AffectedBuildingsResponse {
    return this.buildingsService.findAffectedBuildings(
      query.lon,
      query.lat,
      query.radius,
    );
  }
}
