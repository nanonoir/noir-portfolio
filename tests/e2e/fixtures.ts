import type { Locator, Page } from "@playwright/test";

/**
 * UI smoke helpers: these intentionally intercept browser API traffic.
 * Real route/Firestore helpers live in `tests/helpers/backend-test-composition.ts`
 * and must never use `page.route` for internal API endpoints.
 */
export function nextWeekdayDate() {
  const date = new Date();

  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() === 0);

  return date.toISOString().slice(0, 10);
}

export async function mockAvailability(page: Page) {
  await page.route("**/api/availability?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        slots: [{
          availabilityStatus: "available",
          available: true,
          endISO: "2030-01-01T11:00:00.000Z",
          startISO: "2030-01-01T10:00:00.000Z",
          time: "10:00",
        }],
        success: true,
      }),
    });
  });
}

export async function selectAvailableSlot(page: Page | Locator) {
  const date = nextWeekdayDate();
  await page.getByRole("button", { name: date }).click();
  await page.getByRole("button", { name: "10:00" }).click();
  return date;
}

export async function mockJsonSuccess(page: Page, url: string, response: Record<string, unknown>) {
  await page.route(url, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}
