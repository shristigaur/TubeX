import cors from 'cors';
import { config } from '../../config/env.js';
import { sendError } from '../../utils/response.js';
export const corsMiddleware = cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server or curl in dev)
        // and explicitly configured frontend URL.
        if (!origin || origin === config.frontendUrl) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // credentials: true, // commented out; to be enabled when auth cookies/sessions are added
});
// A small wrapper to handle CORS errors gracefully according to the API convention
export const handleCorsError = (err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return sendError(res, 403, 'Origin not allowed by CORS');
    }
    next(err);
};
//# sourceMappingURL=cors.js.map