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
    await button.scrollIntoViewIfNeeded();

    const box = await button.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(60);

    const transform = await button.evaluate((element) => getComputedStyle(element).transform);
    await page.mouse.up();

    expect(transform).not.toBe("none");
  });

  test("keeps the shared action contract semantic and perceptible", async ({ page }) => {
    await openHomepage(page);

    const actionContract = await page.evaluate(() => {
      const button = document.createElement("button");
      button.className = "action-control button-feedback button-primary px-6 py-3";
      button.dataset.action = "button";
      button.textContent = "Primary action";

      const link = document.createElement("a");
      link.className = "action-control button-feedback button-outlined px-5 py-2.5";
      link.dataset.action = "link";
      link.href = "#contract";
      link.id = "foundation-outlined-contract";
      link.textContent = "Outlined action";

      const ghost = document.createElement("a");
      ghost.className = "action-control button-feedback button-ghost px-3 py-1.5";
      ghost.dataset.action = "link";
      ghost.href = "#ghost";
      ghost.id = "foundation-ghost-contract";
      ghost.textContent = "Ghost action";

      const disabled = document.createElement("button");
      disabled.disabled = true;
      disabled.textContent = "Disabled action";

      document.body.append(button, link, ghost, disabled);
      const result = {
        buttonCursor: getComputedStyle(button).cursor,
        buttonTag: button.tagName,
        disabledCursor: getComputedStyle(disabled).cursor,
        linkCursor: getComputedStyle(link).cursor,
        linkTag: link.tagName,
        outlineStart: getComputedStyle(link, "::before").transform,
        ghostStart: getComputedStyle(ghost, "::after").transform,
      };
      disabled.remove();
      return result;
    });

    expect(actionContract).toMatchObject({
      buttonCursor: "pointer",
      buttonTag: "BUTTON",
      disabledCursor: "not-allowed",
      linkCursor: "pointer",
      linkTag: "A",
    });
    expect(actionContract.outlineStart).toBe("matrix(0, 0, 0, 1, 0, 0)");
    expect(actionContract.ghostStart).toBe("matrix(0, 0, 0, 1, 0, 0)");

    const outlined = page.locator("#foundation-outlined-contract");
    const ghost = page.locator("#foundation-ghost-contract");
    await outlined.hover();
    await page.waitForTimeout(260);
    await expect(outlined).toHaveCSS("color", await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor));
    expect(await outlined.evaluate((element) => getComputedStyle(element, "::before").transform)).toBe("matrix(1, 0, 0, 1, 0, 0)");
    await ghost.hover();
    await page.waitForTimeout(260);
    expect(await ghost.evaluate((element) => getComputedStyle(element, "::after").transform)).toBe("matrix(1, 0, 0, 1, 0, 0)");
    await outlined.evaluate((element) => element.remove());
    await ghost.evaluate((element) => element.remove());

    const primary = page.locator("button.button-primary").filter({ visible: true }).first();
    await expect(primary).toBeEnabled();
    await primary.evaluate((element) => {
      element.dataset.foundationClickCount = "0";
      element.addEventListener("click", () => {
        element.dataset.foundationClickCount = String(Number(element.dataset.foundationClickCount) + 1);
      }, { once: true });
    });
    await primary.click();
    expect(await primary.evaluate((element) => element.dataset.foundationClickCount)).toBe("1");
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
  test("removes press movement without removing focus", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
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

  test("suppresses action sweeps while preserving focus", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openHomepage(page);

    const reducedMotionStyles = await page.evaluate(() => {
      const outlined = document.createElement("a");
      outlined.className = "action-control button-feedback button-outlined px-5 py-2.5";
      outlined.href = "#outlined";
      const ghost = document.createElement("a");
      ghost.className = "action-control button-feedback button-ghost px-3 py-1.5";
      ghost.href = "#ghost";
      document.body.append(outlined, ghost);
      outlined.focus();
      const result = {
        focusVisible: document.activeElement === outlined,
        ghostSweep: getComputedStyle(ghost, "::after").transform,
        outlinedSweep: getComputedStyle(outlined, "::before").transform,
      };
      outlined.remove();
      ghost.remove();
      return result;
    });

    expect(reducedMotionStyles.focusVisible).toBe(true);
    expect(reducedMotionStyles.outlinedSweep).toBe("matrix(0, 0, 0, 1, 0, 0)");
    expect(reducedMotionStyles.ghostSweep).toBe("matrix(0, 0, 0, 1, 0, 0)");
  });
});

