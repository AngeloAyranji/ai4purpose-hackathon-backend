import { Module, Global, forwardRef } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { PublisherService } from './publisher.service';
import { AgentModule } from '../agent/agent.module';
import { ChatSessionModule } from '../chat-session/chat-session.module';
import { ScenarioModule } from '../scenario/scenario.module';

@Global()
@Module({
  imports: [
    AgentModule,
    ChatSessionModule,
    forwardRef(() => ScenarioModule),
  ],
  providers: [WebsocketGateway, PublisherService],
  exports: [PublisherService],
})
export class WebsocketModule {}
