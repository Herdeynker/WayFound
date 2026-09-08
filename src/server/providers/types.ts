import "server-only";

import type { ZodType } from "zod";

export type ProviderName = "ai" | "discovery" | "email" | "telegram" | "payment";

export class ProviderDisabledError extends Error {
  readonly code = "PROVIDER_DISABLED" as const;
  readonly provider: ProviderName;

  constructor(provider: ProviderName, operation: string) {
    super(`${provider} provider is disabled; operation '${operation}' is unavailable`);
    this.name = "ProviderDisabledError";
    this.provider = provider;
  }
}

export interface ProviderReceipt {
  provider: ProviderName;
  operation: string;
  requestId: string;
}

export interface AIProvider {
  generateStructured<T>(request: { operation: string; input: unknown; outputSchema: ZodType<T> }): Promise<T>;
}

export interface DiscoveryQuery {
  query: string;
  sourceDomains?: readonly string[];
  limit: number;
}

export interface DiscoveryResult {
  title: string;
  url: string;
  sourceDomain: string;
}

export interface DiscoveryProvider {
  search(query: DiscoveryQuery): Promise<readonly DiscoveryResult[]>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<ProviderReceipt>;
}

export interface TelegramProvider {
  sendMessage(chatId: string, text: string): Promise<ProviderReceipt>;
}

export interface PaymentProvider {
  createCheckout(input: { customerReference: string; productReference: string }): Promise<ProviderReceipt>;
  verifyWebhook(input: { rawBody: string; signature: string }): Promise<unknown>;
}
