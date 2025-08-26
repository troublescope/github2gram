import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Get,
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
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') eventType: string,
    @Headers('x-github-delivery') delivery: string
  ): Promise<{ success: boolean; message: string; eventType?: string }> {
    this.logger.log(
      `Received GitHub webhook: ${eventType} (delivery: ${delivery})`
    );

    // Verify webhook signature
    const rawBody = JSON.stringify(payload);
    if (!this.githubWebhookService.verifySignature(rawBody, signature)) {
      this.logger.warn('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    // Check if event type is supported
    const supportedEvents = ['push', 'star', 'fork', 'issues', 'pull_request'];
    if (!supportedEvents.includes(eventType)) {
      this.logger.log(`Event type ${eventType} is not supported, ignoring`);
      return {
        success: true,
        message: `Event ${eventType} is not supported`,
        eventType,
      };
    }

    try {
      // Process the webhook event
      const processedData = this.githubWebhookService.processWebhookEvent(
        payload,
        eventType
      );

      if (!processedData) {
        this.logger.debug('Event filtered out or invalid data');
        return {
          success: true,
          message: 'Event processed (filtered out)',
          eventType,
        };
      }

      // Format the message
      const message = this.githubWebhookService.formatWebhookMessage(
        processedData,
        eventType
      );

      // Create inline keyboard
      const keyboard = this.githubWebhookService.createInlineKeyboard(
        processedData,
        eventType
      );

      // Get repository name for routing
      const repositoryName = this.getRepositoryName(processedData);

      // Send to Telegram with buttons
      const sent = await this.telegramService.sendWebhookNotification(
        message,
        repositoryName,
        keyboard
      );

      if (sent) {
        this.logger.log(
          `${eventType} notification sent successfully for ${repositoryName}`
        );
        return {
          success: true,
          message: `${eventType} event processed and notification sent`,
          eventType,
        };
      } else {
        this.logger.error(
          `Failed to send ${eventType} notification for ${repositoryName}`
        );
        return {
          success: false,
          message: `${eventType} event processed but notification failed`,
          eventType,
        };
      }
    } catch (error) {
      this.logger.error(`Error processing ${eventType} event:`, error);
      throw error;
    }
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    telegram: boolean;
    supportedEvents: string[];
  }> {
    const telegramStatus = await this.telegramService.testConnection();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      telegram: telegramStatus,
      supportedEvents: ['push', 'star', 'fork', 'issues', 'pull_request'],
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testEndpoint(
    @Body() body: { chatId?: string } = {}
  ): Promise<{ success: boolean; message: string }> {
    try {
      const sent = await this.telegramService.sendTestMessage(body.chatId);

      if (sent) {
        return {
          success: true,
          message: 'Test message sent successfully with buttons',
        };
      } else {
        return {
          success: false,
          message: 'Failed to send test message',
        };
      }
    } catch (error) {
      this.logger.error('Test endpoint error:', error);
      return {
        success: false,
        message: `Test failed: ${error.message}`,
      };
    }
  }

  /**
   * Extract repository name from processed data
   */
  private getRepositoryName(data: any): string {
    return data.repositoryName || 'unknown';
  }
}