import { sendSuccess } from '../utils/response.js';
import { config } from '../config/env.js';
export const checkHealth = (req, res) => {
    sendSuccess(res, 200, 'TubeX API is running', {
        environment: config.env,
        timestamp: new Date().toISOString()
    });
};
//# sourceMappingURL=health.controller.js.map