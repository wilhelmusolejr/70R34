export function canViewConfidential(user) {
  return user?.role === "admin" || user?.role === "maker";
}

export function canWrite(user) {
  return user?.role === "admin" || user?.role === "maker";
}

export function defaultStatusFilterFor(user) {
  if (user?.role === "admin") return ["Need Setup", "Active"];
  if (user?.role === "maker") return ["Pending Profile", "Available"];
  return [];
}

export function allowedStatusesFor(user, allStatuses) {
  if (user?.role === "maker") return ["Pending Profile", "Available"];
  return allStatuses;
}

export function mask(value) {
  if (!value && value !== 0) return "••••••••";
  return "••••••••";
}

export function reveal(value, allowed) {
  if (!allowed) return mask(value);
  return value;
}
