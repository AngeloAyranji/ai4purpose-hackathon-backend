import { Controller, Get, Query, Param, NotFoundException, BadRequestException } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { AffectedBuildingsResponse } from './dto/affected-buildings.dto';
import { BlastQueryDto } from './dto/blast-query.dto';
import { EarthquakeQueryDto } from './dto/earthquake-query.dto';
import { BuildingTypeQueryDto } from './dto/building-query.dto';
import { BuildingType } from '../common/enums/building-type.enum';

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  findByTypes(@Query('type') type: string | string[]) {
    let types: BuildingType[];
    if (Array.isArray(type)) {
      types = type as BuildingType[];
    } else if (type.includes(',')) {
      types = type.split(',') as BuildingType[];
    } else {
      types = [type as BuildingType];
    }
    return this.buildingsService.findByTypes(types);
  }

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

  @Get(':id')
  findById(@Param('id') id: string) {
    const building = this.buildingsService.findById(Number(id));
    if (!building) {
      throw new NotFoundException(`Building with ID ${id} not found`);
    }
    return building;
  }
}
