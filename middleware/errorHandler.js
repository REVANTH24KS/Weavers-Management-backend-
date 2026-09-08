export function errorHandler(err, req, res, next) {
  console.error("Unhandled Error:", err);

  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || "SERVER_ERROR";
  let message = err.message || "An unexpected error occurred";
  let details = err.details || undefined;

  // MongoDB duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = "CONFLICT";
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `Duplicate value provided for ${field}`;
    details = [{ field, message: `A record with this ${field} already exists` }];
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = "Validation error";
    details = Object.keys(err.errors).map((key) => ({
      field: key,
      message: err.errors[key].message
    }));
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    errorCode = "UNAUTHORIZED";
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {})
    }
  });
}
