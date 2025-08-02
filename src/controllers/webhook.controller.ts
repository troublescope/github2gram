import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { GitHubWebhookService } from '../services/github-webhook.service';
import { TelegramService } from '../services/telegram.service';
import type { GitHubWebhookEvent } from '../interfaces/github-webhook.interface';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly githubWebhookService: GitHubWebhookService,
    private readonly telegramService: TelegramService
  ) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  async handleGitHubWebhook(
    @Body() payload: GitHubWebhookEvent,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') eventType: string
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Received GitHub webhook: ${eventType}`);

    // Verify webhook signature
    const rawBody = JSON.stringify(payload);
    if (!this.githubWebhookService.verifySignature(rawBody, signature)) {
      this.logger.warn('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process the webhook event
    const processedData =
      this.githubWebhookService.processWebhookEvent(payload);

    if (!processedData) {
      this.logger.debug('Event filtered out or not a push event');
      return {
        success: true,
        message: 'Event processed (filtered out)',
      };
    }

    // Format the message
    const message =
      this.githubWebhookService.formatWebhookMessage(processedData);

    // Send to Telegram
    const sent = await this.telegramService.sendWebhookNotification(
      message,
      processedData.repositoryName
    );

    if (sent) {
      this.logger.log(
        `Webhook notification sent successfully for ${processedData.repositoryName}`
      );
      return {
        success: true,
        message: 'Webhook processed and notification sent',
      };
    } else {
      this.logger.error(
        `Failed to send webhook notification for ${processedData.repositoryName}`
      );
      return {
        success: false,
        message: 'Webhook processed but notification failed',
      };
    }
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
