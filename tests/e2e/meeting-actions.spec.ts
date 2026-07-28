import { expect, test } from "@playwright/test";

import { mockAvailability, mockJsonSuccess, selectAvailableSlot } from "./fixtures";

test.describe("@smoke @mocked-backend private meeting actions", () => {
  test("uses a fragment token in the isolated confirm shell and renders a completed result", async ({ page }) => {
    await mockJsonSuccess(page, "**/api/meetings/e2e-confirm/confirm", {
      calendarDeliveryStatus: "completed",
      emailDeliveryStatus: "completed",
      success: true,
    });

    await page.goto("/meetings/e2e-confirm/confirm#t=fragment-only-token");

    await expect(page).toHaveURL(/#t=fragment-only-token$/);
    expect(new URL(page.url()).search).toBe("");
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirm meeting");

    await page.getByRole("button", { name: "Confirm meeting" }).click();
    await expect(page.getByRole("status")).toContainText("The action was completed successfully.");
  });

  test("renders completed and pending delivery results for proposal submission", async ({ page }) => {
    await mockAvailability(page);
    await mockJsonSuccess(page, "**/api/meetings/e2e-proposal/propose", {
      emailDeliveryStatus: "completed",
      success: true,
    });

    await page.goto("/meetings/e2e-proposal/propose#t=proposal-token");
    await selectAvailableSlot(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("status")).toContainText("The new proposal was sent successfully.");

    await mockAvailability(page);
    await mockJsonSuccess(page, "**/api/meetings/e2e-pending/propose", {
      emailDeliveryStatus: "pending",
      success: true,
    });
    await page.goto("/meetings/e2e-pending/propose#t=pending-token");
    await selectAvailableSlot(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("status")).toContainText("Delivery unconfirmed");
  });

  test("renders failed delivery and decline result outcomes", async ({ page }) => {
    await mockAvailability(page);
    await mockJsonSuccess(page, "**/api/meetings/e2e-failed/propose", {
      emailDeliveryStatus: "failed",
      success: true,
    });
    await page.goto("/meetings/e2e-failed/propose#t=failed-token");
    await selectAvailableSlot(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("status")).toContainText("Delivery unconfirmed");

    await mockJsonSuccess(page, "**/api/meetings/e2e-decline/decline", { success: true });
    await page.goto("/meetings/e2e-decline/decline#t=decline-token");
    await page.getByLabel("Decline reason").fill("No longer needed");
    await page.getByRole("button", { name: "Decline meeting" }).click();
    await expect(page.getByRole("status")).toContainText("The action was completed successfully.");
  });

  test("renders the visitor accept-proposal result", async ({ page }) => {
    await mockJsonSuccess(page, "**/api/meetings/e2e-accept/accept-proposal", { success: true });
    await page.goto("/meetings/e2e-accept/accept-proposal#t=visitor-token");
    await page.getByRole("button", { name: "Accept proposed time" }).click();
    await expect(page.getByRole("status")).toContainText("The action was completed successfully.");
  });
});
