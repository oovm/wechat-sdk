import { describe, expect, it } from "vitest";
import {
    buildClippingContexts,
    type ClippingContext,
    FULL_NDC_BOUNDS,
    fitClippingContexts,
    layoutMaskAtlas,
    layoutMaskAtlasRgba,
    layoutMaskAtlasUvGrid,
    partitionForClipping,
} from "./clipping.js";

function fakeContexts(n: number): ClippingContext[] {
    return Array.from({ length: n }, (_, i) => ({
        key: `n:${i}`,
        maskIndices: [i],
        clippedIndices: [100 + i],
        invertedMask: false,
    }));
}

describe("layoutMaskAtlasUvGrid", () => {
    it("gives a near-full rect for a single context", () => {
        const [laid] = layoutMaskAtlasUvGrid(fakeContexts(1));
        expect(laid?.layout.width).toBeGreaterThan(0.9);
        expect(laid?.layout.height).toBeGreaterThan(0.9);
        expect(laid?.channelIndex).toBe(3);
    });

    it("packs four contexts into a 2x2 grid", () => {
        const laid = layoutMaskAtlasUvGrid(fakeContexts(4));
        expect(laid).toHaveLength(4);
        for (const c of laid) {
            expect(c.layout.width).toBeCloseTo(0.5 * 0.98, 3);
            expect(c.layout.height).toBeCloseTo(0.5 * 0.98, 3);
            expect(c.channelIndex).toBe(3);
        }
        const xs = new Set(laid.map((c) => Math.round(c.layout.x * 100)));
        const ys = new Set(laid.map((c) => Math.round(c.layout.y * 100)));
        expect(xs.size).toBe(2);
        expect(ys.size).toBe(2);
    });

    it("packs nine contexts into a 3x3 grid without overlap of centers", () => {
        const laid = layoutMaskAtlasUvGrid(fakeContexts(9));
        expect(laid).toHaveLength(9);
        const centers = laid.map((c) => [
            c.layout.x + c.layout.width * 0.5,
            c.layout.y + c.layout.height * 0.5,
        ]);
        const unique = new Set(
            centers.map(([x, y]) => `${x?.toFixed(3)},${y?.toFixed(3)}`),
        );
        expect(unique.size).toBe(9);
    });
});

describe("layoutMaskAtlasRgba (Cubism)", () => {
    it("assigns ≤4 contexts to distinct RGBA channels with full UV", () => {
        const laid = layoutMaskAtlasRgba(fakeContexts(4));
        expect(laid).toHaveLength(4);
        const channels = laid.map((c) => c.channelIndex).sort();
        expect(channels).toEqual([0, 1, 2, 3]);
        for (const c of laid) {
            expect(c.layout.width).toBe(1);
            expect(c.layout.height).toBe(1);
        }
    });

    it("for 6 contexts uses 2,2,1,1 per channel", () => {
        const laid = layoutMaskAtlasRgba(fakeContexts(6));
        expect(laid).toHaveLength(6);
        const byCh = [0, 0, 0, 0];
        for (const c of laid) byCh[c.channelIndex]!++;
        expect(byCh).toEqual([2, 2, 1, 1]);
        const half = laid.filter((c) => c.layout.width === 0.5);
        expect(half.length).toBe(4);
    });

    it("default layoutMaskAtlas uses rgba mode", () => {
        const laid = layoutMaskAtlas(fakeContexts(3));
        expect(new Set(laid.map((c) => c.channelIndex)).size).toBe(3);
    });
});

describe("partitionForClipping + atlas", () => {
    it("attaches layout to every context", () => {
        const drawables = [
            { index: 0, maskIndices: [] as number[], invertedMask: false },
            { index: 1, maskIndices: [2], invertedMask: false },
            { index: 2, maskIndices: [] as number[], invertedMask: false },
            { index: 3, maskIndices: [2], invertedMask: true },
        ];
        const part = partitionForClipping(drawables);
        expect(part.contexts).toHaveLength(2);
        for (const c of part.contexts) {
            expect(c.layout.width).toBeGreaterThan(0);
            expect(c.layout.height).toBeGreaterThan(0);
            expect(c.channelFlag.reduce((a, b) => a + b, 0)).toBe(1);
            expect(c.modelBounds).toEqual(FULL_NDC_BOUNDS);
        }
        expect(buildClippingContexts(drawables)).toHaveLength(2);
    });

    it("uv-grid mode keeps alpha-only channels", () => {
        const part = partitionForClipping(
            [
                { index: 1, maskIndices: [0], invertedMask: false },
                { index: 2, maskIndices: [0], invertedMask: true },
            ],
            { mode: "uv-grid" },
        );
        expect(part.contexts.every((c) => c.channelIndex === 3)).toBe(true);
    });
});

describe("fitClippingContexts (bounds-fit)", () => {
    it("expands clipped drawable AABB by 5% into modelBounds", () => {
        const drawables = [
            {
                index: 0,
                vertexPositions: new Float32Array([
                    -0.5, -0.5, 0.5, -0.5, 0, 0.5,
                ]),
            },
            {
                index: 1,
                vertexPositions: new Float32Array([0, 0, 0.2, 0, 0.1, 0.2]),
            },
        ];
        const byIndex = new Map(drawables.map((d) => [d.index, d]));
        const part = partitionForClipping([
            { index: 1, maskIndices: [0], invertedMask: false },
        ]);
        const fitted = fitClippingContexts(part.contexts, byIndex);
        expect(fitted).toHaveLength(1);
        const b = fitted[0]?.modelBounds;
        // clipped mesh AABB is [0,0]–[0.2,0.2]; +5% → [-0.01,-0.01] size 0.22
        expect(b.x).toBeCloseTo(-0.01, 5);
        expect(b.y).toBeCloseTo(-0.01, 5);
        expect(b.width).toBeCloseTo(0.22, 5);
        expect(b.height).toBeCloseTo(0.22, 5);
        expect(b.width).toBeLessThan(2);
    });

    it("falls back to full NDC when clipped meshes missing", () => {
        const part = partitionForClipping([
            { index: 1, maskIndices: [0], invertedMask: false },
        ]);
        const fitted = fitClippingContexts(part.contexts, new Map());
        expect(fitted[0]?.modelBounds).toEqual(FULL_NDC_BOUNDS);
    });
});
