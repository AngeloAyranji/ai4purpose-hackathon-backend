import { Module } from '@nestjs/common';
import { BuildingsModule } from './buildings/buildings.module';
import { HospitalsModule } from './hospitals/hospitals.module';

@Module({
  imports: [BuildingsModule, HospitalsModule],
})
export class AppModule {}
