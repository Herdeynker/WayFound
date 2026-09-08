import "server-only";

import { randomUUID } from "node:crypto";
import type {
  AIProvider,
  DiscoveryProvider,
  DiscoveryResult,
  EmailProvider,
  PaymentProvider,
  ProviderName,
  ProviderReceipt,
  TelegramProvider,
} from "./types";
import { ProviderDisabledError } from "./types";

const disabled = (provider: ProviderName, operation: string): never => {
  throw new ProviderDisabledError(provider, operation);
};

export function createDisabledAIProvider(): AIProvider {
  return { generateStructured: async <T>() => disabled("ai", "generateStructured") as T };
}

export function createDisabledDiscoveryProvider(): DiscoveryProvider {
  return {
    search: async (): Promise<readonly DiscoveryResult[]> => disabled("discovery", "search"),
  };
}

export function createDisabledEmailProvider(): EmailProvider {
  return { send: async (): Promise<ProviderReceipt> => disabled("email", "send") };
}

export function createDisabledTelegramProvider(): TelegramProvider {
  return {
    sendMessage: async (): Promise<ProviderReceipt> => disabled("telegram", "sendMessage"),
  };
}

export function createDisabledPaymentProvider(): PaymentProvider {
  return {
    createCheckout: async (): Promise<ProviderReceipt> => disabled("payment", "createCheckout"),
    verifyWebhook: async (): Promise<unknown> => disabled("payment", "verifyWebhook"),
  };
}

export function developmentReceipt(provider: ProviderName, operation: string): ProviderReceipt {
  return { provider, operation, requestId: randomUUID() };
}
