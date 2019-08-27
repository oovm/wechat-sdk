/**
 * WebGL2 renderer with soft clipping-mask support.
 *
 * Mask path: render mask meshes into an offscreen FBO (NDC→UV 1:1), then
 * multiply drawable alpha by the mask (or 1−mask when inverted).
 */

import { applyWebGl2BlendMode } from "./blend.js";
import {
    fitClippingContexts,
    type LaidOutClippingContext,
    type MaskLayoutRect,
    maskChannelVec4,
    maskLayoutVec4,
    partitionForClipping,
} from "./clipping.js";
import {
    PREVIEW_FILL,
    PREVIEW_STROKE,
    triangleEdgesToLineList,
} from "./preview-style.js";
import type {
    DrawableMesh,
    ModelDrawPass,
    TextureData,
    WebGl2Renderer,
} from "./types.js";

const VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
out vec2 v_uv;
out vec2 v_pos;
void main() {
  v_uv = a_uv;
  v_pos = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** Mask write: map modelBounds → atlas UV cell → clip space. */
const VS_MASK = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
uniform vec4 u_mask_layout; // xy offset, zw size in 0..1
uniform vec4 u_mask_bounds; // model-space xy min, zw size
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  vec2 local = (a_pos - u_mask_bounds.xy) / max(u_mask_bounds.zw, vec2(1e-6));
  vec2 atlasUv = u_mask_layout.xy + local * u_mask_layout.zw;
  gl_Position = vec4(atlasUv * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec2 v_pos;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform vec4 u_color;
uniform vec4 u_mask_layout;
uniform vec4 u_mask_bounds;
uniform vec4 u_channel_flag;
uniform float u_use_texture;
uniform float u_opacity;
uniform float u_use_mask;
uniform float u_invert_mask;
out vec4 out_color;
void main() {
  vec4 base;
  if (u_use_texture > 0.5) {
    vec4 tex = texture(u_tex, v_uv);
    base = vec4(tex.rgb, tex.a * u_opacity);
  } else {
    base = u_color;
  }
  if (u_use_mask > 0.5) {
    vec2 local = (v_pos - u_mask_bounds.xy) / max(u_mask_bounds.zw, vec2(1e-6));
    vec2 muv = u_mask_layout.xy + local * u_mask_layout.zw;
    float m = dot(texture(u_mask, muv), u_channel_flag);
    if (u_invert_mask > 0.5) m = 1.0 - m;
    base.a *= m;
    base.rgb *= m;
  }
  out_color = base;
}
`;

/** Mask pass: write coverage into the selected RGBA channel. */
const FS_MASK = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_channel_flag;
uniform float u_use_texture;
uniform float u_opacity;
out vec4 out_color;
void main() {
  float a = u_opacity;
  if (u_use_texture > 0.5) {
    a *= texture(u_tex, v_uv).a;
  }
  out_color = u_channel_flag * a;
}
`;

function compile(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error("@doki-land/live2d-renderer: failed to create shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) ?? "compile failed";
        gl.deleteShader(shader);
        throw new Error(`@doki-land/live2d-renderer: ${info}`);
    }
    return shader;
}

function linkProgram(
    gl: WebGL2RenderingContext,
    vsSource: string,
    fsSource: string,
): WebGLProgram {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program) {
        throw new Error("@doki-land/live2d-renderer: failed to create program");
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program) ?? "link failed";
        gl.deleteProgram(program);
        throw new Error(`@doki-land/live2d-renderer: ${info}`);
    }
    return program;
}

function interleavePosUv(
    positions: Float32Array,
    uvs: Float32Array,
): Float32Array {
    const n = Math.floor(positions.length / 2);
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        const p = i * 2;
        out[o] = positions[p]!;
        out[o + 1] = positions[p + 1]!;
        out[o + 2] = uvs[p] ?? 0;
        out[o + 3] = uvs[p + 1] ?? 0;
    }
    return out;
}

function requireUniform(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    name: string,
): WebGLUniformLocation {
    const loc = gl.getUniformLocation(program, name);
    if (!loc) {
        throw new Error(
            `@doki-land/live2d-renderer: required uniform missing: ${name}`,
        );
    }
    return loc;
}

