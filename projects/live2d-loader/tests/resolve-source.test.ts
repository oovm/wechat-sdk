import { describe, expect, it } from "vitest";
import {
    resolveModelSourceUrl,
    resolveNpmSpecifier,
} from "../src/resolve/index.js";

describe("resolveNpmSpecifier", () => {
    it("resolves unscoped package with version and path", () => {
        expect(
            resolveNpmSpecifier(
                "live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
            ),
        ).toBe(
            "https://cdn.jsdelivr.net/npm/live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
        );
    });

    it("resolves unscoped package without version", () => {
        expect(
            resolveNpmSpecifier(
                "live2d-widget-model-tororo/assets/tororo.model.json",
            ),
        ).toBe(
            "https://cdn.jsdelivr.net/npm/live2d-widget-model-tororo/assets/tororo.model.json",
        );
    });

    it("resolves scoped package", () => {
        expect(
            resolveNpmSpecifier("@doki-land/demo-model@0.1.0/dist/model3.json"),
        ).toBe(
            "https://cdn.jsdelivr.net/npm/@doki-land/demo-model@0.1.0/dist/model3.json",
        );
    });

    it("requires an asset path", () => {
        expect(() => resolveNpmSpecifier("live2d-widget-model-hijiki")).toThrow(
            /asset path/,
        );
    });
});

describe("resolveModelSourceUrl", () => {
    it("maps npm: strings to CDN URLs", () => {
        expect(
            resolveModelSourceUrl(
                "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
            ),
        ).toContain("cdn.jsdelivr.net/npm/live2d-widget-model-hijiki@1.0.5/");
    });

    it("passes through https URLs", () => {
        const url =
            "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@b1de66b/Samples/Resources/Wanko/Wanko.model3.json";
        expect(resolveModelSourceUrl(url)).toBe(url);
    });
});
