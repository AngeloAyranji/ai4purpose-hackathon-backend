import { Controller, Get, Query, Param, NotFoundException } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { NearestQueryDto } from './dto/nearest-query.dto';
import { HospitalBlastQueryDto } from './dto/blast-query.dto';
import { HospitalEarthquakeQueryDto } from './dto/earthquake-query.dto';
import {
  HospitalListResponse,
  HospitalDetail,
  NearestHospitalsResponse,
  AffectedHospitalsResponse,
} from './dto/hospital.dto';

@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  findAll(@Query('type') type?: string): HospitalListResponse {
    return this.hospitalsService.findAll(type);
  }

  @Get('nearest')
  findNearest(@Query() query: NearestQueryDto): NearestHospitalsResponse {
    return this.hospitalsService.findNearest(query.lon, query.lat, query.limit);
  }

  @Get('affected/blast')
  findByBlast(@Query() query: HospitalBlastQueryDto): AffectedHospitalsResponse {
    return this.hospitalsService.findByBlast(query.lon, query.lat, query.yield);
  }

  @Get('affected/earthquake')
  findByEarthquake(@Query() query: HospitalEarthquakeQueryDto): AffectedHospitalsResponse {
    return this.hospitalsService.findByEarthquake(query.lon, query.lat, query.magnitude);
  }

  @Get(':id')
  findById(@Param('id') id: string): HospitalDetail {
    const hospital = this.hospitalsService.findById(Number(id));
    if (!hospital) {
      throw new NotFoundException(`Hospital with ID ${id} not found`);
    }
    return hospital;
  }
}
