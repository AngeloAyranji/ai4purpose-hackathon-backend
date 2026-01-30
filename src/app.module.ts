import { Module } from '@nestjs/common';
import { BuildingsModule } from './buildings/buildings.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [BuildingsModule, HospitalsModule, AgentModule],
})
export class AppModule {}
