import { describe, expect, it } from "vitest";
import { resolveModelAssetKey } from "../../src/stage/model-asset-key.js";
import { inlineCpuModelSource } from "../fixtures/cpu-model-fixture.js";

describe("resolveModelAssetKey", () => {
    it("uses modelSourceUrl for string sources", () => {
        expect(resolveModelAssetKey("/models/a.model3.json")).toBe(
            "/models/a.model3.json",
        );
    });

    it("uses npm specifier for npm sources", () => {
        expect(
            resolveModelAssetKey({
                kind: "npm",
                package: "live2d-widget-model-hijiki@1.0.5",
                path: "assets/hijiki.model.json",
            }),
        ).toBe("npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json");
    });

    it("stabilizes inline json keys", () => {
        const a = resolveModelAssetKey(inlineCpuModelSource());
        const b = resolveModelAssetKey(inlineCpuModelSource());
        expect(a).toBe(b);
        expect(a.startsWith("json:")).toBe(true);
    });

    it("differs when inline json changes", () => {
        const a = resolveModelAssetKey(inlineCpuModelSource());
        const b = resolveModelAssetKey(
            inlineCpuModelSource({
                Version: 4,
                FileReferences: {
                    Moc: "quad.program.json",
                    Textures: [],
                    Motions: {},
                },
            }),
        );
        expect(a).not.toBe(b);
    });
});