class WebGl2ModelDrawPass implements ModelDrawPass {
    readonly #gl: WebGL2RenderingContext;
    readonly #program: WebGLProgram;
    readonly #maskProgram: WebGLProgram;
    readonly #colorLoc: WebGLUniformLocation;
    readonly #opacityLoc: WebGLUniformLocation;
    readonly #useTexLoc: WebGLUniformLocation;
    readonly #texLoc: WebGLUniformLocation;
    readonly #maskLoc: WebGLUniformLocation;
    readonly #useMaskLoc: WebGLUniformLocation;
    readonly #invertMaskLoc: WebGLUniformLocation;
    readonly #maskLayoutLoc: WebGLUniformLocation;
    readonly #maskBoundsLoc: WebGLUniformLocation;
    readonly #channelFlagLoc: WebGLUniformLocation;
    readonly #maskOpacityLoc: WebGLUniformLocation;
    readonly #maskUseTexLoc: WebGLUniformLocation;
    readonly #maskTexLoc: WebGLUniformLocation;
    readonly #maskWriteLayoutLoc: WebGLUniformLocation;
    readonly #maskWriteBoundsLoc: WebGLUniformLocation;
    readonly #maskWriteChannelLoc: WebGLUniformLocation;
    readonly #vao: WebGLVertexArrayObject;
    readonly #vbo: WebGLBuffer;
    readonly #ibo: WebGLBuffer;
    #gpuTextures: (WebGLTexture | null)[] = [];
    #maskFbo: WebGLFramebuffer | null = null;
    #maskTex: WebGLTexture | null = null;
    #maskW = 0;
    #maskH = 0;

