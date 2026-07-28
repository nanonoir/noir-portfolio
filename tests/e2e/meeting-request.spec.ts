import { expect, test } from "@playwright/test";

import { mockAvailability, mockJsonSuccess, selectAvailableSlot } from "./fixtures";

test.describe("@smoke @mocked-backend meeting request", () => {
  test("opens the modal, validates required fields, and submits a selected slot", async ({ page }) => {
    await mockAvailability(page);
    await mockJsonSuccess(page, "**/api/meeting", {
      code: "REQUEST_ACCEPTED",
      meetingId: "e2e-meeting",
      status: "requested",
      success: true,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Schedule a call" }).click();

    const modal = page.getByRole("dialog", { name: "Schedule a call" });
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Confirm request" }).click();
    await expect(modal.getByRole("alert").filter({ hasText: "Complete the required fields" }).first()).toContainText("Complete the required fields");

    await modal.getByLabel("Name").fill("Eve Visitor");
    await modal.getByLabel("Email").fill("visitor@example.com");
    await modal.getByLabel("WhatsApp / Phone").fill("5491112345678");
    await modal.getByLabel("Call reason").selectOption("project");
    await modal.getByRole("button", { name: "Choose date and time" }).click();

    const dateTimeModal = page.getByRole("dialog", { name: "Choose a date and time" });
    await selectAvailableSlot(dateTimeModal);
    await dateTimeModal.getByRole("button", { name: "Confirm time" }).click();

    await modal.getByRole("button", { name: "Confirm request" }).click();
    await expect(modal.getByRole("heading", { name: "Meeting request sent successfully" })).toBeVisible();
  });
});
