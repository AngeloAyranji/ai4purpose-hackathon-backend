import { Module, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import { BuildingsModule } from '../buildings/buildings.module';
import { HospitalsModule } from '../hospitals/hospitals.module';
import { ScenarioModule } from '../scenario/scenario.module';

@Module({
  imports: [
    BuildingsModule,
    HospitalsModule,
    forwardRef(() => ScenarioModule),
  ],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
