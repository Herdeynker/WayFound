import { describe, expect, it } from "vitest";
import { validateOfficialApplicationUrl } from "@/server/opportunity-experience/application-link";

const domains = ["university.example", "apply.example"];
const valid = (value: string) =>
  expect(validateOfficialApplicationUrl(value, domains)).toEqual({ available: true, url: value });
const unavailable = (value: string) =>
  expect(validateOfficialApplicationUrl(value, domains).available).toBe(false);

describe("official application link validation", () => {
  it("permits registered official and approved application-provider HTTPS domains", () => {
    valid("https://admissions.university.example/apply");
    valid("https://apply.example/openings/123");
  });
  it("rejects absent, malformed, non-HTTPS and credential-bearing URLs", () => {
    expect(validateOfficialApplicationUrl(null, domains).available).toBe(false);
    unavailable("not a url");
    unavailable("http://university.example/apply");
    unavailable("https://user:password@university.example/apply");
  });
  it("rejects lookalikes, unsafe hosts, IPs, ports and dangerous schemes", () => {
    unavailable("https://university.example.attacker.test/apply");
    unavailable("https://attacker.university-example.test/apply");
    unavailable("https://127.0.0.1/apply");
    unavailable("https://localhost/apply");
    unavailable("https://university.example:444/apply");
    unavailable("javascript:alert(1)");
    unavailable("data:text/html,unsafe");
  });
  it("rejects untrusted redirect parameters while permitting an approved destination", () => {
    unavailable("https://university.example/apply?next=https%3A%2F%2Fevil.test");
    valid("https://university.example/apply?next=https%3A%2F%2Fapply.example%2Fcontinue");
  });
});
