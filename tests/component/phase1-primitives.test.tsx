import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { WayfoundLogo } from "@/components/wayfound-logo";
import { Button, Dialog, FormField, Input } from "@/components/ui";

afterEach(() => cleanup());

describe("Phase 1 visual primitives", () => {
  it("renders horizontal and mark-only logo variants", () => {
    const { rerender } = render(<WayfoundLogo variant="light" />);
    expect(screen.getByRole("img", { name: "WAYFOUND" })).toBeInTheDocument();
    rerender(<WayfoundLogo markOnly variant="dark" />);
    expect(screen.getByRole("img", { name: "WAYFOUND logo mark" })).toBeInTheDocument();
  });

  it("associates reusable form fields with their control", () => {
    render(
      <FormField hint="Use the name on your documents." label="Full name">
        <Input placeholder="Amara" />
      </FormField>,
    );
    expect(screen.getByLabelText("Full name")).toHaveAttribute("placeholder", "Amara");
    expect(screen.getByLabelText("Full name")).toHaveAttribute("aria-describedby");
  });

  it("closes a dialog with Escape", async () => {
    function DialogExample() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open dialog</Button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Demo dialog">
            <p>Phase 1 primitive</p>
          </Dialog>
        </>
      );
    }
    const user = userEvent.setup();
    render(<DialogExample />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog", { name: "Demo dialog" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Demo dialog" })).not.toBeInTheDocument();
  });
});
