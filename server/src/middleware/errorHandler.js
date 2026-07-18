function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  // Full detail in server logs always; only expose the message to the
  // client, and only a generic message for unexpected 500s in production so
  // stack traces / library internals never leak to a client app.
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const clientMessage = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Something went wrong on our end. Please try again.'
    : (err.message || 'Internal server error.');
  res.status(status).json({ error: clientMessage });
}
module.exports = { errorHandler };
