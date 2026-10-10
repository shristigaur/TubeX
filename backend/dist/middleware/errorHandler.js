import { sendError } from '../utils/response.js';
import { config } from '../config/env.js';
export const errorHandler = (err, req, res, next) => {
    console.error('[Error]:', err);
    const statusCode = err.status || 500;
    const message = err.message || 'Internal Server Error';
    // Do not expose stack traces in production
    const errorDetails = config.env === 'development' ? err.stack : undefined;
    sendError(res, statusCode, message, errorDetails);
};
//# sourceMappingURL=errorHandler.js.map