import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
export const signAccessToken = (payload) => {
    const options = (config.jwtAccessExpiresIn
        ? { expiresIn: config.jwtAccessExpiresIn }
        : {});
    return jwt.sign(payload, config.jwtAccessSecret, options);
};
export const verifyAccessToken = (token) => {
    try {
        const decoded = jwt.verify(token, config.jwtAccessSecret);
        if (!decoded.sub || !decoded.role) {
            throw new Error('Invalid token payload');
        }
        return {
            sub: decoded.sub,
            role: decoded.role,
        };
    }
    catch (error) {
        throw new Error('Invalid or expired token');
    }
};
//# sourceMappingURL=jwt.js.map