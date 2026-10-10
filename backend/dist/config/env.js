export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
};
// Validate required configurations during startup
if (!config.databaseUrl) {
    console.error('[Error]: DATABASE_URL is missing from environment.');
    process.exit(1);
}
if (!config.jwtAccessSecret) {
    console.error('[Error]: JWT_ACCESS_SECRET is missing from environment.');
    process.exit(1);
}
//# sourceMappingURL=env.js.map