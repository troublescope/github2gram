import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GitHubWebhookService } from './github-webhook.service';
import { GitHubWebhookEvent } from '../interfaces/github-webhook.interface';

describe('GitHubWebhookService', () => {
  let service: GitHubWebhookService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubWebhookService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'github.webhookSecret') {
                return 'test-secret';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GitHubWebhookService>(GitHubWebhookService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = '{"test": "data"}';
      const signature = 'sha256=1234567890abcdef';

      // Mock the crypto function to return a predictable result
      jest.spyOn(require('crypto'), 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('1234567890abcdef'),
      });

      jest.spyOn(require('crypto'), 'timingSafeEqual').mockReturnValue(true);

      const result = service.verifySignature(payload, signature);
      expect(result).toBe(true);
    });
  });

  describe('processWebhookEvent', () => {
    it('should process valid push event', () => {
      const mockEvent: GitHubWebhookEvent = {
        ref: 'refs/heads/main',
        before: 'abc123',
        after: 'def456',
        repository: {
          id: 1,
          node_id: 'test',
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          private: false,
          owner: {
            login: 'test-user',
            id: 1,
            node_id: 'test',
            avatar_url: 'https://example.com/avatar.jpg',
            gravatar_id: '',
            url: 'https://api.github.com/users/test-user',
            html_url: 'https://github.com/test-user',
            followers_url: 'https://api.github.com/users/test-user/followers',
            following_url:
              'https://api.github.com/users/test-user/following{/other_user}',
            gists_url: 'https://api.github.com/users/test-user/gists{/gist_id}',
            starred_url:
              'https://api.github.com/users/test-user/starred{/owner}{/repo}',
            subscriptions_url:
              'https://api.github.com/users/test-user/subscriptions',
            organizations_url: 'https://api.github.com/users/test-user/orgs',
            repos_url: 'https://api.github.com/users/test-user/repos',
            events_url:
              'https://api.github.com/users/test-user/events{/privacy}',
            received_events_url:
              'https://api.github.com/users/test-user/received_events',
            type: 'User',
            site_admin: false,
          },
          description: null,
          fork: false,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          pushed_at: '2023-01-01T00:00:00Z',
          git_url: 'git://github.com/test-org/test-repo.git',
          ssh_url: 'git@github.com:test-org/test-repo.git',
          clone_url: 'https://github.com/test-org/test-repo.git',
          svn_url: 'https://github.com/test-org/test-repo',
          homepage: null,
          size: 0,
          stargazers_count: 0,
          watchers_count: 0,
          language: null,
          has_issues: true,
          has_projects: true,
          has_downloads: true,
          has_wiki: true,
          has_pages: false,
          has_discussions: false,
          forks_count: 0,
          mirror_url: null,
          archived: false,
          disabled: false,
          license: null,
          allow_forking: true,
          is_template: false,
          web_commit_signoff_required: false,
          topics: [],
          visibility: 'public',
          forks: 0,
          open_issues: 0,
          watchers: 0,
          default_branch: 'main',
          stargazers: 0,
          master_branch: 'main',
        },
        pusher: {
          name: 'test-user',
          email: 'test@example.com',
        },
        sender: {
          login: 'test-user',
          id: 1,
          node_id: 'test',
          avatar_url: 'https://example.com/avatar.jpg',
          gravatar_id: '',
          url: 'https://api.github.com/users/test-user',
          html_url: 'https://github.com/test-user',
          followers_url: 'https://api.github.com/users/test-user/followers',
          following_url:
            'https://api.github.com/users/test-user/following{/other_user}',
          gists_url: 'https://api.github.com/users/test-user/gists{/gist_id}',
          starred_url:
            'https://api.github.com/users/test-user/starred{/owner}{/repo}',
          subscriptions_url:
            'https://api.github.com/users/test-user/subscriptions',
          organizations_url: 'https://api.github.com/users/test-user/orgs',
          repos_url: 'https://api.github.com/users/test-user/repos',
          events_url: 'https://api.github.com/users/test-user/events{/privacy}',
          received_events_url:
            'https://api.github.com/users/test-user/received_events',
          type: 'User',
          site_admin: false,
        },
        created: false,
        deleted: false,
        forced: false,
        base_ref: null,
        compare:
          'https://github.com/test-org/test-repo/compare/abc123...def456',
        commits: [
          {
            id: 'def456',
            tree_id: 'tree123',
            distinct: true,
            message: 'Test commit message',
            timestamp: '2023-01-01T00:00:00Z',
            url: 'https://github.com/test-org/test-repo/commit/def456',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              username: 'test-user',
            },
            committer: {
              name: 'Test User',
              email: 'test@example.com',
              username: 'test-user',
            },
            added: ['new-file.txt'],
            removed: ['old-file.txt'],
            modified: ['modified-file.txt'],
          },
        ],
        head_commit: {
          id: 'def456',
          tree_id: 'tree123',
          distinct: true,
          message: 'Test commit message',
          timestamp: '2023-01-01T00:00:00Z',
          url: 'https://github.com/test-org/test-repo/commit/def456',
          author: {
            name: 'Test User',
            email: 'test@example.com',
            username: 'test-user',
          },
          committer: {
            name: 'Test User',
            email: 'test@example.com',
            username: 'test-user',
          },
          added: ['new-file.txt'],
          removed: ['old-file.txt'],
          modified: ['modified-file.txt'],
        },
      };

      const result = service.processWebhookEvent(mockEvent);

      expect(result).toBeDefined();
      expect(result?.repositoryName).toBe('test-org/test-repo');
      expect(result?.branchName).toBe('main');
      expect(result?.commitMessages).toEqual(['Test commit message']);
      expect(result?.authors).toEqual(['Test User']);
      expect(result?.changedFiles).toContain('+ new-file.txt');
      expect(result?.changedFiles).toContain('- old-file.txt');
      expect(result?.changedFiles).toContain('~ modified-file.txt');
    });

    it('should return null for non-push events', () => {
      const mockEvent = {
        ref: 'refs/tags/v1.0.0', // Tag ref, not a push event
        repository: { full_name: 'test-org/test-repo' },
        commits: [],
      };

      const result = service.processWebhookEvent(mockEvent as any);
      expect(result).toBeNull();
    });
  });

  describe('formatWebhookMessage', () => {
    it('should format message correctly', () => {
      const mockData = {
        repositoryName: 'test-org/test-repo',
        branchName: 'main',
        commitMessages: ['Test commit message'],
        authors: ['Test User'],
        timestamp: '2023-01-01T00:00:00Z',
        changedFiles: ['+ new-file.txt', '- old-file.txt'],
        compareUrl:
          'https://github.com/test-org/test-repo/compare/abc123...def456',
        pusher: 'test-user',
      };

      const result = service.formatWebhookMessage(mockData);

      expect(result).toContain('🚀 *New push to test-org/test-repo*');
      expect(result).toContain('📍 *Branch:* `main`');
      expect(result).toContain('👤 *Pusher:* test-user');
      expect(result).toContain('👥 *Authors:* Test User');
      expect(result).toContain('📝 *Commits:*');
      expect(result).toContain('1. Test commit message');
      expect(result).toContain('📁 *Changed files:*');
      expect(result).toContain('• + new-file.txt');
      expect(result).toContain('• - old-file.txt');
      expect(result).toContain('🔗 [View changes]');
    });
  });
});
