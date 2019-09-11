import { DEFAULT_ACTOR_TRANSFORM } from "@doki-land/live2d-core";
import { describe, expect, it } from "vitest";
import {
    compareActorsForDraw,
    compareActorsForHit,
    modelNdcToStage,
    resolveActorTransform,
    stageFocusDrag,
    stageToModelNdc,
} from "../../src/stage/transform.js";

describe("resolveActorTransform", () => {
    it("fills scaleX/scaleY from uniform scale", () => {
        const t = resolveActorTransform({ x: 0.25, scale: 0.8 });
        expect(t.scaleX).toBe(0.8);
        expect(t.scaleY).toBe(0.8);
        expect(t.x).toBe(0.25);
    });
});

describe("modelNdcToStage", () => {
    it("places model bottom-center at the actor anchor", () => {
        const t = resolveActorTransform({
            x: 0.25,
            y: 1,
            scale: 1,
            anchorX: 0.5,
            anchorY: 1,
        });
        const bottom = modelNdcToStage(0, -1, t);
        expect(bottom.stageX).toBeCloseTo(0.25, 5);
        expect(bottom.stageY).toBeCloseTo(1, 5);
    });

    it("round-trips through stageToModelNdc without rotation", () => {
        const t = resolveActorTransform({ x: 0.4, y: 0.9, scale: 0.6 });
        const model = { modelX: 0.3, modelY: -0.2 };
        const stage = modelNdcToStage(model.modelX, model.modelY, t);
        const back = stageToModelNdc(stage.stageX, stage.stageY, t);
        expect(back.modelX).toBeCloseTo(model.modelX, 5);
        expect(back.modelY).toBeCloseTo(model.modelY, 5);
    });
});

describe("stageFocusDrag", () => {
    it("returns positive drag toward the pointer", () => {
        const t = resolveActorTransform(DEFAULT_ACTOR_TRANSFORM);
        const { dragX, dragY } = stageFocusDrag(0.75, 0.25, t);
        expect(dragX).toBeGreaterThan(0);
        expect(dragY).toBeGreaterThan(0);
    });
});

describe("actor sort", () => {
    const layers = ["background", "characters", "effects"];
    const actors = [
        { id: "a", layer: "characters", order: 0, creationIndex: 0 },
        { id: "b", layer: "effects", order: 0, creationIndex: 1 },
        { id: "c", layer: "characters", order: 5, creationIndex: 2 },
    ];

    it("sorts back-to-front for draw", () => {
        const sorted = [...actors].sort((a, b) =>
            compareActorsForDraw(a, b, layers),
        );
        expect(sorted.map((a) => a.id)).toEqual(["a", "c", "b"]);
    });

    it("sorts front-to-back for hit", () => {
        const sorted = [...actors].sort((a, b) =>
            compareActorsForHit(a, b, layers),
        );
        expect(sorted.map((a) => a.id)).toEqual(["b", "c", "a"]);
    });
});
