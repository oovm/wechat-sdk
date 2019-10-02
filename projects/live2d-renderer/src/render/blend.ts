/**
 * Map Live2D blend modes to WebGL / Canvas compositing.
 */

import { BlendMode } from "../types.js";

/** Apply premultiplied-friendly Live2D blend factors on a WebGL2 context. */
export function applyWebGl2BlendMode(
    gl: WebGL2RenderingContext,
    mode: BlendMode,
): void {
    gl.enable(gl.BLEND);
    switch (mode) {
        case BlendMode.Additive:
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
            break;
        case BlendMode.Multiplicative:
            gl.blendFuncSeparate(
                gl.DST_COLOR,
                gl.ONE_MINUS_SRC_ALPHA,
                gl.ZERO,
                gl.ONE,
            );
            break;
        default:
            gl.blendFuncSeparate(
                gl.SRC_ALPHA,
                gl.ONE_MINUS_SRC_ALPHA,
                gl.ONE,
                gl.ONE_MINUS_SRC_ALPHA,
            );
            break;
    }
}

/** Canvas2D globalCompositeOperation for Live2D blend modes. */
export function canvasCompositeForBlendMode(
    mode: BlendMode,
): GlobalCompositeOperation {
    switch (mode) {
        case BlendMode.Additive:
            return "lighter";
        case BlendMode.Multiplicative:
            return "multiply";
        default:
            return "source-over";
    }
}

/** WebGPU blend state for Live2D modes (straight alpha draw path). */
export function webGpuBlendState(mode: BlendMode): GPUBlendState {
    switch (mode) {
        case BlendMode.Additive:
            return {
                color: {
                    srcFactor: "src-alpha",
                    dstFactor: "one",
                    operation: "add",
                },
                alpha: {
                    srcFactor: "zero",
                    dstFactor: "one",
                    operation: "add",
                },
            };
        case BlendMode.Multiplicative:
            return {
                color: {
                    srcFactor: "dst",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                },
                alpha: {
                    srcFactor: "zero",
                    dstFactor: "one",
                    operation: "add",
                },
            };
        default:
            return {
                color: {
                    srcFactor: "src-alpha",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                },
                alpha: {
                    srcFactor: "one",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add",
                },
            };
    }
}
