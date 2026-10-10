import express, {} from 'express';
import helmet from 'helmet';
import apiV1Routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { corsMiddleware, handleCorsError } from './middleware/security/cors.js';
import { globalRateLimiter } from './middleware/security/rateLimiter.js';
const app = express();
// Security Headers
app.use(helmet());
// CORS Configuration
app.use(corsMiddleware);
// JSON Request Parsing (limits body size to 10mb)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// General Request Protection / Rate Limiting
// Placed after body parsing as requested by standard pipeline, but often better before it to prevent parsing abuse.
// Left here per prompt's suggested order.
app.use(globalRateLimiter);
// API Routes
app.use('/api/v1', apiV1Routes);
// CORS Error Handler (catches CORS errors thrown by the cors middleware callback)
app.use(handleCorsError);
// 404 Handler for unknown routes
app.use(notFoundHandler);
// Centralized Error Handling Middleware
app.use(errorHandler);
export default app;
//# sourceMappingURL=app.js.map