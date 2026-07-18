// Wraps a zod schema as Express middleware. Validates req.body and replaces
// it with the parsed (type-coerced, whitespace-trimmed) result, so route
// handlers can trust the shape of what they receive instead of re-checking
// `if (!x)` everywhere.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request.',
        details: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
