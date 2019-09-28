import { describe, expect, it } from "vitest";
import { createLive2dStage } from "../../src/stage/stage.js";
import { compareActorsForDraw } from "../../src/stage/transform.js";

describe("createLive2dStage", () => {
    it("creates multiple actors with unique ids", () => {
        const stage = createLive2dStage({ updateMode: "manual" });
        const a = stage.createActor({ id: "alice" });
        const b = stage.createActor({ id: "bob" });
        expect(stage.actors).toHaveLength(2);
        expect(a.id).toBe("alice");
        expect(b.id).toBe("bob");
        expect(a.creationIndex).toBeLessThan(b.creationIndex);
        stage.destroy();
    });

    it("rejects duplicate actor ids", () => {
        const stage = createLive2dStage({ updateMode: "manual" });
        stage.createActor({ id: "dup" });
        expect(() => stage.createActor({ id: "dup" })).toThrow(/duplicate/);
        stage.destroy();
    });

    it("sorts actors by layer then order", () => {
        const stage = createLive2dStage({ updateMode: "manual" });
        const back = stage.createActor({
            id: "back",
            layer: "characters-back",
            order: 0,
        });
        const front = stage.createActor({
            id: "front",
            layer: "characters-front",
            order: 0,
        });
        const mid = stage.createActor({
            id: "mid",
            layer: "characters",
            order: 5,
        });
        const sorted = [...stage.actors].sort((a, b) =>
            compareActorsForDraw(a, b, [
                "background",
                "characters-back",
                "characters",
                "characters-front",
                "effects",
            ]),
        );
        expect(sorted.map((a) => a.id)).toEqual([back.id, mid.id, front.id]);
        stage.destroy();
    });

    it("removes actors and updates focus", () => {
        const stage = createLive2dStage({ updateMode: "manual" });
        const a = stage.createActor({ id: "a" });
        const b = stage.createActor({ id: "b" });
        expect(stage.getActor("a")).toBe(a);
        expect(stage.getActor("missing")).toBeNull();
        stage.removeActor(a);
        expect(stage.actors).toHaveLength(1);
        expect(stage.actors[0]?.id).toBe(b.id);
        stage.destroy();
    });
});

describe("Live2dActor motion API", () => {
    it("delegates motion helpers before a model is loaded", async () => {
        const stage = createLive2dStage({ updateMode: "manual" });
        const actor = stage.createActor({ id: "idle" });
        expect(actor.listParameters()).toEqual([]);
        expect(actor.listMotionGroups()).toEqual({});
        expect(await actor.playMotion("Idle")).toBe(false);
        actor.stopMotion();
        expect(actor.listPlayingMotions()).toEqual([]);
        stage.destroy();
    });
});

describe("createLive2D facade", () => {
    it("exposes stage and default actor", async () => {
        const { createLive2D } = await import("../../src/create-live2d.js");
        const live2d = createLive2D();
        expect(live2d.stage).toBeDefined();
        expect(live2d.actor).toBeDefined();
        expect(live2d.stage.actors).toHaveLength(1);
        live2d.destroy();
    });
});
