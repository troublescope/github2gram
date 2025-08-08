import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

export interface TelegramMessageOptions {
  chatId?: string;
  parseMode?: 'Markdown' | 'HTML';
  disableWebPagePreview?: boolean;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl = 'https://api.telegram.org/bot';

  constructor(private configService: ConfigService) {}

  /**
   * Send a message to Telegram
   */
  async sendMessage(
    text: string,
    options: TelegramMessageOptions = {}
  ): Promise<boolean> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const defaultChatId = this.configService.get<string>(
      'telegram.defaultChatId'
    );
    const chatId = options.chatId || defaultChatId;

    if (!botToken) {
      this.logger.error('Telegram bot token not configured');
      return false;
    }

    if (!chatId) {
      this.logger.error('Telegram chat ID not configured');
      return false;
    }

    try {
      const url = `${this.baseUrl}${botToken}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disableWebPagePreview || false,
      };

      const response: AxiosResponse = await axios.post(url, payload);

      if (response.data.ok) {
        this.logger.log(`Message sent successfully to chat ${chatId}`);
        return true;
      } else {
        this.logger.error(
          `Failed to send message: ${response.data.description}`
        );
        return false;
      }
    } catch (error) {
      console.log(error);
      this.logger.error(`Error sending Telegram message: ${error.message}`);
      return false;
    }
  }

  /**
   * Get chat ID for a specific repository
   */
  getChatIdForRepository(repositoryName: string): string | null {
    const repositories =
      this.configService.get<Record<string, string>>('repositories');
    return repositories?.[repositoryName] || null;
  }

  /**
   * Send a webhook notification to the appropriate chat
   */
  async sendWebhookNotification(
    message: string,
    repositoryName: string
  ): Promise<boolean> {
    // Try to get repository-specific chat ID first
    const repoChatId = this.getChatIdForRepository(repositoryName);

    if (repoChatId) {
      this.logger.log(`Sending to repository-specific chat: ${repoChatId}`);
      return await this.sendMessage(message, { chatId: repoChatId });
    } else {
      this.logger.log('Using default chat ID');
      return await this.sendMessage(message);
    }
  }
}