test.describe("@wu2 @layout icon-label horizontal layout", () => {
  test("drawer nav items render icon and label side-by-side (horizontal)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHomepage(page);

    // Open the mobile drawer
    const menuButton = page.getByRole("button", { name: /menu|menú/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Wait for drawer to open
    await page.waitForTimeout(300);
    const drawerDialog = page.locator('[role="dialog"]');
    await expect(drawerDialog).toBeVisible();

    // Check all drawer nav items have horizontal (side-by-side) icon and label layout
    const drawerItems = page.locator('[data-drawer-item="true"]');
    const count = await drawerItems.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const item = drawerItems.nth(i);
      const icon = item.locator("[data-action-icon]");
      const label = item.locator("[data-action-label]");

      const iconBox = await icon.boundingBox();
      const labelBox = await label.boundingBox();

      expect(iconBox).not.toBeNull();
      expect(labelBox).not.toBeNull();

      // In a horizontal layout, the icon and label tops are within 20px of each other
      // (same row), and the icon is to the LEFT of the label
      const verticalDiff = Math.abs((iconBox!.y + iconBox!.height / 2) - (labelBox!.y + labelBox!.height / 2));
      expect(verticalDiff).toBeLessThan(20);
      expect(iconBox!.x).toBeLessThan(labelBox!.x);
    }
  });

  test("desktop Services nav item renders icon and label side-by-side", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomepage(page);

    // Find the Services nav link (outlined variant with an icon)
    const servicesLink = page.locator('[data-action-variant="outlined"]').filter({ hasText: /service|servicio/i }).first();
    await expect(servicesLink).toBeVisible();

    const icon = servicesLink.locator("[data-action-icon]");
    const label = servicesLink.locator("[data-action-label]");

    await expect(icon).toBeVisible();
    await expect(label).toBeVisible();

    const iconBox = await icon.boundingBox();
    const labelBox = await label.boundingBox();

    expect(iconBox).not.toBeNull();
    expect(labelBox).not.toBeNull();

    // Icon and label must be horizontally aligned (same row)
    const verticalDiff = Math.abs((iconBox!.y + iconBox!.height / 2) - (labelBox!.y + labelBox!.height / 2));
    expect(verticalDiff).toBeLessThan(10);
  });

  test("hero CTAs render label before icon (icon at END)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomepage(page);

    // All hero CTA links should have the label to the LEFT of the icon (icon at END position)
    const heroCtas = page.locator("main section").first().locator("[data-action]");
    const count = await heroCtas.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const cta = heroCtas.nth(i);
      const icon = cta.locator("[data-action-icon]");
      const label = cta.locator("[data-action-label]");

      const hasIcon = await icon.count();
      if (hasIcon === 0) continue;

      const iconBox = await icon.boundingBox();
      const labelBox = await label.boundingBox();

      if (!iconBox || !labelBox) continue;

      // Label must be to the LEFT of the icon (label first, icon at END)
      expect(labelBox.x).toBeLessThan(iconBox.x);
    }
  });

  test("contact form submit button (Enviar) renders with explicit icon slot, label and icon horizontally aligned", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomepage(page);

    // Scroll to contact section
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const submitButton = page.locator("#contact button[type='submit']");
    await expect(submitButton).toBeVisible();

    const icon = submitButton.locator("[data-action-icon]");
    const label = submitButton.locator("[data-action-label]");

    await expect(icon).toBeVisible();
    await expect(label).toBeVisible();

    const iconBox = await icon.boundingBox();
    const labelBox = await label.boundingBox();

    expect(iconBox).not.toBeNull();
    expect(labelBox).not.toBeNull();

    // Icon and label are horizontally aligned (same row, label before icon at END)
    const verticalDiff = Math.abs((iconBox!.y + iconBox!.height / 2) - (labelBox!.y + labelBox!.height / 2));
    expect(verticalDiff).toBeLessThan(10);
    expect(labelBox!.x).toBeLessThan(iconBox!.x);
  });

  test("outlined button icon remains visible on hover (not hidden by fill)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomepage(page);

    // Inject an outlined action link with a real [data-action-icon] img into the live page,
    // then hover it with the mouse so the @media (hover: hover) rule applies.
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.id = "wu2-outlined-hover-icon-test";
      link.className = "action-control button-feedback button-outlined px-5 py-2.5";
      link.dataset.action = "link";
      link.href = "#test-icon-visibility";
      link.style.cssText = "position:fixed;top:10px;left:10px;z-index:9999;";

      const iconSpan = document.createElement("span");
      iconSpan.dataset.actionIcon = "true";
      iconSpan.style.display = "inline-flex";

      const img = document.createElement("img");
      img.id = "wu2-outlined-hover-icon-img";
      img.alt = "";
      img.src = "/handwritten-icons/card.svg";
      img.className = "size-4";
      iconSpan.appendChild(img);

      const labelSpan = document.createElement("span");
      labelSpan.dataset.actionLabel = "true";
      labelSpan.textContent = "Test";
      link.append(iconSpan, labelSpan);
      document.body.appendChild(link);
    });

    const testLink = page.locator("#wu2-outlined-hover-icon-test");
    const testImg = page.locator("#wu2-outlined-hover-icon-img");
    await expect(testLink).toBeVisible();

    // Baseline filter before hover
    const filterBefore = await testImg.evaluate((el) => getComputedStyle(el).filter);

    // Hover the link — triggers the @media (hover: hover) rule
    await testLink.hover();
    await page.waitForTimeout(300);

    const filterAfter = await testImg.evaluate((el) => getComputedStyle(el).filter);

    // Clean up
    await page.evaluate(() => document.getElementById("wu2-outlined-hover-icon-test")?.remove());

    // After hover the filter must be invert(1) (the icon flips to stay visible on foreground fill)
    // Before hover it should be none (no filter applied)
    expect(filterBefore).toBe("none");
    expect(filterAfter).toBe("invert(1)");
  });
});
