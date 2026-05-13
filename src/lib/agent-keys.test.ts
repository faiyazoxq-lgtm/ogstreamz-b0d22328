import { describe, it, expect } from "vitest";
import { resolveAgentKeyPresets, type AgentKeyPreset } from "./agent-keys.functions";

const customPreset: AgentKeyPreset = {
  id: "custom",
  label: "Custom",
  suggestions: ["FOO_API_KEY", "BAR_API_KEY"],
};

describe("resolveAgentKeyPresets", () => {
  it("uses compiled defaults when no DB row and no env override", () => {
    const { presets, placeholder } = resolveAgentKeyPresets({});
    expect(presets.length).toBeGreaterThan(0);
    // Default placeholder = first suggestion of first non-empty group.
    expect(placeholder).toMatch(/^[A-Z0-9_]+$/);
    expect(placeholder.length).toBeGreaterThan(0);
  });

  it("parses a valid JSON env override into presets", () => {
    const { presets } = resolveAgentKeyPresets({
      env: { AGENT_KEY_PRESETS_JSON: JSON.stringify([customPreset]) },
    });
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe("custom");
    expect(presets[0].suggestions).toEqual(["FOO_API_KEY", "BAR_API_KEY"]);
  });

  it("falls back to defaults on malformed JSON in env override", () => {
    const defaults = resolveAgentKeyPresets({});
    const { presets } = resolveAgentKeyPresets({
      env: { AGENT_KEY_PRESETS_JSON: "{not valid json" },
    });
    expect(presets).toEqual(defaults.presets);
  });

  it("ignores env override when JSON is valid but not an array", () => {
    const defaults = resolveAgentKeyPresets({});
    const { presets } = resolveAgentKeyPresets({
      env: { AGENT_KEY_PRESETS_JSON: JSON.stringify({ id: "x" }) },
    });
    expect(presets).toEqual(defaults.presets);
  });

  it("ignores empty-string env override", () => {
    const defaults = resolveAgentKeyPresets({});
    const { presets } = resolveAgentKeyPresets({
      env: { AGENT_KEY_PRESETS_JSON: "" },
    });
    expect(presets).toEqual(defaults.presets);
  });

  it("does not throw on a JSON bomb-style malformed payload", () => {
    expect(() =>
      resolveAgentKeyPresets({
        env: { AGENT_KEY_PRESETS_JSON: "[[[[[[[[" },
      })
    ).not.toThrow();
  });

  it("DB row presets win over env override", () => {
    const { presets } = resolveAgentKeyPresets({
      dbRow: { presets: [customPreset], placeholder: "DB_KEY" },
      env: {
        AGENT_KEY_PRESETS_JSON: JSON.stringify([
          { id: "from-env", label: "Env", suggestions: ["ENV_KEY"] },
        ]),
      },
    });
    expect(presets[0].id).toBe("custom");
  });

  it("uses DB placeholder when set", () => {
    const { placeholder } = resolveAgentKeyPresets({
      dbRow: { presets: [customPreset], placeholder: "DB_KEY" },
    });
    expect(placeholder).toBe("DB_KEY");
  });

  it("ignores empty DB presets array (treated as unset)", () => {
    const defaults = resolveAgentKeyPresets({});
    const { presets } = resolveAgentKeyPresets({
      dbRow: { presets: [], placeholder: "" },
    });
    expect(presets).toEqual(defaults.presets);
  });

  it("uses env placeholder when DB placeholder is empty", () => {
    const { placeholder } = resolveAgentKeyPresets({
      env: { AGENT_KEY_NAME_PLACEHOLDER: "ENV_PLACEHOLDER_KEY" },
    });
    expect(placeholder).toBe("ENV_PLACEHOLDER_KEY");
  });

  it("never returns an empty placeholder", () => {
    const { placeholder } = resolveAgentKeyPresets({
      dbRow: { presets: [{ id: "x", label: "X", suggestions: [] }], placeholder: "" },
    });
    expect(placeholder.length).toBeGreaterThan(0);
  });
});