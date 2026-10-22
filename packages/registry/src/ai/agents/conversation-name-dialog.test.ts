/** @vitest-environment jsdom */

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationNameDialog } from "./conversation-name-dialog";

const labels = {
  description: "Enter a name",
  nameLabel: "Name",
  cancel: "Cancel",
  submit: "Save",
  submitting: "Saving",
};

describe("ConversationNameDialog", () => {
  afterEach(cleanup);

  it("submits a trimmed name and closes after a successful save", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(
      React.createElement(ConversationNameDialog, {
        open: true,
        title: "Rename group",
        initialValue: "Old name",
        maxLength: 60,
        labels,
        onOpenChange,
        onSubmit,
      }),
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  New name  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("New name"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the form open when save fails", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(
      React.createElement(ConversationNameDialog, {
        open: true,
        title: "Rename conversation",
        maxLength: 255,
        labels,
        onOpenChange,
        onSubmit,
      }),
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("New title"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
