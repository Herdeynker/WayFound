export const testAuthHeader = "x-wayfound-test-auth";
export const testAuthHeaderValue = "phase2-static-fixture";

export function isTestFixtureHeader(value: string | null | undefined): boolean {
  return process.env.PLAYWRIGHT_TEST === "1" && value === testAuthHeaderValue;
}
