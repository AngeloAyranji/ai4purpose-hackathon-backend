import { IsNumber, Min, Max, IsOptional, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class BlastQueryDto {
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
  yield: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeVulnerability?: boolean;
}
