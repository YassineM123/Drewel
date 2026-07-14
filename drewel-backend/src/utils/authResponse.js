export const sanitizeAuthSubject = (subject) => {
  if (!subject) return subject;

  const value = typeof subject.toObject === "function" ? subject.toObject() : { ...subject };
  delete value.password;
  delete value.otpCode;
  return value;
};
