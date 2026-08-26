/**
 * S7 — `03` §5 benchmark evidence pack (self metrics).
 * Writes `dist/benchmark.proof.json`. Does **not** claim faster-than-SDK;
 * official SDK compare remains handoff (must not depend on Cubism Core here).
 */
// @vitest-environment happy-dom

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMoc3Backend } from "@doki-land/live2d-renderer";
import { describe, expect, it } from "vitest";
import { createLive2dStage } from "../../src/stage/stage.js";
import {
    cpuProgramBytes,
    createCountingResolver,
    createStubRenderer,
    inlineCpuModelSource,
} from "../fixtures/cpu-model-fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../../..");
const PROOF_PATH = join(ROOT, "dist/benchmark.proof.json");

const FRAME_COUNT = 60;
const WARMUP = 10;
const DT = 1 / 60;
const ACTOR_COUNTS = [1, 2, 4, 8] as const;
const VIEWPORT = { width: 256, height: 256, dpr: 1 } as const;

function percentile(sortedAsc: number[], p: number): number {
    if (sortedAsc.length === 0) return 0;
    const idx = Math.min(
        sortedAsc.length - 1,
        Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
    );
    return sortedAsc[idx] as number;
}

function summarizeMs(samples: number[]) {
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
        meanMs: sum / sorted.length,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        p99Ms: percentile(sorted, 99),
        minMs: sorted[0] as number,
        maxMs: sorted[sorted.length - 1] as number,
        samples: sorted.length,
    };
}

function heapUsedBytes(): number | null {
    try {
        return process.memoryUsage().heapUsed;
    } catch {
        return null;
    }
}

function createCountingDrawRenderer() {
    const base = createStubRenderer();
    let drawCalls = 0;
    let beginFrames = 0;
    return {
        renderer: {
            ...base,
            beginFrame() {
                beginFrames += 1;
                base.beginFrame();
            },
            createModelDrawPass() {
                const pass = base.createModelDrawPass();
                return {
                    setTextures: pass.setTextures.bind(pass),
                    destroy: pass.destroy.bind(pass),
                    draw() {
                        drawCalls += 1;
                    },
                };
            },
        },
        stats: {
            get drawCalls() {
                return drawCalls;
            },
            get beginFrames() {
                return beginFrames;
            },
            reset() {
                drawCalls = 0;
                beginFrames = 0;
            },
        },
    };
}

