# GitHub Webhook to Telegram Bot

A NestJS server that listens for GitHub webhook events and forwards them to Telegram channels. The bot filters push events and sends formatted notifications with commit information, changed files, and relevant details.

## Features

- ✅ GitHub webhook signature verification
- ✅ Push event filtering and processing
- ✅ Commit message extraction and formatting
- ✅ Changed files tracking
- ✅ Author information extraction
- ✅ Repository-specific Telegram channels
- ✅ Environment-based configuration
- ✅ Production-ready NestJS architecture
- ✅ Health check endpoint
- ✅ Comprehensive logging

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Telegram bot token
- A GitHub webhook secret
- A Telegram chat/channel ID

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# GitHub Webhook Configuration
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret_here

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Server Configuration
PORT=3000

# Repository-specific configurations (optional)
# Format: REPO_<REPO_NAME>_CHAT_ID=<chat_id>
# Example: REPO_my-org_my-repo_CHAT_ID=-1001234567890
```

### 3. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the bot token to your `.env` file

### 4. Get Telegram Chat ID

#### For a Channel:
1. Add your bot to the channel as an admin
2. Send a message to the channel
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for the `chat` object and copy the `id` (usually negative for channels)

#### For a Group:
1. Add your bot to the group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Copy the `chat.id` from the response

### 5. Configure GitHub Webhook

1. Go to your GitHub repository
2. Navigate to Settings → Webhooks
3. Click "Add webhook"
4. Configure:
   - **Payload URL**: `https://your-domain.com/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Use the same secret as in your `.env` file
   - **Events**: Select "Just the push event"
5. Click "Add webhook"

## Running the Application

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

## API Endpoints

### Webhook Endpoint
- **POST** `/webhook/github` - Receives GitHub webhook events
- **Headers Required**: 
  - `x-hub-signature-256`: GitHub webhook signature
  - `x-github-event`: Event type (e.g., "push")

### Health Check
- **POST** `/webhook/health` - Health check endpoint
- Returns: `{ status: "ok", timestamp: "..." }`

## Repository-Specific Channels

You can configure different Telegram channels for different repositories by adding environment variables:

```env
# For repository "my-org/my-repo"
REPO_my-org_my-repo_CHAT_ID=-1001234567890

# For repository "another-org/another-repo"
REPO_another-org_another-repo_CHAT_ID=-1009876543210
```

If no repository-specific chat ID is configured, the bot will use the default `TELEGRAM_CHAT_ID`.

## Message Format

The bot sends formatted messages with:

- 🚀 Repository and branch information
- 👤 Pusher and author details
- 📝 Commit messages (truncated if too long)
- 📁 Changed files list (limited to 10 files)
- 🔗 Link to view changes on GitHub

Example message:
```
🚀 New push to my-org/my-repo

📍 Branch: main
👤 Pusher: john-doe
👥 Authors: John Doe, Jane Smith

📝 Commits:
1. Fix authentication bug
2. Update documentation
3. Add new feature

📁 Changed files:
• + src/auth.ts
• ~ src/config.ts
• - old-file.js

🔗 View changes
```

## Development

### Project Structure

```
src/
├── config/
│   └── configuration.ts          # Environment configuration
├── controllers/
│   └── webhook.controller.ts     # Webhook endpoint handlers
├── interfaces/
│   └── github-webhook.interface.ts # TypeScript interfaces
├── services/
│   ├── github-webhook.service.ts # GitHub webhook processing
│   └── telegram.service.ts       # Telegram bot API
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Security

- Webhook signatures are verified using HMAC SHA-256
- Environment variables are used for sensitive configuration
- Input validation and error handling are implemented
- Production-ready logging and monitoring

## Deployment

### Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
```

### Environment Variables for Production

Make sure to set all required environment variables in your production environment:

- `GITHUB_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `PORT` (optional, defaults to 3000)

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Ensure the webhook secret matches between GitHub and your `.env` file
   - Check that the secret is properly configured in GitHub webhook settings

2. **Telegram messages not sending**
   - Verify your bot token is correct
   - Ensure the bot has permission to send messages to the chat
   - Check that the chat ID is correct (negative for channels/groups)

3. **Repository-specific channels not working**
   - Verify the environment variable format: `REPO_<org>_<repo>_CHAT_ID`
   - Check that the repository name matches exactly (case-sensitive)

### Logs

The application provides detailed logging for debugging:

- Webhook reception and processing
- Signature verification results
- Telegram message sending status
- Error details and stack traces

## License

This project is licensed under the MIT License.
