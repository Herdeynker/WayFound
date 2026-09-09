import "server-only";

import { isIP } from "node:net";
import { domainToASCII } from "node:url";

export type OfficialApplicationAction =
  { available: true; url: string } | { available: false; reason: string };

const blockedSuffixes = ["localhost", "local", "internal", "home", "lan"];
const redirectParameterNames = new Set([
  "continue",
  "destination",
  "next",
  "redirect",
  "redirect_uri",
  "return",
  "returnto",
  "url",
]);

function normaliseDomain(value: string): string | null {
  const candidate = value.trim().replace(/\.$/, "").toLowerCase();
  if (!candidate || /[\u0000-\u001f\u007f\\/@]/.test(candidate)) return null;
  const ascii = domainToASCII(candidate);
  if (!ascii || ascii.length > 253 || isIP(ascii)) return null;
  if (ascii.split(".").some((label) => !label || label.length > 63 || !/^[a-z0-9-]+$/.test(label)))
    return null;
  if (blockedSuffixes.some((suffix) => ascii === suffix || ascii.endsWith(`.${suffix}`))) return null;
  return ascii;
}

function belongsToDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function hasUnsafeEncodedCharacter(value: string) {
  try {
    return /[\u0000-\u001f\u007f]/.test(decodeURIComponent(value));
  } catch {
    return true;
  }
}

/**
 * Validates a stored official URL on the server. It never follows redirects or
 * proxies navigation: the browser opens the exact validated stored URL.
 */
export function validateOfficialApplicationUrl(
  candidate: string | null | undefined,
  approvedDomains: readonly string[],
): OfficialApplicationAction {
  if (!candidate?.trim()) return { available: false, reason: "No official application link is available." };
  if (/\s|[\u0000-\u001f\u007f]/.test(candidate) || hasUnsafeEncodedCharacter(candidate))
    return { available: false, reason: "The stored application link is not safely formatted." };

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { available: false, reason: "The stored application link is not valid." };
  }
  if (url.protocol !== "https:")
    return { available: false, reason: "Official application links must use HTTPS." };
  if (url.username || url.password)
    return { available: false, reason: "The stored application link contains unsafe credentials." };
  if (url.port && url.port !== "443")
    return { available: false, reason: "The stored application link uses an unsafe port." };
  const host = normaliseDomain(url.hostname);
  if (!host) return { available: false, reason: "The stored application link targets an unsafe host." };
  const domains = approvedDomains.map(normaliseDomain).filter((domain): domain is string => Boolean(domain));
  if (!domains.some((domain) => belongsToDomain(host, domain)))
    return { available: false, reason: "The stored application link is not on an approved official domain." };

  for (const [key, value] of url.searchParams) {
    if (!redirectParameterNames.has(key.toLowerCase())) continue;
    try {
      const redirect = new URL(value);
      const redirectHost = normaliseDomain(redirect.hostname);
      if (
        !redirectHost ||
        redirect.protocol !== "https:" ||
        !domains.some((domain) => belongsToDomain(redirectHost, domain))
      )
        return {
          available: false,
          reason: "The stored application link contains an untrusted redirect destination.",
        };
    } catch {
      return {
        available: false,
        reason: "The stored application link contains an invalid redirect destination.",
      };
    }
  }
  return { available: true, url: url.toString() };
}
