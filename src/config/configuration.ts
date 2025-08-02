export interface AppConfig {
  github: {
    webhookSecret: string;
  };
  telegram: {
    botToken: string;
    defaultChatId: string;
  };
  server: {
    port: number;
  };
  repositories: Record<string, string>; // repo_name -> chat_id mapping
}

export default (): AppConfig => {
  const repositories: Record<string, string> = {};

  // Parse repository-specific configurations
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('REPO_') && key.endsWith('_CHAT_ID')) {
      const repoName = key.replace('REPO_', '').replace('_CHAT_ID', '');
      repositories[repoName] = process.env[key]!;
    }
  });

  return {
    github: {
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      defaultChatId: process.env.TELEGRAM_CHAT_ID || '',
    },
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
    },
    repositories,
  };
};
