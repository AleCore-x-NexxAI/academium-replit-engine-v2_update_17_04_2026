import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveFrameworkName } from "../agents/frameworkRegistry";

describe("frameworkRegistry resolver — Porter disambiguation regression", () => {
  it("Porter Five Forces resolves to porter_five_forces, not porter_generic_strategies", () => {
    const resolved = resolveFrameworkName("Porter Five Forces", "en");
    assert.ok(resolved, "Expected a resolved framework, got null");
    assert.strictEqual(resolved.canonicalId, "porter_five_forces");
  });

  it("Cinco Fuerzas de Porter resolves to porter_five_forces", () => {
    const resolved = resolveFrameworkName("Cinco Fuerzas de Porter", "es");
    assert.ok(resolved, "Expected a resolved framework, got null");
    assert.strictEqual(resolved.canonicalId, "porter_five_forces");
  });

  it("Porter's Generic Strategies resolves to porter_generic_strategies", () => {
    const resolved = resolveFrameworkName("Porter's Generic Strategies", "en");
    assert.ok(resolved, "Expected a resolved framework, got null");
    assert.strictEqual(resolved.canonicalId, "porter_generic_strategies");
  });

  it("bare 'Porter' returns null (ambiguous)", () => {
    const resolved = resolveFrameworkName("Porter", "en");
    assert.strictEqual(resolved, null, "Bare 'Porter' should be ambiguous (null)");
  });

  it("'5 Fuerzas' resolves to porter_five_forces", () => {
    const resolved = resolveFrameworkName("5 Fuerzas", "es");
    assert.ok(resolved, "Expected a resolved framework, got null");
    assert.strictEqual(resolved.canonicalId, "porter_five_forces");
  });
});
