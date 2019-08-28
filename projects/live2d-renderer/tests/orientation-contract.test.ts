/**
 * Coordinate contract (do not break casually):
 * - Model/NDC space is Y-up (higher Y = toward head).
 * - Canvas2D pixels are Y-down; convert geometry **once** via
 *   `canvasY = (1 - modelY) * (height/2)` (or equivalent `scale(sy, -sy)`).
 * - Texture UVs are sampled as authored (same as WebGL without UNPACK_FLIP_Y).
 *   Do NOT also flip V with `1 - v` -- that double-flips some MOC textures.
 * - Do NOT CSS `scaleY(-1)` the canvas; that inverts hit-testing and tracking.
 */
import { describe, expect, it } from "vitest";
import { modelYUpToCanvasPixelY } from "../src/coords.js";
import { decodeMoc2, decodeMoc3 } from "../src/moc/decode.js";
import {
    HIJIKI_MOC2_CANDIDATES,
    tryReadFixture,
    WANKO_MOC3_CANDIDATES,
} from "./fixtures.js";

describe("model/canvas Y contract", () => {
    it("maps NDC top (+1) to canvas top (0) and bottom (-1) to canvas bottom", () => {
        const h = 200;
        expect(modelYUpToCanvasPixelY(1, h)).toBe(0);
        expect(modelYUpToCanvasPixelY(0, h)).toBe(100);
        expect(modelYUpToCanvasPixelY(-1, h)).toBe(200);
    });
});

const wankoBytes = tryReadFixture(...WANKO_MOC3_CANDIDATES);
const hijikiBytes = tryReadFixture(...HIJIKI_MOC2_CANDIDATES);

describe.skipIf(!wankoBytes)("Wanko moc3 model-space Y-up", () => {
    it("spans a vertical range and maps maxY above minY on canvas", async () => {
        const { program } = await decodeMoc3(wankoBytes!.slice(0));
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const d of program.drawables) {
            for (let i = 1; i < d.positions.length; i += 2) {
                minY = Math.min(minY, d.positions[i]!);
                maxY = Math.max(maxY, d.positions[i]!);
            }
        }
        expect(maxY).toBeGreaterThan(minY);
        expect(maxY).toBeGreaterThan(0);
        expect(minY).toBeLessThan(0);
        // Shared contract: larger model Y → nearer the top of the canvas.
        const h = 200;
        expect(modelYUpToCanvasPixelY(maxY, h)).toBeLessThan(
            modelYUpToCanvasPixelY(minY, h),
        );
    });
});

describe.skipIf(!hijikiBytes)("Hijiki moc2 model-space Y-up", () => {
    it("normalizes so model maxY maps above minY on canvas", async () => {
        const { program } = await decodeMoc2(hijikiBytes!.slice(0));
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const d of program.drawables) {
            for (let i = 1; i < d.positions.length; i += 2) {
                minY = Math.min(minY, d.positions[i]!);
                maxY = Math.max(maxY, d.positions[i]!);
            }
        }
        expect(maxY).toBeGreaterThan(minY);
        const h = 200;
        expect(modelYUpToCanvasPixelY(maxY, h)).toBeLessThan(
            modelYUpToCanvasPixelY(minY, h),
        );
    });
});
