// @vitest-environment happy-dom

import type { FrameProfile } from "@doki-land/live2d-core";
import { createMoc3Backend } from "@doki-land/live2d-renderer";
import { describe, expect, it } from "vitest";
import { createLive2d } from "../../src/facade/create-live2d.js";
import {
    cpuProgramBytes,
    createCountingResolver,
    createStubRenderer,
    inlineCpuModelSource,
} from "../fixtures/cpu-model-fixture.js";

const FRAME_COUNT = 30;
const DT = 1 / 60;

/**
 * `03` §5 harness dry-run: collect FrameProfile for N frames on the CPU fixture.
 * Does **not** claim faster-than-SDK; only proves profile fields are populated.
 */
describe("profile dry-run harness", () => {
    it("collects FrameProfile fields over N updates", async () => {
        const live2d = createLive2d({
            renderer: createStubRenderer(),
            backends: [createMoc3Backend()],
            updateMode: "manual",
        });
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        await live2d.stage.mount(canvas);
        await live2d.loadModel(
            inlineCpuModelSource(),
            createCountingResolver(cpuProgramBytes()),
        );

        const frames: FrameProfile[] = [];
        live2d.events.on("profile", (profile) => {
            frames.push(profile);
        });

        for (let i = 0; i < FRAME_COUNT; i++) {
            live2d.update(DT);
        }

        expect(frames).toHaveLength(FRAME_COUNT);

        const report = {
            kind: "profile-dry-run" as const,
            frameCount: frames.length,
            dtSeconds: DT,
            samples: frames.map((p) => ({
                fps: p.fps,
                evaluateMs: p.evaluateMs,
                drawMs: p.drawMs,
                drawableCount: p.drawableCount,
                frameMs: p.frameMs,
                vertexCount: p.vertexCount,
                indexCount: p.indexCount,
            })),
        };

        for (const sample of report.samples) {
            expect(typeof sample.fps).toBe("number");
            expect(Number.isFinite(sample.fps)).toBe(true);
            expect(typeof sample.evaluateMs).toBe("number");
            expect(Number.isFinite(sample.evaluateMs)).toBe(true);
            expect(typeof sample.drawMs).toBe("number");
            expect(Number.isFinite(sample.drawMs)).toBe(true);
            expect(typeof sample.drawableCount).toBe("number");
            expect(sample.drawableCount).toBeGreaterThanOrEqual(0);
        }

        // Harness report shape is assertable; never used as SDK speed evidence.
        expect(report.kind).toBe("profile-dry-run");
        expect(report.frameCount).toBe(FRAME_COUNT);

        live2d.destroy();
    });
});
