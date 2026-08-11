import { describe, expect, it } from "vitest";

import { isAllowedNameInsertion } from "@/features/service-request/components/service-form-fields";

describe("service form name input", () => {
  it("accepts Spanish accented and decomposed Unicode names", () => {
    expect(isAllowedNameInsertion("Álvaro Muñoz")).toBe(true);
    expect(isAllowedNameInsertion("Jose\u0301 Nin\u0303o")).toBe(true);
  });

  it("rejects non-name control characters", () => {
    expect(isAllowedNameInsertion("Ana123")).toBe(false);
    expect(isAllowedNameInsertion("<Ana>")).toBe(false);
  });
});
