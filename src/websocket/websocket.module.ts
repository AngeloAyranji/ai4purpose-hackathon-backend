import { Module, Global } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { PublisherService } from './publisher.service';
import { AgentModule } from '../agent/agent.module';

@Global()
@Module({
  imports: [AgentModule],
  providers: [WebsocketGateway, PublisherService],
  exports: [PublisherService],
})
export class WebsocketModule {}
