import { sendError } from '../utils/response.js';
export const notFoundHandler = (req, res, next) => {
    sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
};
//# sourceMappingURL=notFoundHandler.js.map