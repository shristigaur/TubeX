import cors from 'cors';
export declare const corsMiddleware: (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const handleCorsError: (err: any, req: any, res: any, next: any) => import("express").Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=cors.d.ts.map