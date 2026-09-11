import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  NotificationPreferences,
  type NotificationPreferencesView,
} from "@/features/notifications/notification-preferences";

const model: NotificationPreferencesView = {
  email: "user@example.test",
  emailVerified: true,
  emailConsented: true,
  telegramConsented: true,
  emailFrequency: "daily",
  telegramFrequency: "instant",
  timezone: "Africa/Lagos",
  quietHoursEnabled: true,
  quietStart: "22:00",
  quietEnd: "07:00",
  eventTypes: ["strong_match", "deadline"],
  telegramLinked: true,
  telegramLabel: "Linked privately",
  emailProviderConfigured: true,
  telegramProviderConfigured: true,
  recentDeliveries: [
    {
      id: "one",
      label: "Strong match ready",
      channel: "telegram",
      status: "sent",
      deepLink: "/opportunities/11111111-1111-4111-8111-111111111111",
    },
  ],
};

afterEach(cleanup);

describe("Phase 11 notification preferences", () => {
  it("shows verified channels, quiet hours, safe history and saves explicitly", async () => {
    render(<NotificationPreferences fixture initial={model} />);
    expect(screen.getByRole("heading", { name: "Alerts that respect your time" })).toBeInTheDocument();
    expect(screen.getByText("Email verified")).toBeInTheDocument();
    expect(screen.getByLabelText("Timezone")).toHaveValue("Africa/Lagos");
    expect(screen.getByText("Strong match ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save alert choices" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("saved"));
  });

  it("unlinks Telegram and disables that channel without false success", async () => {
    render(<NotificationPreferences fixture initial={model} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlink Telegram" }));
    await waitFor(() => expect(screen.getByText("Telegram is not linked")).toBeInTheDocument());
    expect(screen.getByLabelText("Telegram frequency")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("unlinked");
  });

  it("keeps provider-disabled and permission states honest", () => {
    const { rerender } = render(
      <NotificationPreferences
        fixture
        initial={{ ...model, telegramLinked: false, telegramProviderConfigured: false }}
        state="disabled"
      />,
    );
    expect(screen.getByText("Delivery providers are not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link Telegram" })).toBeDisabled();
    rerender(<NotificationPreferences fixture initial={model} state="permission" />);
    expect(screen.getByRole("alert")).toHaveTextContent("No delivery details were shown");
  });

  it("renders loading, empty, interrupted and stale states accessibly", () => {
    const { rerender } = render(<NotificationPreferences fixture initial={model} state="loading" />);
    expect(screen.getByRole("status", { name: "Loading alert preferences" })).toBeInTheDocument();
    rerender(
      <NotificationPreferences
        key="empty"
        fixture
        initial={{ ...model, recentDeliveries: [] }}
        state="empty"
      />,
    );
    expect(screen.getByText(/No alerts yet/)).toBeInTheDocument();
    rerender(<NotificationPreferences fixture initial={model} state="interrupted" />);
    expect(screen.getByText("Saving was interrupted")).toBeInTheDocument();
    rerender(<NotificationPreferences fixture initial={model} state="stale" />);
    expect(screen.getByRole("button", { name: "Save alert choices" })).toBeDisabled();
  });
});
