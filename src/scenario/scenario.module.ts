import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Scenario, ScenarioSchema } from './scenario.schema';
import { ScenarioService } from './scenario.service';
import { BuildingsModule } from '../buildings/buildings.module';
import { HospitalsModule } from '../hospitals/hospitals.module';
import { CasualtyCalculator } from './calculators/casualty.calculator';
import { EconomicCalculator } from './calculators/economic.calculator';
import { MitigationCalculator } from './calculators/mitigation.calculator';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Scenario.name, schema: ScenarioSchema }]),
    BuildingsModule,
    HospitalsModule,
  ],
  providers: [
    ScenarioService,
    CasualtyCalculator,
    EconomicCalculator,
    MitigationCalculator,
  ],
  exports: [ScenarioService],
})
export class ScenarioModule {}
