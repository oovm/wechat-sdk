import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/minimal.motion3.json";
import { blendMotionLayers, MotionPlayer } from "./motion-player.js";
import { parseMotion3 } from "./parse-motion3.js";
import { MotionPriority } from "./types.js";

describe("MotionPlayer", () => {
    const clip = parseMotion3(fixture);

    it("plays and finishes a non-looping clip", () => {
        const onStart = vi.fn();
        const onFinish = vi.fn();
        const onEvent = vi.fn();
        const player = new MotionPlayer({ onStart, onFinish, onEvent });
        expect(player.start("Idle", 0, clip)).toBe(true);

        const first = player.update(0);
        expect(onStart).toHaveBeenCalledWith(
            expect.objectContaining({ group: "Idle", index: 0 }),
        );
        expect(first.some((s) => s.id === "PARAM_ANGLE_X")).toBe(true);

        player.update(0.5);
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({ value: "mid" }),
        );

        player.update(0.6);
        expect(onFinish).toHaveBeenCalledWith(
            expect.objectContaining({ group: "Idle", index: 0 }),
        );
        expect(player.isPlaying).toBe(false);
    });

    it("rejects lower priority on same default slot family when not queued", () => {
        const player = new MotionPlayer();
        expect(
            player.start("Idle", 0, clip, {
                priority: MotionPriority.normal,
                slot: "main",
            }),
        ).toBe(true);
        expect(
            player.start("Tap", 0, clip, {
                priority: MotionPriority.idle,
                slot: "main",
            }),
        ).toBe(false);
    });

    it("runs idle and normal in parallel on default priority slots", () => {
        const player = new MotionPlayer();
        const idleClip = parseMotion3({
            ...fixture,
            Meta: { ...fixture.Meta, Duration: 2, Loop: true },
        });
        expect(
            player.start("Idle", 0, idleClip, {
                priority: MotionPriority.idle,
            }),
        ).toBe(true);
        expect(
            player.start("Tap", 0, clip, {
                priority: MotionPriority.normal,
            }),
        ).toBe(true);
        expect(player.listPlaying()).toHaveLength(2);
        const samples = player.update(0.1);
        expect(samples.length).toBeGreaterThan(0);
    });

    it("queues on a busy slot", () => {
        const onFinish = vi.fn();
        const player = new MotionPlayer({ onFinish });
        const short = parseMotion3({
            ...fixture,
            Meta: { ...fixture.Meta, Duration: 0.2, FadeOutTime: 0 },
            UserData: [],
        });
        expect(
            player.start("A", 0, short, { slot: "q", queue: false }),
        ).toBe(true);
        expect(
            player.start("B", 1, short, { slot: "q", queue: true }),
        ).toBe(true);
        player.update(0.25);
        expect(onFinish).toHaveBeenCalledWith(
            expect.objectContaining({ group: "A" }),
        );
        expect(player.listPlaying()[0]?.group).toBe("B");
    });

    it("applies fade-in weight", () => {
        const faded = parseMotion3({
            ...fixture,
            Meta: { ...fixture.Meta, FadeInTime: 1, Duration: 2 },
        });
        const player = new MotionPlayer();
        player.start("Idle", 0, faded, { fadeInTime: 1 });
        const samples = player.update(0);
        expect(samples[0]!.weight).toBeCloseTo(0);
        const mid = player.update(0.5);
        expect(mid[0]!.weight).toBeGreaterThan(0.2);
        expect(mid[0]!.weight).toBeLessThan(0.9);
    });
});

describe("blendMotionLayers", () => {
    it("lerps higher priority over lower", () => {
        const out = blendMotionLayers([
            {
                priority: 1,
                samples: [
                    {
                        target: "Parameter",
                        id: "X",
                        value: 0,
                        weight: 1,
                    },
                ],
            },
            {
                priority: 2,
                samples: [
                    {
                        target: "Parameter",
                        id: "X",
                        value: 10,
                        weight: 0.5,
                    },
                ],
            },
        ]);
        expect(out[0]!.value).toBeCloseTo(5);
    });
});
