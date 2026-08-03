import { expect, test, type Page } from "@playwright/test";

function captureApplicationErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  return errors;
}

async function openHomepage(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
}

test.describe("@wu1 @foundation frontend foundation", () => {
  test("renders at desktop and mobile without overflow or application errors", async ({ page }) => {
    const errors = captureApplicationErrors(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomepage(page);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 1440);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();

    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );

    expect(mobileOverflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test("loads Newsreader through the editorial utility", async ({ page }) => {
    await openHomepage(page);

    const font = await page.evaluate(async () => {
      await document.fonts.ready;

      const element = document.createElement("span");
      element.className = "editorial";
      element.textContent = "Editorial";
      document.body.appendChild(element);

      const rootVariable = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-newsreader")
        .trim();
      const family = getComputedStyle(element).fontFamily;
      element.remove();

      return { family, rootVariable };
    });

    expect(font.rootVariable).not.toBe("");
    expect(font.family.toLowerCase()).toContain("newsreader");
  });

  test("preserves theme parity through the real theme control", async ({ page }) => {
    await openHomepage(page);

    const themeToggle = page.getByRole("button", { name: /theme|tema/i }).first();
    await expect(themeToggle).toBeVisible();

    const before = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
    const hadDarkTheme = await page.locator("html").evaluate((element) => element.classList.contains("dark"));

    await themeToggle.click();
    await expect(page.locator("html")).toHaveClass(hadDarkTheme ? /^(?!.*\bdark\b).*$/ : /\bdark\b/);

    const after = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(after).not.toBe(before);
  });

  test("keeps section headings within mobile and enlarged-text layouts", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHomepage(page);

    const headings = page.locator(".section-heading-rhythm");
    await expect(headings.first()).toBeVisible();

    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    const overflowingHeadings = await headings.evaluateAll((elements) =>
      elements.flatMap((element) => {
        const bounds = element.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        return bounds.left < 0 || bounds.right > viewportWidth
          ? [{ left: bounds.left, right: bounds.right, viewportWidth }]
          : [];
      }),
    );

    expect(overflowingHeadings).toEqual([]);
  });

  test("provides tactile button feedback for normal motion", async ({ page }) => {
    await openHomepage(page);

    const button = page.locator("button.button-feedback").filter({ visible: true }).first();
    await expect(button).toBeVisible();
    await button.focus();
    await expect(button).toBeFocused();

    const box = await button.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(60);

    const transform = await button.evaluate((element) => getComputedStyle(element).transform);
    await page.mouse.up();

    expect(transform).not.toBe("none");
  });

  test("exposes accessible status-token contrast in both themes", async ({ page }) => {
    await openHomepage(page);

    const ratios = await page.evaluate(() => {
      const toRgb = (color: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas 2D context is unavailable.");
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
      };
      const luminance = ([red, green, blue]: number[]) => {
        const [r, g, b] = [red, green, blue].map((value) => {
          const channel = value / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const contrast = (foreground: string, background: string) => {
        const first = luminance(toRgb(foreground));
        const second = luminance(toRgb(background));
        return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      };
      const measure = (dark: boolean) => {
        const wrapper = document.createElement("div");
        if (dark) wrapper.className = "dark";
        document.body.appendChild(wrapper);

        const result = Object.fromEntries(
          ["success", "warning", "danger"].map((status) => {
            const element = document.createElement("div");
            element.style.color = `var(--${status})`;
            element.style.backgroundColor = `var(--${status}-surface)`;
            wrapper.appendChild(element);
            const styles = getComputedStyle(element);
            return [status, contrast(styles.color, styles.backgroundColor)];
          }),
        );

        wrapper.remove();
        return result;
      };

      return { dark: measure(true), light: measure(false) };
    });

    for (const theme of Object.values(ratios)) {
      for (const ratio of Object.values(theme)) {
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

test.describe("@wu1 @foundation reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("removes press movement without removing focus", async ({ page }) => {
    await openHomepage(page);

    const button = page.locator("button.button-feedback").filter({ visible: true }).first();
    await expect(button).toBeVisible();
    await button.focus();
    await expect(button).toBeFocused();

    const box = await button.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();

    const transform = await button.evaluate((element) => getComputedStyle(element).transform);
    await page.mouse.up();

    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  });
});
