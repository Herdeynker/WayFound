import "server-only";

import { z } from "zod";
import { parseServerEnvironment } from "@/lib/env/schema";
import {
  createDisabledEmailProvider,
  createDisabledTelegramProvider,
  type EmailMessage,
  type EmailProvider,
  type ProviderReceipt,
  type TelegramProvider,
} from "@/server/providers";

const resendResponseSchema = z.object({ id: z.string().min(1).max(180) });
const telegramResponseSchema = z.object({
  ok: z.literal(true),
  result: z.object({ message_id: z.number().int() }),
});

class NotificationProviderError extends Error {
  readonly retryable: boolean;
  readonly code: "PROVIDER_TIMEOUT" | "PROVIDER_TEMPORARY" | "PROVIDER_PERMANENT";

  constructor(code: NotificationProviderError["code"], retryable: boolean) {
    super("The notification provider could not complete delivery.");
    this.name = "NotificationProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

async function boundedFetch(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      return boundedFetch(url, init, 1);
    }
    if (response.status === 429 || response.status >= 500)
      throw new NotificationProviderError("PROVIDER_TEMPORARY", true);
    if (!response.ok) throw new NotificationProviderError("PROVIDER_PERMANENT", false);
    return response;
  } catch (error) {
    if (error instanceof NotificationProviderError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      if (attempt === 0) return boundedFetch(url, init, 1);
      throw new NotificationProviderError("PROVIDER_TIMEOUT", true);
    }
    throw new NotificationProviderError("PROVIDER_TEMPORARY", true);
  }
}

export function createResendEmailProvider(apiKey: string, fromAddress: string): EmailProvider {
  return {
    async send(message: EmailMessage): Promise<ProviderReceipt> {
      const response = await boundedFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: fromAddress,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      const parsed = resendResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new NotificationProviderError("PROVIDER_PERMANENT", false);
      return { provider: "email", operation: "send", requestId: parsed.data.id };
    },
  };
}

export function createTelegramBotProvider(botToken: string): TelegramProvider {
  return {
    async sendMessage(chatId: string, text: string): Promise<ProviderReceipt> {
      const response = await boundedFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      const parsed = telegramResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) throw new NotificationProviderError("PROVIDER_PERMANENT", false);
      return {
        provider: "telegram",
        operation: "sendMessage",
        requestId: String(parsed.data.result.message_id),
      };
    },
  };
}

export function createConfiguredNotificationProviders(): {
  email: EmailProvider;
  telegram: TelegramProvider;
} {
  const env = parseServerEnvironment();
  return {
    email:
      env.RESEND_API_KEY && env.NOTIFICATION_EMAIL_FROM
        ? createResendEmailProvider(env.RESEND_API_KEY, env.NOTIFICATION_EMAIL_FROM)
        : createDisabledEmailProvider(),
    telegram: env.TELEGRAM_BOT_TOKEN
      ? createTelegramBotProvider(env.TELEGRAM_BOT_TOKEN)
      : createDisabledTelegramProvider(),
  };
}

export { NotificationProviderError };
