import { Module, Global } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { PublisherService } from './publisher.service';
import { AgentModule } from '../agent/agent.module';
import { ChatSessionModule } from '../chat-session/chat-session.module';

@Global()
@Module({
  imports: [AgentModule, ChatSessionModule],
  providers: [WebsocketGateway, PublisherService],
  exports: [PublisherService],
})
export class WebsocketModule {}
