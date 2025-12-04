# stuffprettygood.com

Frontend application for stuffprettygood.com with dual API architecture.

## 🏗️ Architecture

This application connects to **two separate APIs**:

### 1. Cloudflare Worker API (Serverless)
- **Production**: `https://api.stuffprettygood.com`
- **Local Development**: `http://127.0.0.1:8787`
- Used for: Serverless edge functions, fast global endpoints

### 2. Express Backend API (EC2)
- **Production**: `https://backend.stuffprettygood.com`
- **Local Development**: `http://localhost:3000`
- Used for: Traditional backend operations, database access, heavy processing

## 🔧 Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

### Environment Variables

```bash
# Cloudflare Worker API
VITE_WORKER_API_URL=http://127.0.0.1:8787

# Express Backend API
VITE_BACKEND_API_URL=http://localhost:3000
```

For production, use the production URLs in your deployment environment.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will run at `http://localhost:5173/`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
src/
├── api/
│   ├── client.ts              # workerApiClient & backendApiClient
│   ├── services/
│   │   ├── example.service.ts # Worker API services
│   │   └── backend.service.ts # Backend API services
│   └── hooks/
│       └── example.hooks.ts   # React Query hooks
├── store/
│   ├── index.ts               # Redux store
│   ├── hooks.ts               # Typed Redux hooks
│   └── slices/                # Redux slices
├── config/
│   └── env.ts                 # Environment config
└── App.tsx
```

## 🛠️ Tech Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **Redux Toolkit** for client state management
- **React Query** for server state management
- **Dual API Architecture**:
  - Cloudflare Worker (Serverless)
  - Express Backend (EC2)

## 📝 Usage Examples

### Using Worker API

```typescript
import { workerApiClient } from './api/client';

// Direct client usage
const data = await workerApiClient.get('/hello');

// Or use services
import { exampleService } from './api';
const hello = await exampleService.getHello();
```

### Using Backend API

```typescript
import { backendApiClient } from './api/client';

// Direct client usage
const data = await backendApiClient.get('/health');

// Or use services
import { backendService } from './api';
const health = await backendService.getHealth();
```

## 🌍 Deployment

This app is deployed to Cloudflare Pages and automatically connects to:
- Production Worker API at `https://api.stuffprettygood.com`
- Production Backend API at `https://backend.stuffprettygood.com`

Environment variables are configured in Cloudflare Pages settings.
