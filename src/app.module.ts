import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BuildingsModule } from './buildings/buildings.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { AgentModule } from './agent/agent.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ChatSessionModule } from './chat-session/chat-session.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI!),
    ChatSessionModule,
    BuildingsModule,
    HospitalsModule,
    AgentModule,
    WebsocketModule,
  ],
})
export class AppModule {}
