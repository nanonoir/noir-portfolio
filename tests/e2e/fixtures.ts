import type { Locator, Page } from "@playwright/test";

/** UI smoke helpers intentionally intercept browser API traffic. */
export function nextWeekdayDate() {
  const date = new Date();

  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() === 0);

  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10);
}

export function getDateButtonLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  });
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
  await page.getByRole("button", { name: getDateButtonLabel(date) }).click();
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
