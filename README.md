# TubeX

## Project Purpose
TubeX is a global marketplace where users from different countries can list, discover, evaluate, negotiate, and eventually sell or buy YouTube channels through a secure and structured marketplace workflow.

## Technology Stack
- **Frontend**: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MongoDB, Prisma ORM

## Frontend/Backend Separation
The project maintains a strict separation of concerns between the frontend and backend. The frontend is a pure UI layer that consumes backend APIs. It does not perform direct database queries or contain backend-specific business logic. 

**Important Rule**: The frontend must NEVER directly access MongoDB or Prisma. All database operations, authentication, authorization, and business logic must be handled exclusively by the backend API.

## Planned Deployment Architecture
- **Frontend**: Vercel
- **Backend**: Render
- **Database**: MongoDB Atlas

## High-Level Folder Structure
```
TubeX/
├── frontend/      # Next.js application
└── backend/       # Node.js / Express application
```

## Development Philosophy
- Use TypeScript strictly throughout the project.
- Keep frontend and backend independently deployable.
- Do not duplicate business logic.
- Environment variables must be used for all secrets and configuration.
- Avoid unnecessary dependencies and premature abstractions.
- Prefer maintainable production architecture over clever code.
