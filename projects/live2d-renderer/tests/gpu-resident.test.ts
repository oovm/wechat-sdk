/**
 * Resident clipping / mask atlas plan — `规划设计/live2d/03` §6 (v0.0.20).
 */
import { describe, expect, it } from "vitest";
import {
    clippingTopologyKey,
    ResidentClippingPlan,
} from "../src/render/clipping-plan.js";
import { interleavePosUv } from "../src/render/mesh-interleave.js";
import { BlendMode, type DrawableMesh } from "../src/types.js";

function mesh(
    index: number,
    maskIndices: number[],
    positions = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0, 0.5]),
): DrawableMesh {
    return {
        index,
        textureIndex: 0,
        vertexPositions: positions,
        uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
        indices: new Uint16Array([0, 1, 2]),
        opacity: 1,
        blendMode: BlendMode.Normal,
        invertedMask: false,
        renderOrder: index,
        dynamicFlag: true,
        maskIndices,
        visible: true,
    };
}

describe("ResidentClippingPlan", () => {
    it("reuses context array identity when mask topology is unchanged", () => {
        const plan = new ResidentClippingPlan();
        const a = [
            mesh(0, []),
            mesh(1, [0], new Float32Array([0, 0, 0.2, 0, 0.1, 0.2])),
        ];
        const first = plan.resolveMeshes(a);
        const contextsA = plan.residentContexts;
        expect(first.contexts).toBe(contextsA);
        expect(first.contexts).toHaveLength(1);

        const b = [
            mesh(0, []),
            mesh(1, [0], new Float32Array([0.1, 0.1, 0.3, 0.1, 0.2, 0.3])),
        ];
        const second = plan.resolveMeshes(b);
        expect(second.contexts).toBe(contextsA);
        expect(second.contexts[0]).toBe(contextsA[0]);
        // Bounds refresh with new positions
        expect(second.contexts[0]!.modelBounds.width).toBeCloseTo(0.22, 5);

        // Topology change reallocates plan
        const c = [mesh(0, []), mesh(1, [0]), mesh(2, [0])];
        const third = plan.resolveMeshes(c);
        expect(third.contexts).not.toBe(contextsA);
        expect(third.contexts).toHaveLength(1);
        expect(third.contexts[0]!.clippedIndices).toEqual([1, 2]);
        plan.clear();
    });

    it("clippingTopologyKey ignores positions", () => {
        const a = [mesh(1, [0], new Float32Array([0, 0, 1, 0, 0, 1]))];
        const b = [mesh(1, [0], new Float32Array([9, 9, 8, 8, 7, 7]))];
        expect(clippingTopologyKey(a)).toBe(clippingTopologyKey(b));
        const c = [mesh(1, [0, 2])];
        expect(clippingTopologyKey(a)).not.toBe(clippingTopologyKey(c));
    });
});

describe("interleavePosUv resident buffer", () => {
    it("reuses into when capacity is enough", () => {
        const into = new Float32Array(32);
        const pos = new Float32Array([1, 2, 3, 4]);
        const uvs = new Float32Array([0, 1, 0, 1]);
        const out = interleavePosUv(pos, uvs, into);
        expect(out).toBe(into);
        expect(out[0]).toBe(1);
        expect(out[2]).toBe(0);
        expect(out[4]).toBe(3);
    });
});
