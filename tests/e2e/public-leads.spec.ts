import { expect, test } from "@playwright/test";

import { mockJsonSuccess } from "./fixtures";

test.describe("@smoke @mocked-backend public lead forms", () => {
  test("submits the contact form and preserves the generic WhatsApp link", async ({ page }) => {
    await mockJsonSuccess(page, "**/api/leads", { success: true });
    await page.goto("/en");

    const contact = page.locator("#contact form");
    await contact.getByLabel("Email").fill("contact@example.com");
    await contact.getByLabel("Message").fill("I need help with a software project.");
    await contact.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByRole("status")).toContainText("I received your message. I will get back to you soon.");
    await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /text=Hola/);
  });

  test("submits a service request and exposes an enriched WhatsApp link", async ({ page }) => {
    await mockJsonSuccess(page, "**/api/leads", { success: true });
    await page.goto("/en");
    await page.getByRole("button", { name: "Request" }).nth(1).click();

    const modal = page.getByRole("dialog", { name: "Landing / Business Website" });
    await modal.getByLabel("Name").fill("Test Service");
    await modal.getByLabel("Email").fill("service@example.com");
    await modal.getByLabel("WhatsApp / Phone").fill("5491112345678");
    await expect(modal.getByLabel("Name")).toHaveValue("Test Service");
    await expect(modal.getByLabel("WhatsApp / Phone")).toHaveValue("5491112345678");
    await modal.getByRole("radio", { name: "Brand / company" }).check();
    await modal.getByLabel("Brand / company name").fill("Noir Labs");
    await modal.getByRole("button", { name: "Send request" }).click();

    await expect(modal.getByRole("heading", { name: "Request sent" })).toBeVisible();
    const whatsapp = modal.getByRole("link", { name: "Continue on WhatsApp" });
    await expect(whatsapp).toHaveAttribute("href", /Test%20Service/);
    await expect(whatsapp).toHaveAttribute("href", /Landing%20%2F%20Business%20Website/);
  });
});

test.describe("@smoke @mocked-backend public lead forms on mobile", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("submits contact and service requests from their mobile form flows", async ({ page }) => {
    await mockJsonSuccess(page, "**/api/leads", { success: true });
    await page.goto("/en");

    const contact = page.locator("#contact form");
    await contact.getByLabel("Email").fill("contact@example.com");
    await contact.getByLabel("Message").fill("I need help with a software project.");
    await contact.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("I received your message. I will get back to you soon.");

    await page.getByRole("button", { name: "Request" }).nth(1).click();
    const modal = page.getByRole("dialog", { name: "Landing / Business Website" });
    await expect(modal.getByRole("heading", { name: "Landing / Business Website" })).toBeFocused();
    await modal.getByLabel("Name").fill("Test Service");
    await modal.getByLabel("Email").fill("service@example.com");
    await modal.getByLabel("WhatsApp / Phone").fill("5491112345678");
    await modal.getByRole("radio", { name: "Brand / company" }).check();
    await modal.getByLabel("Brand / company name").fill("Noir Labs");
    await modal.getByRole("button", { name: "Send request" }).click();
    await expect(modal.getByRole("heading", { name: "Request sent" })).toBeVisible();
  });
});
