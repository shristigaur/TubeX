export const sendSuccess = (res, statusCode, message, data) => {
    return res.status(statusCode).json({
        success: true,
        message,
        ...(data && { data }),
    });
};
export const sendError = (res, statusCode, message, error) => {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(error && { error }),
    });
};
//# sourceMappingURL=response.js.map