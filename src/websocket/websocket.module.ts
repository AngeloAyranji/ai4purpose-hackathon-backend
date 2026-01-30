import { Module, Global } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { PublisherService } from './publisher.service';

@Global()
@Module({
  providers: [WebsocketGateway, PublisherService],
  exports: [PublisherService],
})
export class WebsocketModule {}