    constructor(gl: WebGL2RenderingContext) {
        this.#gl = gl;
        this.#program = linkProgram(gl, VS, FS);
        this.#maskProgram = linkProgram(gl, VS_MASK, FS_MASK);

        this.#colorLoc = requireUniform(gl, this.#program, "u_color");
        this.#opacityLoc = requireUniform(gl, this.#program, "u_opacity");
        this.#useTexLoc = requireUniform(gl, this.#program, "u_use_texture");
        this.#texLoc = requireUniform(gl, this.#program, "u_tex");
        this.#maskLoc = requireUniform(gl, this.#program, "u_mask");
        this.#useMaskLoc = requireUniform(gl, this.#program, "u_use_mask");
        this.#invertMaskLoc = requireUniform(
            gl,
            this.#program,
            "u_invert_mask",
        );
        this.#maskLayoutLoc = requireUniform(
            gl,
            this.#program,
            "u_mask_layout",
        );
        this.#maskBoundsLoc = requireUniform(
            gl,
            this.#program,
            "u_mask_bounds",
        );
        this.#channelFlagLoc = requireUniform(
            gl,
            this.#program,
            "u_channel_flag",
        );

        this.#maskOpacityLoc = requireUniform(
            gl,
            this.#maskProgram,
            "u_opacity",
        );
        this.#maskUseTexLoc = requireUniform(
            gl,
            this.#maskProgram,
            "u_use_texture",
        );
        this.#maskTexLoc = requireUniform(gl, this.#maskProgram, "u_tex");
        this.#maskWriteLayoutLoc = requireUniform(
            gl,
            this.#maskProgram,
            "u_mask_layout",
        );
        this.#maskWriteBoundsLoc = requireUniform(
            gl,
            this.#maskProgram,
            "u_mask_bounds",
        );
        this.#maskWriteChannelLoc = requireUniform(
            gl,
            this.#maskProgram,
            "u_channel_flag",
        );

        const vao = gl.createVertexArray();
        const vbo = gl.createBuffer();
        const ibo = gl.createBuffer();
        if (!vao || !vbo || !ibo) {
            throw new Error("@doki-land/live2d-renderer: buffer alloc failed");
        }
        this.#vao = vao;
        this.#vbo = vbo;
        this.#ibo = ibo;

        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bindVertexArray(null);
    }

    #ensureMaskTarget(width: number, height: number): void {
        const gl = this.#gl;
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        if (
            this.#maskFbo &&
            this.#maskTex &&
            this.#maskW === w &&
            this.#maskH === h
        ) {
            return;
        }
        if (this.#maskTex) gl.deleteTexture(this.#maskTex);
        if (this.#maskFbo) gl.deleteFramebuffer(this.#maskFbo);

        const tex = gl.createTexture();
        const fbo = gl.createFramebuffer();
        if (!tex || !fbo) {
            throw new Error(
                "@doki-land/live2d-renderer: mask framebuffer alloc failed",
            );
        }
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            w,
            h,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            tex,
            0,
        );
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            gl.deleteTexture(tex);
            gl.deleteFramebuffer(fbo);
            throw new Error(
                `@doki-land/live2d-renderer: incomplete mask FBO (${status})`,
            );
        }
        this.#maskTex = tex;
        this.#maskFbo = fbo;
        this.#maskW = w;
        this.#maskH = h;
    }

    #clearGpuTextures(): void {
        const gl = this.#gl;
        for (const t of this.#gpuTextures) {
            if (t) gl.deleteTexture(t);
        }
        this.#gpuTextures = [];
    }

    setTextures(textures: TextureData[]): void {
        const gl = this.#gl;
        this.#clearGpuTextures();
        let maxIndex = -1;
        for (const t of textures) maxIndex = Math.max(maxIndex, t.index);
        this.#gpuTextures = new Array(maxIndex + 1).fill(null);

        for (const t of textures) {
            const tex = gl.createTexture();
            if (!tex) continue;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_S,
                gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_T,
                gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                t.image,
            );
            this.#gpuTextures[t.index] = tex;
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    #uploadMesh(d: DrawableMesh): void {
        const gl = this.#gl;
        const interleaved = interleavePosUv(d.vertexPositions, d.uvs);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
        gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.indices, gl.DYNAMIC_DRAW);
    }

    #drawMeshColor(
        d: DrawableMesh,
        useMask: boolean,
        invertMask: boolean,
        layout: MaskLayoutRect | null,
        modelBounds: MaskLayoutRect | null,
        channelFlag: Float32Array | null,
    ): void {
        const gl = this.#gl;
        if (!d.visible || d.opacity <= 0) return;

        applyWebGl2BlendMode(gl, d.blendMode);
        this.#uploadMesh(d);

        const gpuTex = this.#gpuTextures[d.textureIndex] ?? null;
        const textured = gpuTex !== null;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, gpuTex);
        gl.uniform1i(this.#texLoc, 0);
        gl.uniform1f(this.#useTexLoc, textured ? 1 : 0);
        gl.uniform1f(this.#opacityLoc, d.opacity);
        gl.uniform4f(
            this.#colorLoc,
            PREVIEW_FILL.r,
            PREVIEW_FILL.g,
            PREVIEW_FILL.b,
            PREVIEW_FILL.a * d.opacity,
        );
        gl.uniform1f(this.#useMaskLoc, useMask ? 1 : 0);
        gl.uniform1f(this.#invertMaskLoc, invertMask ? 1 : 0);
        const layoutVec = maskLayoutVec4(
            layout ?? { x: 0, y: 0, width: 1, height: 1 },
        );
        gl.uniform4fv(this.#maskLayoutLoc, layoutVec);
        gl.uniform4fv(
            this.#maskBoundsLoc,
            maskLayoutVec4(
                modelBounds ?? { x: -1, y: -1, width: 2, height: 2 },
            ),
        );
        gl.uniform4fv(
            this.#channelFlagLoc,
            channelFlag ?? new Float32Array([0, 0, 0, 1]),
        );
        if (useMask && this.#maskTex) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.#maskTex);
            gl.uniform1i(this.#maskLoc, 1);
        }

        gl.drawElements(gl.TRIANGLES, d.indices.length, gl.UNSIGNED_SHORT, 0);

        if (!textured && !useMask) {
            const lines = triangleEdgesToLineList(d.indices);
            gl.uniform1f(this.#useTexLoc, 0);
            gl.uniform4f(
                this.#colorLoc,
                PREVIEW_STROKE.r,
                PREVIEW_STROKE.g,
                PREVIEW_STROKE.b,
                PREVIEW_STROKE.a * d.opacity,
            );
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.DYNAMIC_DRAW);
            gl.drawElements(gl.LINES, lines.length, gl.UNSIGNED_SHORT, 0);
        }
    }

    #drawMeshMask(
        d: DrawableMesh,
        layout: MaskLayoutRect,
        modelBounds: MaskLayoutRect,
        channelFlag: Float32Array,
    ): void {
        const gl = this.#gl;
        if (d.opacity <= 0) return;
        this.#uploadMesh(d);
        const gpuTex = this.#gpuTextures[d.textureIndex] ?? null;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, gpuTex);
        gl.uniform1i(this.#maskTexLoc, 0);
        gl.uniform1f(this.#maskUseTexLoc, gpuTex ? 1 : 0);
        gl.uniform1f(this.#maskOpacityLoc, Math.max(d.opacity, 1));
        gl.uniform4fv(this.#maskWriteLayoutLoc, maskLayoutVec4(layout));
        gl.uniform4fv(this.#maskWriteBoundsLoc, maskLayoutVec4(modelBounds));
        gl.uniform4fv(this.#maskWriteChannelLoc, channelFlag);
        gl.drawElements(gl.TRIANGLES, d.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    draw(drawables: DrawableMesh[], _modelMatrix: Float32Array): void {
        const gl = this.#gl;
        const canvas = gl.canvas;
        const width =
            canvas instanceof HTMLCanvasElement ? canvas.width : canvas.width;
        const height =
            canvas instanceof HTMLCanvasElement ? canvas.height : canvas.height;

        const byIndex = new Map<number, DrawableMesh>();
        for (const d of drawables) byIndex.set(d.index, d);

        const partitioned = partitionForClipping(drawables);
        const contexts = fitClippingContexts(partitioned.contexts, byIndex);
        const { maskOnly } = partitioned;

        gl.bindVertexArray(this.#vao);

        if (contexts.length > 0) {
            this.#ensureMaskTarget(width, height);
            const fbo = this.#maskFbo;
            if (fbo && this.#maskTex) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
                gl.viewport(0, 0, this.#maskW, this.#maskH);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.useProgram(this.#maskProgram);
                gl.enable(gl.BLEND);
                gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);

                for (const ctx of contexts) {
                    const flag = maskChannelVec4(ctx.channelFlag);
                    for (const mi of ctx.maskIndices) {
                        const maskMesh = byIndex.get(mi);
                        if (maskMesh) {
                            this.#drawMeshMask(
                                maskMesh,
                                ctx.layout,
                                ctx.modelBounds,
                                flag,
                            );
                        }
                    }
                }

                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, width, height);
            }
        }

        gl.useProgram(this.#program);
        const layoutByClippedIndex = new Map<
            number,
            Pick<
                LaidOutClippingContext,
                "layout" | "modelBounds" | "invertedMask" | "channelFlag"
            >
        >();
        for (const ctx of contexts) {
            for (const ci of ctx.clippedIndices) {
                layoutByClippedIndex.set(ci, {
                    layout: ctx.layout,
                    modelBounds: ctx.modelBounds,
                    invertedMask: ctx.invertedMask,
                    channelFlag: ctx.channelFlag,
                });
            }
        }

        for (const d of drawables) {
            if (maskOnly.has(d.index)) continue;
            const clip = layoutByClippedIndex.get(d.index);
            if (clip) {
                this.#drawMeshColor(
                    d,
                    true,
                    clip.invertedMask,
                    clip.layout,
                    clip.modelBounds,
                    maskChannelVec4(clip.channelFlag),
                );
            } else {
                this.#drawMeshColor(d, false, false, null, null, null);
            }
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindVertexArray(null);
    }

    destroy(): void {
        const gl = this.#gl;
        this.#clearGpuTextures();
        if (this.#maskTex) gl.deleteTexture(this.#maskTex);
        if (this.#maskFbo) gl.deleteFramebuffer(this.#maskFbo);
        gl.deleteBuffer(this.#vbo);
        gl.deleteBuffer(this.#ibo);
        gl.deleteVertexArray(this.#vao);
        gl.deleteProgram(this.#program);
        gl.deleteProgram(this.#maskProgram);
    }
}

export interface WebGl2RendererOptions {
    antialias?: boolean;
    alpha?: boolean;
}

/** WebGL2 renderer. */
export class WebGl2RendererImpl implements WebGl2Renderer {
    readonly kind = "webgl2" as const;

    #canvas: HTMLCanvasElement | null = null;
    #gl: WebGL2RenderingContext | null = null;
    readonly #options: WebGl2RendererOptions;

    constructor(options: WebGl2RendererOptions = {}) {
        this.#options = options;
    }

    async initialize(canvas: HTMLCanvasElement): Promise<void> {
        const gl = canvas.getContext("webgl2", {
            antialias: this.#options.antialias ?? true,
            alpha: this.#options.alpha ?? true,
            premultipliedAlpha: true,
            powerPreference: "high-performance",
        });
        if (!gl) {
            throw new Error(
                "@doki-land/live2d-renderer: WebGL2 is not available",
            );
        }
        this.#canvas = canvas;
        this.#gl = gl;
    }

    createModelDrawPass(): ModelDrawPass {
        if (!this.#gl) {
            throw new Error(
                "@doki-land/live2d-renderer: WebGL2 renderer not initialized",
            );
        }
        return new WebGl2ModelDrawPass(this.#gl);
    }

    beginFrame(): void {
        const gl = this.#gl;
        if (!gl || !this.#canvas) return;
        gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    endFrame(): void {}

    resize(width: number, height: number): void {
        if (!this.#canvas) return;
        this.#canvas.width = width;
        this.#canvas.height = height;
    }

    getGL(): WebGL2RenderingContext | null {
        return this.#gl;
    }

    destroy(): void {
        this.#gl = null;
        this.#canvas = null;
    }
}

export function createWebGl2Renderer(
    options?: WebGl2RendererOptions,
): WebGl2Renderer {
    return new WebGl2RendererImpl(options);
}

export function isWebGl2Available(): boolean {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return !!gl;
}
