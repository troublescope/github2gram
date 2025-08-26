import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// Consider replacing with @octokit/webhooks-types for better safety
import {
  GitHubWebhookEvent,
  GitHubIssueEvent,
  GitHubPullRequestEvent,
} from '../interfaces/github-webhook.interface';

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

export interface ProcessedIssueData {
  repositoryName: string;
  repositoryUrl: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  action: string;
  userLogin: string;
  userUrl: string;
  timestamp: string;
  labels: string[];
  assignees: string[];
  body?: string;
}

export interface ProcessedPullRequestData {
  repositoryName: string;
  repositoryUrl: string;
  pullRequestNumber: number;
  pullRequestTitle: string;
  pullRequestUrl: string;
  action: string;
  userLogin: string;
  userUrl: string;
  timestamp: string;
  labels: string[];
  assignees: string[];
  body?: string;
  baseBranch: string;
  headBranch: string;
  isDraft: boolean;
  isMerged?: boolean;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
}

type ProcessedEvent =
  | ProcessedWebhookData
  | ProcessedStarData
  | ProcessedForkData
  | ProcessedIssueData
  | ProcessedPullRequestData;

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
      case 'issues': {
        return this.processIssueEvent(event as GitHubIssueEvent);
      }
      case 'pull_request': {
        return this.processPullRequestEvent(event as GitHubPullRequestEvent);
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

  private processIssueEvent(event: GitHubIssueEvent): ProcessedIssueData | null {
    if (!event?.action || !event?.issue || !event?.repository || !event?.sender) {
      this.logger.debug('Invalid issue event data');
      return null;
    }

    // Only process open and close actions
    if (!['opened', 'closed', 'reopened'].includes(event.action)) {
      this.logger.debug(`Skipping issue action: ${event.action}`);
      return null;
    }

    return {
      repositoryName: event.repository.full_name,
      repositoryUrl: event.repository.html_url,
      issueNumber: event.issue.number,
      issueTitle: event.issue.title,
      issueUrl: event.issue.html_url,
      action: event.action,
      userLogin: event.sender.login,
      userUrl: event.sender.html_url,
      timestamp: new Date().toISOString(),
      labels: event.issue.labels.map(label => label.name),
      assignees: event.issue.assignees?.map(assignee => assignee.login) || [],
      body: event.issue.body?.substring(0, 200), // Limit body preview
    };
  }

  private processPullRequestEvent(event: GitHubPullRequestEvent): ProcessedPullRequestData | null {
    if (!event?.action || !event?.pull_request || !event?.repository || !event?.sender) {
      this.logger.debug('Invalid pull request event data');
      return null;
    }

    // Only process open, close, and reopen actions
    if (!['opened', 'closed', 'reopened'].includes(event.action)) {
      this.logger.debug(`Skipping pull request action: ${event.action}`);
      return null;
    }

    return {
      repositoryName: event.repository.full_name,
      repositoryUrl: event.repository.html_url,
      pullRequestNumber: event.pull_request.number,
      pullRequestTitle: event.pull_request.title,
      pullRequestUrl: event.pull_request.html_url,
      action: event.action,
      userLogin: event.sender.login,
      userUrl: event.sender.html_url,
      timestamp: new Date().toISOString(),
      labels: event.pull_request.labels.map(label => label.name),
      assignees: event.pull_request.assignees?.map(assignee => assignee.login) || [],
      body: event.pull_request.body?.substring(0, 200), // Limit body preview
      baseBranch: event.pull_request.base.ref,
      headBranch: event.pull_request.head.ref,
      isDraft: event.pull_request.draft,
      isMerged: event.pull_request.merged,
      changedFiles: event.pull_request.changed_files,
      additions: event.pull_request.additions,
      deletions: event.pull_request.deletions,
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
      case 'issues':
        return this.formatIssueMessage(data as ProcessedIssueData);
      case 'pull_request':
        return this.formatPullRequestMessage(data as ProcessedPullRequestData);
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
      case 'issues': {
        const issueData = data as ProcessedIssueData;
        return {
          inline_keyboard: [
            [
              { text: '🐛 Issue', url: issueData.issueUrl },
              { text: '📚 Repository', url: issueData.repositoryUrl },
            ],
            [{ text: '👤 Profile', url: issueData.userUrl }],
          ],
        };
      }
      case 'pull_request': {
        const prData = data as ProcessedPullRequestData;
        return {
          inline_keyboard: [
            [
              { text: '🔀 Pull Request', url: prData.pullRequestUrl },
              { text: '📚 Repository', url: prData.repositoryUrl },
            ],
            [{ text: '👤 Profile', url: prData.userUrl }],
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

  private formatIssueMessage(data: ProcessedIssueData): string {
    const repoTag = this.getRepoTag(data.repositoryName);
    const emoji = this.getIssueEmoji(data.action);
    const actionText = this.getIssueActionText(data.action);

    let message = `${emoji} <b>${data.userLogin}</b> ${actionText} issue <b>#${data.issueNumber}</b> in <b>${repoTag}</b>\n\n`;
    message += `📋 <b>Title:</b> ${data.issueTitle}\n`;

    if (data.labels.length > 0) {
      message += `🏷️ <b>Labels:</b> ${data.labels.map(label => `<code>${label}</code>`).join(', ')}\n`;
    }

    if (data.assignees.length > 0) {
      message += `👤 <b>Assignees:</b> ${data.assignees.join(', ')}\n`;
    }

    if (data.body && data.body.trim()) {
      const preview = data.body.length > 150 ? `${data.body.substring(0, 147)}...` : data.body;
      message += `\n💬 <i>${preview}</i>`;
    }

    return message;
  }

  private formatPullRequestMessage(data: ProcessedPullRequestData): string {
    const repoTag = this.getRepoTag(data.repositoryName);
    const emoji = this.getPullRequestEmoji(data.action, data.isMerged, data.isDraft);
    const actionText = this.getPullRequestActionText(data.action, data.isMerged);

    let message = `${emoji} <b>${data.userLogin}</b> ${actionText} pull request <b>#${data.pullRequestNumber}</b> in <b>${repoTag}</b>\n\n`;
    message += `📋 <b>Title:</b> ${data.pullRequestTitle}\n`;
    message += `🌿 <b>Branch:</b> <code>${data.headBranch}</code> → <code>${data.baseBranch}</code>\n`;

    if (data.isDraft) {
      message += `📝 <b>Status:</b> Draft\n`;
    }

    if (data.labels.length > 0) {
      message += `🏷️ <b>Labels:</b> ${data.labels.map(label => `<code>${label}</code>`).join(', ')}\n`;
    }

    if (data.assignees.length > 0) {
      message += `👤 <b>Assignees:</b> ${data.assignees.join(', ')}\n`;
    }

    if (data.action === 'opened' || data.action === 'reopened') {
      if (data.changedFiles) {
        message += `📊 <b>Changes:</b> ${data.changedFiles} files`;
        if (data.additions || data.deletions) {
          message += ` (+${data.additions || 0}/-${data.deletions || 0})`;
        }
        message += `\n`;
      }
    }

    if (data.body && data.body.trim()) {
      const preview = data.body.length > 150 ? `${data.body.substring(0, 147)}...` : data.body;
      message += `\n💬 <i>${preview}</i>`;
    }

    return message;
  }

  private getIssueEmoji(action: string): string {
    switch (action) {
      case 'opened':
        return '🐛';
      case 'closed':
        return '✅';
      case 'reopened':
        return '🔄';
      default:
        return '📋';
    }
  }

  private getIssueActionText(action: string): string {
    switch (action) {
      case 'opened':
        return 'opened';
      case 'closed':
        return 'closed';
      case 'reopened':
        return 'reopened';
      default:
        return action;
    }
  }

  private getPullRequestEmoji(action: string, isMerged?: boolean, isDraft?: boolean): string {
    if (action === 'closed' && isMerged) {
      return '🎉';
    }
    
    switch (action) {
      case 'opened':
        return isDraft ? '📝' : '🔀';
      case 'closed':
        return '❌';
      case 'reopened':
        return '🔄';
      default:
        return '🔀';
    }
  }

  private getPullRequestActionText(action: string, isMerged?: boolean): string {
    if (action === 'closed' && isMerged) {
      return 'merged';
    }
    
    switch (action) {
      case 'opened':
        return 'opened';
      case 'closed':
        return 'closed';
      case 'reopened':
        return 'reopened';
      default:
        return action;
    }
  }

  private isPushEvent(event: Partial<GitHubWebhookEvent>): boolean {
    return Boolean(event.ref && event.ref.startsWith('refs/heads/'));
  }
}