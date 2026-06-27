export function validate(schema, source = "body") {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map((d) => d.message).join("; ");
      return res.status(400).json({ error: true, message });
    }
    req[source] = value;
    next();
  };
}
