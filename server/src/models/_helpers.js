function applyCleanJSON(schema) {
  schema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      return ret;
    },
  });
}
module.exports = { applyCleanJSON };
