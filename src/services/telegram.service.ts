import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

export interface TelegramMessageOptions {
  chatId?: string;
  parseMode?: 'Markdown' | 'HTML';
  disableWebPagePreview?: boolean;
  replyMarkup?: any;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl = 'https://api.telegram.org/bot';

  constructor(private configService: ConfigService) {}

  /**
   * Send a message to Telegram with optional inline keyboard
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
      const payload: any = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disableWebPagePreview || false,
      };

      // Add inline keyboard if provided
      if (options.replyMarkup) {
        payload.reply_markup = options.replyMarkup;
      }

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
      this.logger.error(`Error sending Telegram message: ${error.message}`);
      if (error.response) {
        this.logger.error('Telegram API response:', error.response.data);
      }
      return false;
    }
  }

  /**
   * Send a message with inline keyboard buttons
   */
  async sendMessageWithButtons(
    text: string,
    inlineKeyboard: any,
    chatId?: string
  ): Promise<boolean> {
    return this.sendMessage(text, {
      chatId,
      replyMarkup: inlineKeyboard,
      disableWebPagePreview: true,
    });
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
    repositoryName: string,
    inlineKeyboard?: any
  ): Promise<boolean> {
    // Try to get repository-specific chat ID first
    const repoChatId = this.getChatIdForRepository(repositoryName);

    if (repoChatId) {
      this.logger.log(`Sending to repository-specific chat: ${repoChatId}`);
      return await this.sendMessage(message, { 
        chatId: repoChatId, 
        replyMarkup: inlineKeyboard,
        disableWebPagePreview: true 
      });
    } else {
      this.logger.log('Using default chat ID');
      return await this.sendMessage(message, { 
        replyMarkup: inlineKeyboard,
        disableWebPagePreview: true 
      });
    }
  }

  /**
   * Test bot connection
   */
  async testConnection(): Promise<boolean> {
    const botToken = this.configService.get<string>('telegram.botToken');
    
    if (!botToken) {
      this.logger.error('Telegram bot token not configured');
      return false;
    }

    try {
      const url = `${this.baseUrl}${botToken}/getMe`;
      const response: AxiosResponse = await axios.get(url);
      
      if (response.data.ok) {
        this.logger.log(`Bot connected successfully: ${response.data.result.username}`);
        return true;
      } else {
        this.logger.error('Bot connection test failed:', response.data);
        return false;
      }
    } catch (error) {
      this.logger.error('Error testing bot connection:', error.message);
      return false;
    }
  }

  /**
   * Send a test message with buttons
   */
  async sendTestMessage(chatId?: string): Promise<boolean> {
    const testMessage = `🔧 <b>Test Message</b>

⏰ <b>Time:</b> ${new Date().toLocaleString()}
✅ <b>Status:</b> Webhook is working correctly!
🤖 <b>Bot:</b> Connection established

🎯 <b>Supported Events:</b>
• 🚀 Push notifications
• ⭐ Star/unstar events  
• 🍴 Fork events`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '🔗 GitHub Repository',
            url: 'https://github.com/jayremnt/gh2t'
          },
          {
            text: '📚 Documentation',
            url: 'https://github.com/jayremnt/gh2t#readme'
          }
        ]
      ]
    };

    const targetChatId = chatId || this.configService.get<string>('telegram.defaultChatId');
    
    return this.sendMessage(testMessage, {
      chatId: targetChatId,
      replyMarkup: keyboard,
      disableWebPagePreview: true
    });
  }
}