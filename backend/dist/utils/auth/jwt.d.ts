export interface JwtPayload {
    sub: string;
    role: string;
}
export declare const signAccessToken: (payload: JwtPayload) => string;
export declare const verifyAccessToken: (token: string) => JwtPayload;
//# sourceMappingURL=jwt.d.ts.map