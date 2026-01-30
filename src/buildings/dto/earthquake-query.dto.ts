import { IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class EarthquakeQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  magnitude: number;
}
