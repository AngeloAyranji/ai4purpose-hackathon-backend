import { Module } from '@nestjs/common';
import { BuildingsModule } from './buildings/buildings.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { AgentModule } from './agent/agent.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [BuildingsModule, HospitalsModule, AgentModule, WebsocketModule],
})
export class AppModule {}
