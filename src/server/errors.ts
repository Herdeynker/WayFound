import "server-only";

import { NextResponse } from "next/server";
import { serializeError } from "./logging";

export class ApplicationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly safeMessage: string;

  constructor(code: string, safeMessage: string, status = 400) {
    super(safeMessage);
    this.name = "ApplicationError";
    this.code = code;
    this.status = status;
    this.safeMessage = safeMessage;
  }
}

export function toSafeErrorResponse(error: unknown, correlationId: string): NextResponse {
  const applicationError = error instanceof ApplicationError ? error : undefined;
  const status = applicationError?.status ?? 500;
  const body = {
    error: applicationError?.safeMessage ?? "Something went wrong. Please try again.",
    code: applicationError?.code ?? "INTERNAL_ERROR",
    correlationId,
  };
  if (process.env.NODE_ENV !== "production") {
    const details = serializeError(error);
    return NextResponse.json({ ...body, debug: details }, { status });
  }
  return NextResponse.json(body, { status });
}
