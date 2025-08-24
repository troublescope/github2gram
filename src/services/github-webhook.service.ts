import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { GitHubWebhookEvent } from '../interfaces/github-webhook.interface';

export interface ProcessedWebhookData {
  repositoryName: string;
  branchName: string;
  commitMessages: string[];
  authors: string[];
  timestamp: string;
  changedFiles: string[];
  compareUrl: string;
  pusher: string;
  repositoryUrl: string;
}

export interface ProcessedStarData {
  repositoryName: string;
  repositoryUrl: string;
  action: 'created' | 'deleted';
  userLogin: string;
  userUrl: string;
  starCount: number;
  timestamp: string;
}

export interface ProcessedForkData {
  repositoryName: string;
  repositoryUrl: string;
  forkName: string;
  forkUrl: string;
  userLogin: string;
  userUrl: string;
  forkCount: number;
  timestamp: string;
}

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Verify GitHub webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    const secret = this.configService.get<string>('github.webhookSecret');
    if (!secret) {
      this.logger.warn('GitHub webhook secret not configured');
      return false;
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Process webhook events based on event type
   */
  processWebhookEvent(event: any, eventType: string): ProcessedWebhookData | ProcessedStarData | ProcessedForkData | null {
    switch (eventType) {
      case 'push':
        return this.processPushEvent(event);
      case 'star':
        return this.processStarEvent(event);
      case 'fork':
        return this.processForkEvent(event);
      default:
        this.logger.debug(`Unsupported event type: ${eventType}`);
        return null;
    }
  }

  /**
   * Process push events
   */
  private processPushEvent(event: GitHubWebhookEvent): ProcessedWebhookData | null {
    // Only handle push events
    if (!this.isPushEvent(event)) {
      this.logger.debug('Skipping non-push event');
      return null;
    }

    // Extract branch name from ref (e.g., "refs/heads/main" -> "main")
    const branchName = event.ref.replace('refs/heads/', '');

    // Extract commit messages
    const commitMessages = event.commits.map((commit) => commit.message);

    // Extract unique authors
    const authors = [
      ...new Set(event.commits.map((commit) => commit.author.name)),
    ];

    // Extract all changed files
    const changedFiles = new Set<string>();
    event.commits.forEach((commit) => {
      commit.added.forEach((file) => changedFiles.add(`+ ${file}`));
      commit.removed.forEach((file) => changedFiles.add(`- ${file}`));
      commit.modified.forEach((file) => changedFiles.add(`~ ${file}`));
    });

    return {
      repositoryName: event.repository.full_name,
      repositoryUrl: `https://github.com/${event.repository.full_name}`,
      branchName,
      commitMessages,
      authors,
      timestamp: new Date().toISOString(),
      changedFiles: Array.from(changedFiles),
      compareUrl: event.compare,
      pusher: event.pusher.name,
    };
  }

  /**
   * Process star events
   */
  private processStarEvent(event: any): ProcessedStarData | null {
    if (!event.action || !event.repository || !event.sender) {
      this.logger.debug('Invalid star event data');
      return null;
    }

    return {
      repositoryName: event.repository.full_name,
      repositoryUrl: event.repository.html_url,
      action: event.action,
      userLogin: event.sender.login,
      userUrl: event.sender.html_url,
      starCount: event.repository.stargazers_count,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process fork events
   */
  private processForkEvent(event: any): ProcessedForkData | null {
    if (!event.forkee || !event.repository || !event.sender) {
      this.logger.debug('Invalid fork event data');
      return null;
    }

    return {
      repositoryName: event.repository.full_name,
      repositoryUrl: event.repository.html_url,
      forkName: event.forkee.full_name,
      forkUrl: event.forkee.html_url,
      userLogin: event.sender.login,
      userUrl: event.sender.html_url,
      forkCount: event.repository.forks_count,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format webhook data into a readable message based on event type
   */
  formatWebhookMessage(data: ProcessedWebhookData | ProcessedStarData | ProcessedForkData, eventType: string): string {
    switch (eventType) {
      case 'push':
        return this.formatPushMessage(data as ProcessedWebhookData);
      case 'star':
        return this.formatStarMessage(data as ProcessedStarData);
      case 'fork':
        return this.formatForkMessage(data as ProcessedForkData);
      default:
        return 'Unknown event type';
    }
  }

  /**
   * Create inline keyboard based on event type
   */
  createInlineKeyboard(data: ProcessedWebhookData | ProcessedStarData | ProcessedForkData, eventType: string): any {
    switch (eventType) {
      case 'push':
        const pushData = data as ProcessedWebhookData;
        return {
          inline_keyboard: [
            [
              {
                text: '🔍 View Changes',
                url: pushData.compareUrl
              },
              {
                text: '📚 Repository',
                url: pushData.repositoryUrl
              }
            ]
          ]
        };
      case 'star':
        const starData = data as ProcessedStarData;
        return {
          inline_keyboard: [
            [
              {
                text: '📚 Repository',
                url: starData.repositoryUrl
              },
              {
                text: '👤 User Profile',
                url: starData.userUrl
              }
            ]
          ]
        };
      case 'fork':
        const forkData = data as ProcessedForkData;
        return {
          inline_keyboard: [
            [
              {
                text: '📚 Original Repo',
                url: forkData.repositoryUrl
              },
              {
                text: '🍴 Fork',
                url: forkData.forkUrl
              }
            ],
            [
              {
                text: '👤 User Profile',
                url: forkData.userUrl
              }
            ]
          ]
        };
      default:
        return null;
    }
  }

  /**
   * Format push message
   */
  private formatPushMessage(data: ProcessedWebhookData): string {
    const {
      repositoryName,
      branchName,
      commitMessages,
      authors,
      changedFiles,
      pusher,
    } = data;

    const header = `🚀 <b>${pusher} just pushed to ${repositoryName}</b>\n\n`;
    const branchInfo = `🌿 <b>Branch:</b> <code>${branchName}</code>\n`;
    const authorsInfo = `👥 <b>Authors:</b> ${authors.join(', ')}\n\n`;

    let message = header + branchInfo + authorsInfo;

    if (commitMessages.length > 0) {
      message += `📦 <b>Commits (${commitMessages.length})</b>\n`;
      commitMessages.slice(0, 5).forEach((msg) => {
        const cleanMsg = msg.split('\n')[0];
        const truncatedMsg =
          cleanMsg.length > 80 ? cleanMsg.substring(0, 77) + '...' : cleanMsg;
        message += `└─ ${truncatedMsg}\n`;
      });

      if (commitMessages.length > 5) {
        message += `└─ ...and ${commitMessages.length - 5} more\n`;
      }
      message += `\n`;
    }

    if (changedFiles.length > 0) {
      const fileCount = changedFiles.length;
      const fileWord = fileCount === 1 ? 'file' : 'files';
      message += `🛠️ <b>Changed ${fileCount} ${fileWord}</b>\n`;

      changedFiles.slice(0, 8).forEach((file) => {
        message += `└─ <code>${file}</code>\n`;
      });

      if (changedFiles.length > 8) {
        message += `└─ ...and ${changedFiles.length - 8} more\n`;
      }
    }

    return message;
  }

  /**
   * Format star message
   */
  private formatStarMessage(data: ProcessedStarData): string {
    const emoji = data.action === 'created' ? '⭐' : '💫';
    const actionText = data.action === 'created' ? 'starred' : 'unstarred';
    
    return `${emoji} <b>${data.userLogin} ${actionText} ${data.repositoryName}</b>

📊 <b>Total Stars:</b> ${data.starCount}
👤 <b>User:</b> @${data.userLogin}`;
  }

  /**
   * Format fork message
   */
  private formatForkMessage(data: ProcessedForkData): string {
    return `🍴 <b>${data.userLogin} forked ${data.repositoryName}</b>

🔗 <b>New Fork:</b> ${data.forkName}
📊 <b>Total Forks:</b> ${data.forkCount}
👤 <b>User:</b> @${data.userLogin}`;
  }

  /**
   * Check if the event is a push event
   */
  private isPushEvent(event: any): boolean {
    return event.ref && event.ref.startsWith('refs/heads/');
  }
}