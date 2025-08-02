import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebhookController } from './controllers/webhook.controller';
import { GitHubWebhookService } from './services/github-webhook.service';
import { TelegramService } from './services/telegram.service';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  controllers: [AppController, WebhookController],
  providers: [AppService, GitHubWebhookService, TelegramService],
})
export class AppModule {}
