import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// Consider replacing with @octokit/webhooks-types for better safety
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

type ProcessedEvent =
  | ProcessedWebhookData
  | ProcessedStarData
  | ProcessedForkData;

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Helper get repo tag (#repo-name)
   */
  private getRepoTag(repositoryName: string): string {
    return `#${repositoryName.split('/')[1] ?? repositoryName}`;
  }

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

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (err) {
      this.logger.error('Signature verification failed', err as Error);
      return false;
    }
  }

  processWebhookEvent(
    event: unknown,
    eventType: string
  ): ProcessedEvent | null {
    switch (eventType) {
      case 'push': {
        return this.processPushEvent(event as GitHubWebhookEvent);
      }
      case 'star': {
        return this.processStarEvent(event);
      }
      case 'fork': {
        return this.processForkEvent(event);
      }
      default: {
        this.logger.debug(`Unsupported event type: ${eventType}`);
        return null;
      }
    }
  }

  private processPushEvent(
    event: GitHubWebhookEvent
  ): ProcessedWebhookData | null {
    if (!this.isPushEvent(event)) {
      this.logger.debug('Skipping non-push event');
      return null;
    }

    const branchName = event.ref.replace('refs/heads/', '');
    const commitMessages = event.commits.map((commit) => commit.message);
    const authors = [
      ...new Set(event.commits.map((commit) => commit.author.name)),
    ];

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

  private processStarEvent(event: any): ProcessedStarData | null {
    if (!event?.action || !event?.repository || !event?.sender) {
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

  private processForkEvent(event: any): ProcessedForkData | null {
    if (!event?.forkee || !event?.repository || !event?.sender) {
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

  formatWebhookMessage(data: ProcessedEvent, eventType: string): string {
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

  createInlineKeyboard(
    data: ProcessedEvent,
    eventType: string
  ): Record<string, unknown> | null {
    switch (eventType) {
      case 'push': {
        const pushData = data as ProcessedWebhookData;
        return {
          inline_keyboard: [
            [
              { text: '🔍 Changes', url: pushData.compareUrl },
              { text: '📚 Repository', url: pushData.repositoryUrl },
            ],
          ],
        };
      }
      case 'star': {
        const starData = data as ProcessedStarData;
        return {
          inline_keyboard: [
            [
              { text: '📚 Repository', url: starData.repositoryUrl },
              { text: '👤 Profile', url: starData.userUrl },
            ],
          ],
        };
      }
      case 'fork': {
        const forkData = data as ProcessedForkData;
        return {
          inline_keyboard: [
            [
              { text: '📚 Original', url: forkData.repositoryUrl },
              { text: '🍴 Fork', url: forkData.forkUrl },
            ],
            [{ text: '👤 Profile', url: forkData.userUrl }],
          ],
        };
      }
      default:
        return null;
    }
  }

  private formatPushMessage(data: ProcessedWebhookData): string {
    const {
      repositoryName,
      branchName,
      commitMessages,
      authors,
      changedFiles,
      pusher,
    } = data;

    const repoTag = this.getRepoTag(repositoryName);
    const header = `🚀 <b>${pusher}</b> pushed to <b>${repoTag}</b>\n\n`;
    const branchInfo = `🌿 <b>Branch:</b> <code>${branchName}</code>\n`;
    const authorsInfo = `👥 <b>Authors:</b> ${authors.join(', ')}\n\n`;

    let message = header + branchInfo + authorsInfo;

    if (commitMessages.length > 0) {
      message += `📦 <b>Commits (${commitMessages.length})</b>\n`;
      commitMessages.slice(0, 5).forEach((msg) => {
        const cleanMsg = msg.split('\n')[0];
        const truncatedMsg =
          cleanMsg.length > 80 ? `${cleanMsg.substring(0, 77)}...` : cleanMsg;
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

  private formatStarMessage(data: ProcessedStarData): string {
    const emoji = data.action === 'created' ? '⭐' : '💫';
    const actionText = data.action === 'created' ? 'starred' : 'unstarred';
    const repoTag = this.getRepoTag(data.repositoryName);

    return `${emoji} <b>${data.userLogin}</b> ${actionText} <b>${repoTag}</b>\n\n📊 <b>Total Stars:</b> ${data.starCount}`;
  }

  private formatForkMessage(data: ProcessedForkData): string {
    const repoTag = this.getRepoTag(data.repositoryName);

    return `🍴 <b>${data.userLogin}</b> forked <b>${repoTag}</b>\n\n📊 <b>Total Forks:</b> ${data.forkCount}`;
  }

  private isPushEvent(event: Partial<GitHubWebhookEvent>): boolean {
    return Boolean(event.ref && event.ref.startsWith('refs/heads/'));
  }
}
