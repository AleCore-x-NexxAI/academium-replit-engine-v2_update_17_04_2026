import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveFrameworkName } from "../agents/frameworkRegistry";
import { customCanonicalId } from "../agents/frameworkBootMigration";
import { pedagogicalIntentSchema } from "@shared/schema";

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

describe("pedagogicalIntent — professorNotes + custom framework round-trip", () => {
  it("accepts professorNotes alongside curated targetFrameworks", () => {
    const parsed = pedagogicalIntentSchema.safeParse({
      teachingGoal: "Apply Porter's Five Forces to evaluate market entry.",
      targetFrameworks: [{ canonicalId: "porter_five_forces", name: "Porter Five Forces" }],
      targetCompetencies: ["C1", "C2"],
      professorNotes: "Emphasize bargaining power of suppliers.",
    });
    assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.errors));
    if (parsed.success) {
      assert.strictEqual(parsed.data.professorNotes, "Emphasize bargaining power of suppliers.");
    }
  });

  it("custom_<sha1> id matches the customCanonicalId hash of the supplied name", () => {
    const name = "Mi Marco Personalizado";
    const id = customCanonicalId(name);
    assert.match(id, /^custom_[0-9a-f]{10}$/);
    // Recomputing yields the same id (NFD-normalized, lowercased, trimmed).
    assert.strictEqual(customCanonicalId("  mi marco personalizado  "), id);
  });

  it("schema accepts a custom framework entry whose id matches its name hash", () => {
    const name = "Custom Framework";
    const id = customCanonicalId(name);
    const parsed = pedagogicalIntentSchema.safeParse({
      teachingGoal: "Test",
      targetFrameworks: [{ canonicalId: id, name }],
      targetCompetencies: [],
      professorNotes: "",
    });
    assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.errors));
  });
});
