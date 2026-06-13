# osu! Realtime Dashboard

A real-time web dashboard for tracking osu! player statistics with live estimation between API updates.

## Features

- **Real-time Estimation**: Tracks trends and estimates current stats between API updates
- **Multi-user Comparison**: Compare up to 5 users on interactive charts
- **Live Updates**: Statistics update every second with API corrections every 5 minutes
- **Multi-mode Support**: Support for osu!, osu!taiko, osu!catch, and osu!mania
- **Database Integration**: Uses the same PostgreSQL database as the Discord bot

## Technology Stack

- **Next.js 14** with TypeScript
- **Tailwind CSS** for styling
- **Recharts** for interactive charts
- **PostgreSQL** database (shared with Discord bot)
- **osu! API v2** for live data

## Setup

1. Copy environment variables from the bot:
   ```bash
   cp ../bot/.env .env.local
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

## API Endpoints

- `GET /api/users?mode=osu` - Get all tracked users with latest stats
- `GET /api/users/[userId]/stats?mode=osu` - Get current stats for a user
- `GET /api/users/[userId]/history?mode=osu&hours=24` - Get historical data

## Real-time Estimation Algorithm

The dashboard uses a sophisticated estimation system:

1. **Trend Calculation**: Analyzes the last 10 snapshots to determine PP/rank trends
2. **Linear Interpolation**: Estimates current values based on historical trends
3. **Confidence Scoring**: Provides confidence levels based on data freshness and consistency
4. **API Correction**: Periodically fetches real data to correct estimates

## Database Schema

Uses the same tables as the Discord bot:
- `osu_tracked_users` - User tracking information
- `osu_user_snapshots` - Historical statistics snapshots
- `osu_best_scores` - Best score tracking

## Deployment

The dashboard can be deployed independently of the bot:

```bash
npm run build
npm start
```

Make sure to set the same DATABASE_URL and osu! API credentials as the bot.