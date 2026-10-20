const errorHandler = (err, req, res, next) => {
  // Always log full diagnostic trace on the server terminal
  console.error(`[SERVER ERROR] ${err.stack || err.message}`);

  const statusCode = res.statusCode === 200 ? (err.statusCode || 500) : res.statusCode;
  
  // Security: Do not expose raw filesystem paths or internal stack traces to HTTP responses
  const safeMessage = (err.message || 'Internal Server Error').replace(/([A-Za-z]:\\[^"'\n]+|\/[a-zA-Z0-9_\-\.\/]+)/g, '[REDACTED_PATH]');

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR'
  });
};

module.exports = errorHandler;
