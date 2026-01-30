import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { BuildingsModule } from '../buildings/buildings.module';
import { HospitalsModule } from '../hospitals/hospitals.module';

@Module({
  imports: [BuildingsModule, HospitalsModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
