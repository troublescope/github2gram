import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('server.port') || 3000;

  await app.listen(port);
  console.log(`🚀 GitHub Webhook to Telegram Bot is running on port ${port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${port}/webhook/github`);
  console.log(`🏥 Health check: http://localhost:${port}/webhook/health`);
}

bootstrap();
