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
   * Filter and process GitHub webhook events
   */
  processWebhookEvent(event: GitHubWebhookEvent): ProcessedWebhookData | null {
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
   * Format webhook data into a readable message
   */
  formatWebhookMessage(data: ProcessedWebhookData): string {
    const {
      repositoryName,
      branchName,
      commitMessages,
      authors,
      changedFiles,
      compareUrl,
      pusher,
    } = data;

    const header = `${pusher} just pushed to ${repositoryName}!\n\n`;
    const branchInfo = `🌿 *Branch:* ${branchName}\n`;
    const authorsInfo = `👥 *Authors:* ${authors.join(', ')}\n\n`;

    let message = header + branchInfo + authorsInfo;

    if (commitMessages.length > 0) {
      message += `📦 *Commits (${commitMessages.length})*\n`;
      commitMessages.slice(0, 5).forEach((msg) => {
        const cleanMsg = msg.split('\n')[0]; // Take only first line of commit message
        const truncatedMsg =
          cleanMsg.length > 80 ? cleanMsg.substring(0, 77) + '...' : cleanMsg;
        message += `└─ ${truncatedMsg}\n`;
      });

      if (commitMessages.length > 5) {
        message += `└─ ...and ${commitMessages.length - 5} more\n`;
      }
      message += '\n';
    }

    if (changedFiles.length > 0) {
      const fileCount = changedFiles.length;
      const fileWord = fileCount === 1 ? 'file' : 'files';
      message += `🛠️ *Changed ${fileCount} ${fileWord}*\n`;

      changedFiles.slice(0, 5).forEach((file) => {
        message += `└─ ${file}\n`;
      });

      if (changedFiles.length > 5) {
        message += `└─ ...and ${changedFiles.length - 5} more\n`;
      }
      message += '\n';
    }

    message += `🔗 [View changes on GitHub](${compareUrl})`;

    return message;
  }

  /**
   * Check if the event is a push event
   */
  private isPushEvent(event: any): boolean {
    return event.ref && event.ref.startsWith('refs/heads/');
  }
}
