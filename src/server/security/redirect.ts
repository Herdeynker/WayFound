import "server-only";

export function getSafeRedirectPath(candidate: string | null | undefined, fallback = "/"): string {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.includes("\u0000")
  ) {
    return fallback;
  }
  return candidate;
}
