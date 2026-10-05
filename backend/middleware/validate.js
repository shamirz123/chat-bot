const { z } = require("zod");

const email = z.string().trim().toLowerCase().email("A valid email is required").max(254);

const schemas = {
  register: z.object({
    email,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
  }),
  // No length rules on login so accounts created before the policy still work.
  login: z.object({ email, password: z.string().min(1, "Password is required").max(128) }),
  chat: z.object({
    message: z
      .string()
      .trim()
      .min(1, "Message required")
      .max(4000, "Message must be at most 4000 characters"),
  }),
};

// Express middleware: replaces req.body with the parsed value or answers 400.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate, schemas };
