# Push Notifications Setup

## 1. Install Dependencies

```
npm install web-push
```

## 2. Generate VAPID Keys (one-time)

```
node -e "require('web-push').generateVAPIDKeys()"
```

Save the public and private keys in your environment variables or a config file.

## 3. Supabase Table: push_subscriptions

Create a table in Supabase:

| Column         | Type    | Description                       |
| -------------- | ------- | --------------------------------- |
| id             | uuid    | Primary key                       |
| staff_id       | text    | Staff identifier (nullable)        |
| subscription   | jsonb   | Push subscription object          |
| created_at     | timestamptz | Default: now()                |

## 4. Backend Endpoints

- `POST /api/push/subscribe` — Save subscription
- `POST /api/push/notify` — Send notification to all or filtered users

## 5. Frontend

- Register service worker
- Request notification permission
- Subscribe to push
- Send subscription to backend
