export function canViewConfidential(user) {
  return user?.role === "admin" || user?.role === "maker";
}

export function canWrite(user) {
  return user?.role === "admin" || user?.role === "maker";
}

export function mask(value) {
  if (!value && value !== 0) return "••••••••";
  return "••••••••";
}

export function reveal(value, allowed) {
  if (!allowed) return mask(value);
  return value;
}
