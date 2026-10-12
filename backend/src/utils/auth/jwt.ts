import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { config } from '../../config/env.js';

export const JWT_ALGORITHM = 'HS256' as const;

export interface JwtPayload {
  sub: string;
  role: string;
}

export const signAccessToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    ...(config.jwtAccessExpiresIn ? { expiresIn: config.jwtAccessExpiresIn as SignOptions['expiresIn'] } : {}),
  };
  return jwt.sign(payload, config.jwtAccessSecret, options);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret, {
      algorithms: [JWT_ALGORITHM],
    }) as jwt.JwtPayload;
    
    if (!decoded.sub || !decoded.role) {
      throw new Error('Invalid token payload');
    }
    
    return {
      sub: decoded.sub,
      role: decoded.role as string,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};
