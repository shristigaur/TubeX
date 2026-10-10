import type { Response } from 'express';
export declare const sendSuccess: (res: Response, statusCode: number, message: string, data?: any) => Response<any, Record<string, any>>;
export declare const sendError: (res: Response, statusCode: number, message: string, error?: any) => Response<any, Record<string, any>>;
//# sourceMappingURL=response.d.ts.map