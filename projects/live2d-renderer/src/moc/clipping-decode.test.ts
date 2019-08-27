import { describe, expect, it } from "vitest";
import { buildClippingContexts, partitionForClipping } from "../clipping.js";
import { decodeMoc3 } from "./decode.js";
import {
    CLIPPING_MOC3_CANDIDATES,
    HARU_MOC3_CANDIDATES,
    MAO_MOC3_CANDIDATES,
    MARK_MOC3_CANDIDATES,
    tryReadFixture,
} from "./test-fixtures.js";

const clippingBytes = tryReadFixture(...CLIPPING_MOC3_CANDIDATES);

describe.skipIf(!clippingBytes)("clipping (Clipping.moc3)", () => {
    function loadClipping(): ArrayBuffer {
        return clippingBytes!.slice(0);
    }

    it("decodes one masked drawable referencing its mask mesh", async () => {
        const { program } = await decodeMoc3(loadClipping());
        expect(program.drawables.length).toBe(3);
        const masked = program.drawables.filter(
            (d) => d.maskIndices.length > 0,
        );
        expect(masked.length).toBe(1);
        expect(masked[0]?.maskIndices).toEqual([2]);
        expect(masked[0]?.invertedMask).toBe(false);
    });

    it("groups shared mask sets into one clipping context", async () => {
        const { program } = await decodeMoc3(loadClipping());
        const contexts = buildClippingContexts(program.drawables);
        expect(contexts.length).toBe(1);
        expect(contexts[0]?.maskIndices).toEqual([2]);
        expect(contexts[0]?.clippedIndices).toEqual([1]);
        expect(contexts[0]?.invertedMask).toBe(false);
    });
});

describe("clipping (Mark.moc3 multi-mask)", () => {
    it("decodes multiple masked drawables and groups contexts", async () => {
        const bytes = tryReadFixture(...MARK_MOC3_CANDIDATES);
        if (!bytes) return; // optional sample
        const { program } = await decodeMoc3(bytes);
        const masked = program.drawables.filter(
            (d) => d.maskIndices.length > 0,
        );
        expect(masked.length).toBeGreaterThan(0);
        const contexts = buildClippingContexts(program.drawables);
        expect(contexts.length).toBeGreaterThan(0);
        const maxMasks = Math.max(
            ...masked.map((d) => d.maskIndices.length),
            0,
        );
        expect(maxMasks).toBeGreaterThanOrEqual(1);
        for (const ctx of contexts) {
            expect(ctx.maskIndices.length).toBeGreaterThan(0);
            expect(ctx.clippedIndices.length).toBeGreaterThan(0);
        }
    });
});

describe("mask atlas density (Haru / Mao)", () => {
    it("Haru packs multiple clipping contexts with distinct atlas slots", async () => {
        const bytes = tryReadFixture(...HARU_MOC3_CANDIDATES);
        if (!bytes) return;
        const { program } = await decodeMoc3(bytes);
        const part = partitionForClipping(program.drawables);
        expect(part.contexts.length).toBeGreaterThan(1);
        const slots = new Set(
            part.contexts.map(
                (c) =>
                    `${c.channelIndex}:${c.layout.x.toFixed(4)},${c.layout.y.toFixed(4)},${c.layout.width.toFixed(4)}`,
            ),
        );
        expect(slots.size).toBe(part.contexts.length);
        for (const c of part.contexts) {
            expect(c.channelIndex).toBeGreaterThanOrEqual(0);
            expect(c.channelIndex).toBeLessThanOrEqual(3);
            expect(c.layout.x).toBeGreaterThanOrEqual(0);
            expect(c.layout.y).toBeGreaterThanOrEqual(0);
            expect(c.layout.x + c.layout.width).toBeLessThanOrEqual(1.001);
            expect(c.layout.y + c.layout.height).toBeLessThanOrEqual(1.001);
        }
    });

    it("Mao packs multiple clipping contexts with distinct atlas slots", async () => {
        const bytes = tryReadFixture(...MAO_MOC3_CANDIDATES);
        if (!bytes) return;
        const { program } = await decodeMoc3(bytes);
        const part = partitionForClipping(program.drawables);
        expect(part.contexts.length).toBeGreaterThan(1);
        const slots = new Set(
            part.contexts.map(
                (c) =>
                    `${c.channelIndex}:${c.layout.x.toFixed(4)},${c.layout.y.toFixed(4)},${c.layout.width.toFixed(4)}`,
            ),
        );
        expect(slots.size).toBe(part.contexts.length);
    });
});
