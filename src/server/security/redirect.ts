import "server-only";

export function getSafeRedirectPath(candidate: string | null | undefined, fallback = "/"): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  return candidate;
}