describe("benchmark evidence pack (S7)", () => {
    it("writes dist/benchmark.proof.json for fixed cpu-quad scenario", async () => {
        const programBytes = cpuProgramBytes();
        const scaling: Array<{
            actorCount: number;
            evaluate: ReturnType<typeof summarizeMs>;
            frame: ReturnType<typeof summarizeMs>;
            drawCallsPerFrame: number;
            drawableCount: number;
            vertexCount: number;
            indexCount: number;
            peakHeapBytes: number | null;
            firstFrameMs: number;
        }> = [];

        let peakHeap: number | null = heapUsedBytes();

        for (const actorCount of ACTOR_COUNTS) {
            const { renderer, stats } = createCountingDrawRenderer();
            const stage = createLive2dStage({
                renderer,
                backends: [createMoc3Backend()],
                updateMode: "manual",
            });
            const canvas = document.createElement("canvas");
            canvas.width = VIEWPORT.width * VIEWPORT.dpr;
            canvas.height = VIEWPORT.height * VIEWPORT.dpr;
            await stage.mount(canvas);

            const tLoad0 = performance.now();
            for (let i = 0; i < actorCount; i++) {
                const actor = stage.createActor({
                    id: `bench-${actorCount}-${i}`,
                });
                await actor.load(
                    inlineCpuModelSource(),
                    createCountingResolver(programBytes.slice(0)),
                );
            }
            const firstFrameMs = performance.now() - tLoad0;

            for (let i = 0; i < WARMUP; i++) {
                stage.update(DT);
                stage.render();
            }

            stats.reset();
            const evaluateSamples: number[] = [];
            const frameSamples: number[] = [];
            let drawableCount = 0;
            let vertexCount = 0;
            let indexCount = 0;

            for (let i = 0; i < FRAME_COUNT; i++) {
                const heap = heapUsedBytes();
                if (heap != null) {
                    peakHeap =
                        peakHeap == null ? heap : Math.max(peakHeap, heap);
                }
                const t0 = performance.now();
                stage.update(DT);
                const t1 = performance.now();
                stage.render();
                const t2 = performance.now();
                evaluateSamples.push(t1 - t0);
                frameSamples.push(t2 - t0);

                drawableCount = 0;
                vertexCount = 0;
                indexCount = 0;
                for (const actor of stage.actors) {
                    const drawables =
                        (
                            actor as {
                                lastDrawables?: Array<{
                                    vertexPositions: ArrayLike<number>;
                                    indices: ArrayLike<number>;
                                }>;
                            }
                        ).lastDrawables ?? [];
                    drawableCount += drawables.length;
                    for (const d of drawables) {
                        vertexCount += d.vertexPositions.length / 2;
                        indexCount += d.indices.length;
                    }
                }
            }

            scaling.push({
                actorCount,
                evaluate: summarizeMs(evaluateSamples),
                frame: summarizeMs(frameSamples),
                drawCallsPerFrame: stats.drawCalls / FRAME_COUNT,
                drawableCount,
                vertexCount,
                indexCount,
                peakHeapBytes: peakHeap,
                firstFrameMs,
            });

            stage.destroy();
        }

        const proof = {
            kind: "benchmark-proof" as const,
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            claims: {
                fasterThanOfficialSdk: false,
                note: "Self metrics only. Official SDK compare is handoff — do not claim faster-than-SDK from this artifact.",
            },
            scenario: {
                modelId: "cpu-quad",
                modelKind: "cpu-program",
                motion: "none",
                viewport: VIEWPORT,
                browser: "vitest/happy-dom (CI CPU gate)",
                frameCount: FRAME_COUNT,
                warmupFrames: WARMUP,
                dtSeconds: DT,
                renderer: "stub-canvas2d (draw-call counting)",
            },
            metrics: {
                cpuEvaluate: {
                    status: "measured",
                    byActorCount: Object.fromEntries(
                        scaling.map((row) => [
                            String(row.actorCount),
                            row.evaluate,
                        ]),
                    ),
                },
                jsAllocBytesPerFrame: {
                    status: "unavailable",
                    reason: "Per-frame allocation accounting requires instrumented heap or --expose-gc; peakHeap is reported instead.",
                },
                gcPauseMs: {
                    status: "unavailable",
                    reason: "GC pause sampling needs --expose-gc / PerformanceObserver; not enabled in default CI.",
                },
                gpuTimeMs: {
                    status: "unavailable",
                    reason: "CI gate uses stub renderer (no GPU). Browser GPU handoff reuses S5 Chromium matrix environment.",
                },
                drawCalls: {
                    status: "measured",
                    byActorCount: Object.fromEntries(
                        scaling.map((row) => [
                            String(row.actorCount),
                            row.drawCallsPerFrame,
                        ]),
                    ),
                },
                maskPasses: {
                    status: "unavailable",
                    reason: "Mask atlas pass counters require GPU backend instrumentation (handoff).",
                },
                uploadBytes: {
                    status: "unavailable",
                    reason: "Dirty-range upload byte counters require GPU backend instrumentation (handoff).",
                },
                firstFrameMs: {
                    status: "measured",
                    byActorCount: Object.fromEntries(
                        scaling.map((row) => [
                            String(row.actorCount),
                            row.firstFrameMs,
                        ]),
                    ),
                },
                peakMemoryBytes: {
                    status: peakHeap == null ? "unavailable" : "measured",
                    heapUsedBytes: peakHeap,
                },
                actorScaleCurve: {
                    status: "measured",
                    points: scaling.map((row) => ({
                        actors: row.actorCount,
                        evaluateP95Ms: row.evaluate.p95Ms,
                        frameP95Ms: row.frame.p95Ms,
                        drawCallsPerFrame: row.drawCallsPerFrame,
                        drawableCount: row.drawableCount,
                        vertexCount: row.vertexCount,
                        indexCount: row.indexCount,
                    })),
                },
            },
            officialSdkCompare: {
                status: "handoff",
                environment:
                    "live2d-ts-ref-repos (CubismWebFramework / CubismWebSamples) — outside live2d.ts dependency graph",
                blockedReason:
                    "AGENTS / clean-room: must not add official Cubism Core as a live2d.ts dependency. Comparative scripts stay in handoff env.",
            },
            checklist03Section5: {
                "cpu-evaluate-mean-p95-p99": "measured",
                "js-alloc-per-frame": "unavailable",
                "gc-pause": "unavailable",
                "gpu-time": "unavailable",
                "draw-calls": "measured",
                "mask-passes": "unavailable",
                "upload-bytes": "unavailable",
                "first-frame": "measured",
                "peak-memory": peakHeap == null ? "unavailable" : "measured",
                "actor-scale-1-2-4-8": "measured",
                "official-sdk-same-scene": "handoff",
            },
        };

        mkdirSync(dirname(PROOF_PATH), { recursive: true });
        writeFileSync(
            PROOF_PATH,
            `${JSON.stringify(proof, null, 2)}\n`,
            "utf8",
        );

        expect(proof.kind).toBe("benchmark-proof");
        expect(proof.claims.fasterThanOfficialSdk).toBe(false);
        expect(scaling).toHaveLength(ACTOR_COUNTS.length);
        for (const row of scaling) {
            expect(row.evaluate.samples).toBe(FRAME_COUNT);
            expect(row.evaluate.p95Ms).toBeGreaterThanOrEqual(0);
            expect(row.drawCallsPerFrame).toBeGreaterThan(0);
        }
    });
});
