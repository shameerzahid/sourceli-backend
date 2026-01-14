# Sourceli Backend API

Backend API for the Sourceli B2B fresh produce and livestock supply marketplace.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL and secrets
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

5. Seed the database (optional):
```bash
npm run prisma:seed
```

### Development

Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:seed` - Seed the database

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts           # Database seed script
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   └── server.ts         # Entry point
├── .env                  # Environment variables (not in git)
├── .env.example          # Example environment variables
├── package.json
└── tsconfig.json
```

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Authentication (Coming Soon)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh access token

## Environment Variables

See `.env.example` for all required environment variables.

## License

ISC


# sourceli-backend
