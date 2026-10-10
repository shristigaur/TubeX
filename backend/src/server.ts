import "dotenv/config";
import app from './app.js';
import { config } from './config/env.js';
import { prisma } from './config/prisma.js';

const startServer = async () => {
  try {
    // Database connection verification
    await prisma.$connect();
    console.log('[Server]: Connected to MongoDB successfully.');

    app.listen(config.port, () => {
      console.log(`[Server]: API is running at http://localhost:${config.port}`);
      console.log(`[Server]: Environment: ${config.env}`);
    });
  } catch (error) {
    console.error('[Server]: Failed to start the server. Database connection failed.');
    if (error instanceof Error) {
      console.error(`[Error]: ${error.message}`);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
