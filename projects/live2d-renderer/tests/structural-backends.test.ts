/**
 * @vitest-environment happy-dom
 *
 * Three-backend structural conformance (v0.0.22 thin gate).
 *
 * Asserts initialize → kind → createModelDrawPass → begin/endFrame →
 * resize → destroy. Canvas2D uses a minimal getContext('2d') mock under
 * happy-dom (no native canvas). WebGL2 / WebGPU soft-skip when unavailable.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createRenderer } from "../src/runtime/create-renderer.js";
import type { RendererKind } from "../src/types.js";

const KINDS: RendererKind[] = ["canvas2d", "webgl2", "webgpu"];

const IDENTITY = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

function installMinimalCanvas2d(): () => void {
    const proto = HTMLCanvasElement.prototype;
    const original = proto.getContext;
    proto.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
    ): RenderingContext | null {
        if (type === "2d") {
            const ctx = {
                canvas: this,
                setTransform() {},
                clearRect() {},
                save() {},
                restore() {},
                beginPath() {},
                closePath() {},
                moveTo() {},
                lineTo() {},
                fill() {},
                stroke() {},
                drawImage() {},
                createPattern() {
                    return null;
                },
                globalAlpha: 1,
                globalCompositeOperation: "source-over",
                fillStyle: "#000",
                strokeStyle: "#000",
            } as unknown as CanvasRenderingContext2D;
            return ctx;
        }
        return original.call(this, type as "2d", ...(args as []));
    };
    return () => {
        proto.getContext = original;
    };
}

describe("renderer structural conformance", () => {
    let restore: (() => void) | undefined;

    afterEach(() => {
        restore?.();
        restore = undefined;
    });

    it.each(KINDS)(
        "%s: init → draw pass → frame → resize → destroy",
        async (kind) => {
            if (kind === "canvas2d") {
                restore = installMinimalCanvas2d();
            }

            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 64;
            document.body.appendChild(canvas);

            const renderer = createRenderer({ prefer: [kind] });
            try {
                await renderer.initialize(canvas);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[structural] soft-skip ${kind}: ${msg}`);
                renderer.destroy();
                return;
            }

            expect(renderer.kind).toBe(kind);
            const pass = renderer.createModelDrawPass();
            renderer.beginFrame();
            pass.draw([], IDENTITY);
            renderer.endFrame();
            expect(() => renderer.resize(128, 128)).not.toThrow();
            pass.destroy();
            renderer.destroy();
        },
    );
});
