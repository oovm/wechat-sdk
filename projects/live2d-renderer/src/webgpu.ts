/**
 * WebGPU renderer with soft clipping-mask support (parity with WebGL2).
 *
 * Frame flow: beginFrame creates an encoder; drawMeshes writes all mask
 * contexts into one atlas texture, then one color pass samples per-drawable
 * atlas layout; endFrame submits.
 */

import { webGpuBlendState } from "./blend.js";
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
    WebGpuRenderer,
} from "./types.js";
import { BlendMode } from "./types.js";

const SOLID_WGSL = /* wgsl */ `
struct Uniforms {
  color: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  return vec4f(pos, 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return u.color;
}
`;

const TEXTURED_WGSL = /* wgsl */ `
struct Uniforms {
  opacity: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VsOut {
  var o: VsOut;
  o.pos = vec4f(pos, 0.0, 1.0);
  o.uv = uv;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  let c = textureSample(tex, samp, input.uv);
  return vec4f(c.rgb, c.a * u.opacity);
}
`;

const SOLID_CLIPPED_WGSL = /* wgsl */ `
struct Uniforms {
  color: vec4f,
  invertMask: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
  layout: vec4f,
  channelFlag: vec4f,
  modelBounds: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var maskTex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) ndc: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f) -> VsOut {
  var o: VsOut;
  o.pos = vec4f(pos, 0.0, 1.0);
  o.ndc = pos;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  let local = (input.ndc - u.modelBounds.xy) / max(u.modelBounds.zw, vec2f(1e-6));
  let muv = u.layout.xy + local * u.layout.zw;
  var m = dot(textureSample(maskTex, samp, muv), u.channelFlag);
  if (u.invertMask > 0.5) {
    m = 1.0 - m;
  }
  return vec4f(u.color.rgb * m, u.color.a * m);
}
`;

const TEXTURED_CLIPPED_WGSL = /* wgsl */ `
struct Uniforms {
  opacity: f32,
  invertMask: f32,
  _pad0: f32,
  _pad1: f32,
  layout: vec4f,
  channelFlag: vec4f,
  modelBounds: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;
@group(0) @binding(3) var maskTex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) ndc: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VsOut {
  var o: VsOut;
  o.pos = vec4f(pos, 0.0, 1.0);
  o.uv = uv;
  o.ndc = pos;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  let c = textureSample(tex, samp, input.uv);
  let local = (input.ndc - u.modelBounds.xy) / max(u.modelBounds.zw, vec2f(1e-6));
  let muv = u.layout.xy + local * u.layout.zw;
  var m = dot(textureSample(maskTex, samp, muv), u.channelFlag);
  if (u.invertMask > 0.5) {
    m = 1.0 - m;
  }
  let a = c.a * u.opacity * m;
  return vec4f(c.rgb * m, a);
}
`;

const MASK_WRITE_WGSL = /* wgsl */ `
struct Uniforms {
  opacity: f32,
  useTexture: f32,
  _pad0: f32,
  _pad1: f32,
  layout: vec4f, // xy offset, zw size in 0..1
  channelFlag: vec4f,
  modelBounds: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VsOut {
  var o: VsOut;
  let local = (pos - u.modelBounds.xy) / max(u.modelBounds.zw, vec2f(1e-6));
  let atlasUv = u.layout.xy + local * u.layout.zw;
  o.pos = vec4f(atlasUv * 2.0 - vec2f(1.0, 1.0), 0.0, 1.0);
  o.uv = uv;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  var a = u.opacity;
  if (u.useTexture > 0.5) {
    a = a * textureSample(tex, samp, input.uv).a;
  }
  return u.channelFlag * a;
}
`;

interface WebGpuPipelineSet {
    fill: GPURenderPipeline;
    line: GPURenderPipeline;
    textured: GPURenderPipeline;
    clippedFill: GPURenderPipeline;
    clippedTextured: GPURenderPipeline;
}

const BLEND_MODES: BlendMode[] = [
    BlendMode.Normal,
    BlendMode.Additive,
    BlendMode.Multiplicative,
];

/** WebGPU INDEX buffers must be a multiple of 4 bytes. */
function indexBufferSize(byteLength: number): number {
    return (byteLength + 3) & ~3;
}

function writeIndexBuffer(device: GPUDevice, indices: Uint16Array): GPUBuffer {
    const size = indexBufferSize(indices.byteLength);
    const ibo = device.createBuffer({
        size: Math.max(4, size),
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Uint16Array(ibo.getMappedRange()).set(indices);
    ibo.unmap();
    return ibo;
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

/** 1x1 white texture used when a mask mesh has no model texture. */
function createWhiteTexture(device: GPUDevice): GPUTexture {
    const tex = device.createTexture({
        size: [1, 1],
        format: "rgba8unorm",
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.writeTexture(
        { texture: tex },
        new Uint8Array([255, 255, 255, 255]),
        { bytesPerRow: 4 },
        [1, 1],
    );
    return tex;
}

class WebGpuModelDrawPass implements ModelDrawPass {
    readonly #renderer: WebGpuRendererImpl;

    constructor(renderer: WebGpuRendererImpl) {
        this.#renderer = renderer;
    }

    setTextures(textures: TextureData[]): void {
        this.#renderer.setTextures(textures);
    }

    draw(drawables: DrawableMesh[], _modelMatrix: Float32Array): void {
        this.#renderer.drawMeshes(drawables);
    }

    destroy(): void {
        this.#renderer.setTextures([]);
    }
}

export interface WebGpuRendererOptions {
    /** Prefer high-performance adapter when available. */
    powerPreference?: GPUPowerPreference;
}

/** WebGPU renderer. */
export class WebGpuRendererImpl implements WebGpuRenderer {
    readonly kind = "webgpu" as const;

    #canvas: HTMLCanvasElement | null = null;
    #device: GPUDevice | null = null;
    #context: GPUCanvasContext | null = null;
    #format: GPUTextureFormat | null = null;
    #pipelines: (WebGpuPipelineSet | null)[] = [null, null, null];
    #solidBindGroupLayout: GPUBindGroupLayout | null = null;
    #texturedBindGroupLayout: GPUBindGroupLayout | null = null;
    #clippedSolidBindGroupLayout: GPUBindGroupLayout | null = null;
    #clippedTexturedBindGroupLayout: GPUBindGroupLayout | null = null;
    #maskWriteBindGroupLayout: GPUBindGroupLayout | null = null;
    #maskWritePipeline: GPURenderPipeline | null = null;
    #sampler: GPUSampler | null = null;
    #encoder: GPUCommandEncoder | null = null;
    #pass: GPURenderPassEncoder | null = null;
    #swapView: GPUTextureView | null = null;
    #pendingClear = false;
    #msaaTexture: GPUTexture | null = null;
    #msaaW = 0;
    #msaaH = 0;
    #sampleCount = 4;
    #maskTexture: GPUTexture | null = null;
    #maskW = 0;
    #maskH = 0;
    #whiteTexture: GPUTexture | null = null;
    #transient: GPUBuffer[] = [];
    #gpuTextures: (GPUTexture | null)[] = [];
    readonly #options: WebGpuRendererOptions;

    constructor(options: WebGpuRendererOptions = {}) {
        this.#options = options;
    }

    async initialize(canvas: HTMLCanvasElement): Promise<void> {
        if (!navigator.gpu) {
            throw new Error(
                "@doki-land/live2d-renderer: WebGPU is not available",
            );
        }
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference:
                this.#options.powerPreference ?? "high-performance",
        });
        if (!adapter) {
            throw new Error("@doki-land/live2d-renderer: no WebGPU adapter");
        }
        const device = await adapter.requestDevice();
        const context = canvas.getContext("webgpu");
        if (!context) {
            throw new Error(
                "@doki-land/live2d-renderer: failed to get webgpu context",
            );
        }
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
            device,
            format,
            alphaMode: "premultiplied",
        });

        const solidModule = device.createShaderModule({ code: SOLID_WGSL });
        const texturedModule = device.createShaderModule({
            code: TEXTURED_WGSL,
        });
        const solidClippedModule = device.createShaderModule({
            code: SOLID_CLIPPED_WGSL,
        });
        const texturedClippedModule = device.createShaderModule({
            code: TEXTURED_CLIPPED_WGSL,
        });
        const maskWriteModule = device.createShaderModule({
            code: MASK_WRITE_WGSL,
        });

        const solidBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });
        const texturedBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float" },
                },
            ],
        });
        const clippedSolidBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float" },
                },
            ],
        });
        const clippedTexturedBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float" },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float" },
                },
            ],
        });
        const maskWriteBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "float" },
                },
            ],
        });

        const solidLayout = device.createPipelineLayout({
            bindGroupLayouts: [solidBindGroupLayout],
        });
        const texturedLayout = device.createPipelineLayout({
            bindGroupLayouts: [texturedBindGroupLayout],
        });
        const clippedSolidLayout = device.createPipelineLayout({
            bindGroupLayouts: [clippedSolidBindGroupLayout],
        });
        const clippedTexturedLayout = device.createPipelineLayout({
            bindGroupLayouts: [clippedTexturedBindGroupLayout],
        });
        const maskWriteLayout = device.createPipelineLayout({
            bindGroupLayouts: [maskWriteBindGroupLayout],
        });

        const solidVertex: GPUVertexState = {
            module: solidModule,
            entryPoint: "vs_main",
            buffers: [
                {
                    arrayStride: 8,
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: "float32x2",
                        },
                    ],
                },
            ],
        };
        const texturedVertex: GPUVertexState = {
            module: texturedModule,
            entryPoint: "vs_main",
            buffers: [
                {
                    arrayStride: 16,
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: "float32x2",
                        },
                        {
                            shaderLocation: 1,
                            offset: 8,
                            format: "float32x2",
                        },
                    ],
                },
            ],
        };
        const solidClippedVertex: GPUVertexState = {
            module: solidClippedModule,
            entryPoint: "vs_main",
            buffers: [
                {
                    arrayStride: 8,
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: "float32x2",
                        },
                    ],
                },
            ],
        };
        const texturedClippedVertex: GPUVertexState = {
            module: texturedClippedModule,
            entryPoint: "vs_main",
            buffers: [
                {
                    arrayStride: 16,
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: "float32x2",
                        },
                        {
                            shaderLocation: 1,
                            offset: 8,
                            format: "float32x2",
                        },
                    ],
                },
            ],
        };
        const maskWriteVertex: GPUVertexState = {
            module: maskWriteModule,
            entryPoint: "vs_main",
            buffers: [
                {
                    arrayStride: 16,
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: "float32x2",
                        },
                        {
                            shaderLocation: 1,
                            offset: 8,
                            format: "float32x2",
                        },
                    ],
                },
            ],
        };

        const maskAccumulateBlend: GPUBlendState = {
            color: {
                srcFactor: "one",
                dstFactor: "one",
                operation: "add",
            },
            alpha: {
                srcFactor: "one",
                dstFactor: "one",
                operation: "add",
            },
        };

        const makeSet = (
            sampleCount: number,
            mode: BlendMode,
        ): WebGpuPipelineSet => {
            const blend = webGpuBlendState(mode);
            const multisample: GPUMultisampleState = { count: sampleCount };
            return {
                fill: device.createRenderPipeline({
                    layout: solidLayout,
                    vertex: solidVertex,
                    fragment: {
                        module: solidModule,
                        entryPoint: "fs_main",
                        targets: [{ format, blend }],
                    },
                    primitive: { topology: "triangle-list" },
                    multisample,
                }),
                line: device.createRenderPipeline({
                    layout: solidLayout,
                    vertex: solidVertex,
                    fragment: {
                        module: solidModule,
                        entryPoint: "fs_main",
                        targets: [{ format, blend }],
                    },
                    primitive: { topology: "line-list" },
                    multisample,
                }),
                textured: device.createRenderPipeline({
                    layout: texturedLayout,
                    vertex: texturedVertex,
                    fragment: {
                        module: texturedModule,
                        entryPoint: "fs_main",
                        targets: [{ format, blend }],
                    },
                    primitive: { topology: "triangle-list" },
                    multisample,
                }),
                clippedFill: device.createRenderPipeline({
                    layout: clippedSolidLayout,
                    vertex: solidClippedVertex,
                    fragment: {
                        module: solidClippedModule,
                        entryPoint: "fs_main",
                        targets: [{ format, blend }],
                    },
                    primitive: { topology: "triangle-list" },
                    multisample,
                }),
                clippedTextured: device.createRenderPipeline({
                    layout: clippedTexturedLayout,
                    vertex: texturedClippedVertex,
                    fragment: {
                        module: texturedClippedModule,
                        entryPoint: "fs_main",
                        targets: [{ format, blend }],
                    },
                    primitive: { topology: "triangle-list" },
                    multisample,
                }),
            };
        };

        let sampleCount = 4;
        let pipelines: WebGpuPipelineSet[];
        let maskWritePipeline: GPURenderPipeline;
        try {
            pipelines = BLEND_MODES.map((mode) => makeSet(sampleCount, mode));
            maskWritePipeline = device.createRenderPipeline({
                layout: maskWriteLayout,
                vertex: maskWriteVertex,
                fragment: {
                    module: maskWriteModule,
                    entryPoint: "fs_main",
                    targets: [
                        { format: "rgba8unorm", blend: maskAccumulateBlend },
                    ],
                },
                primitive: { topology: "triangle-list" },
                multisample: { count: 1 },
            });
        } catch {
            sampleCount = 1;
            pipelines = BLEND_MODES.map((mode) => makeSet(sampleCount, mode));
            maskWritePipeline = device.createRenderPipeline({
                layout: maskWriteLayout,
                vertex: maskWriteVertex,
                fragment: {
                    module: maskWriteModule,
                    entryPoint: "fs_main",
                    targets: [
                        { format: "rgba8unorm", blend: maskAccumulateBlend },
                    ],
                },
                primitive: { topology: "triangle-list" },
                multisample: { count: 1 },
            });
        }

        this.#sampleCount = sampleCount;
        this.#canvas = canvas;
        this.#device = device;
        this.#context = context;
        this.#format = format;
        this.#pipelines = pipelines;
        this.#solidBindGroupLayout = solidBindGroupLayout;
        this.#texturedBindGroupLayout = texturedBindGroupLayout;
        this.#clippedSolidBindGroupLayout = clippedSolidBindGroupLayout;
        this.#clippedTexturedBindGroupLayout = clippedTexturedBindGroupLayout;
        this.#maskWriteBindGroupLayout = maskWriteBindGroupLayout;
        this.#maskWritePipeline = maskWritePipeline;
        this.#sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });
        this.#whiteTexture = createWhiteTexture(device);
        this.#ensureMsaa();
    }

    #ensureMsaa(): void {
        const device = this.#device;
        const canvas = this.#canvas;
        const format = this.#format;
        if (!device || !canvas || !format) return;
        const w = Math.max(1, canvas.width);
        const h = Math.max(1, canvas.height);
        if (this.#msaaTexture && this.#msaaW === w && this.#msaaH === h) {
            return;
        }
        this.#msaaTexture?.destroy();
        this.#msaaTexture = device.createTexture({
            size: [w, h],
            sampleCount: this.#sampleCount,
            format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.#msaaW = w;
        this.#msaaH = h;
    }

    #ensureMaskTexture(width: number, height: number): GPUTexture | null {
        const device = this.#device;
        if (!device) return null;
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        if (this.#maskTexture && this.#maskW === w && this.#maskH === h) {
            return this.#maskTexture;
        }
        this.#maskTexture?.destroy();
        this.#maskTexture = device.createTexture({
            size: [w, h],
            format: "rgba8unorm",
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });
        this.#maskW = w;
        this.#maskH = h;
        return this.#maskTexture;
    }

    #clearGpuTextures(): void {
        for (const t of this.#gpuTextures) t?.destroy();
        this.#gpuTextures = [];
    }

    setTextures(textures: TextureData[]): void {
        const device = this.#device;
        this.#clearGpuTextures();
        if (!device) return;

        let maxIndex = -1;
        for (const t of textures) maxIndex = Math.max(maxIndex, t.index);
        this.#gpuTextures = new Array(Math.max(0, maxIndex + 1)).fill(null);

        for (const t of textures) {
            const gpuTex = device.createTexture({
                size: [t.width, t.height],
                format: "rgba8unorm",
                usage:
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture(
                { source: t.image },
                { texture: gpuTex },
                [t.width, t.height],
            );
            this.#gpuTextures[t.index] = gpuTex;
        }
    }

    createModelDrawPass(): ModelDrawPass {
        if (!this.#device || !this.#pipelines[BlendMode.Normal]) {
            throw new Error(
                "@doki-land/live2d-renderer: WebGPU renderer not initialized",
            );
        }
        return new WebGpuModelDrawPass(this);
    }

    beginFrame(): void {
        const device = this.#device;
        const context = this.#context;
        if (!device || !context) return;

        this.#ensureMsaa();
        this.#encoder = device.createCommandEncoder();
        this.#swapView = context.getCurrentTexture().createView();
        this.#pass = null;
        this.#pendingClear = true;
    }

    #endColorPass(): void {
        if (this.#pass) {
            this.#pass.end();
            this.#pass = null;
        }
    }

    #beginColorPass(): GPURenderPassEncoder | null {
        const encoder = this.#encoder;
        const msaa = this.#msaaTexture;
        const swapView = this.#swapView;
        if (!encoder || !swapView) return null;
        if (this.#pass) return this.#pass;

        const loadOp: GPULoadOp = this.#pendingClear ? "clear" : "load";
        this.#pendingClear = false;
        const useMsaa = this.#sampleCount > 1 && msaa !== null;

        this.#pass = encoder.beginRenderPass({
            colorAttachments: [
                useMsaa
                    ? {
                          view: msaa?.createView(),
                          resolveTarget: swapView,
                          clearValue: { r: 0, g: 0, b: 0, a: 0 },
                          loadOp,
                          storeOp: "discard",
                      }
                    : {
                          view: swapView,
                          clearValue: { r: 0, g: 0, b: 0, a: 0 },
                          loadOp,
                          storeOp: "store",
                      },
            ],
        });
        return this.#pass;
    }

    drawMeshes(drawables: DrawableMesh[]): void {
        const device = this.#device;
        const encoder = this.#encoder;
        const canvas = this.#canvas;
        const sampler = this.#sampler;
        const solidLayout = this.#solidBindGroupLayout;
        const texturedLayout = this.#texturedBindGroupLayout;
        const clippedSolidLayout = this.#clippedSolidBindGroupLayout;
        const clippedTexturedLayout = this.#clippedTexturedBindGroupLayout;
        const maskWriteLayout = this.#maskWriteBindGroupLayout;
        const maskWritePipeline = this.#maskWritePipeline;
        const whiteTex = this.#whiteTexture;
        if (
            !device ||
            !encoder ||
            !canvas ||
            !sampler ||
            !solidLayout ||
            !texturedLayout ||
            !clippedSolidLayout ||
            !clippedTexturedLayout ||
            !maskWriteLayout ||
            !maskWritePipeline ||
            !whiteTex
        ) {
            return;
        }

        const byIndex = new Map<number, DrawableMesh>();
        for (const d of drawables) byIndex.set(d.index, d);

        const partitioned = partitionForClipping(drawables);
        const contexts = fitClippingContexts(partitioned.contexts, byIndex);
        const { maskOnly } = partitioned;

        let maskTex: GPUTexture | null = null;
        if (contexts.length > 0) {
            maskTex = this.#ensureMaskTexture(canvas.width, canvas.height);
            if (maskTex) {
                const maskPass = encoder.beginRenderPass({
                    colorAttachments: [
                        {
                            view: maskTex.createView(),
                            clearValue: { r: 0, g: 0, b: 0, a: 0 },
                            loadOp: "clear",
                            storeOp: "store",
                        },
                    ],
                });
                maskPass.setPipeline(maskWritePipeline);
                for (const ctx of contexts) {
                    for (const mi of ctx.maskIndices) {
                        const maskMesh = byIndex.get(mi);
                        if (maskMesh) {
                            this.#drawMaskMesh(
                                maskMesh,
                                maskPass,
                                maskWriteLayout,
                                sampler,
                                whiteTex,
                                ctx.layout,
                                ctx.modelBounds,
                                ctx.channelFlag,
                            );
                        }
                    }
                }
                maskPass.end();
            }
        }

        const colorPass = this.#beginColorPass();
        if (!colorPass) return;

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
            if (clip && maskTex) {
                this.#drawColorMesh(
                    d,
                    colorPass,
                    true,
                    clip.invertedMask,
                    maskTex,
                    clip.layout,
                    clip.channelFlag,
                    clip.modelBounds,
                );
            } else {
                this.#drawColorMesh(d, colorPass, false, false);
            }
        }
    }

    #drawMaskMesh(
        d: DrawableMesh,
        pass: GPURenderPassEncoder,
        layout: GPUBindGroupLayout,
        sampler: GPUSampler,
        whiteTex: GPUTexture,
        atlasLayout: MaskLayoutRect,
        modelBounds: MaskLayoutRect,
        channelFlag: LaidOutClippingContext["channelFlag"],
    ): void {
        const device = this.#device;
        if (!device || d.opacity <= 0) return;

        const interleaved = interleavePosUv(d.vertexPositions, d.uvs);
        const vbo = device.createBuffer({
            size: interleaved.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(vbo.getMappedRange()).set(interleaved);
        vbo.unmap();

        const gpuTex = this.#gpuTextures[d.textureIndex] ?? whiteTex;
        const ubo = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        const layoutVec = maskLayoutVec4(atlasLayout);
        const ch = maskChannelVec4(channelFlag);
        const boundsVec = maskLayoutVec4(modelBounds);
        new Float32Array(ubo.getMappedRange()).set([
            Math.max(d.opacity, 1),
            this.#gpuTextures[d.textureIndex] ? 1 : 0,
            0,
            0,
            layoutVec[0]!,
            layoutVec[1]!,
            layoutVec[2]!,
            layoutVec[3]!,
            ch[0]!,
            ch[1]!,
            ch[2]!,
            ch[3]!,
            boundsVec[0]!,
            boundsVec[1]!,
            boundsVec[2]!,
            boundsVec[3]!,
        ]);
        ubo.unmap();

        const ibo = writeIndexBuffer(device, d.indices);
        pass.setBindGroup(
            0,
            device.createBindGroup({
                layout,
                entries: [
                    { binding: 0, resource: { buffer: ubo } },
                    { binding: 1, resource: sampler },
                    { binding: 2, resource: gpuTex.createView() },
                ],
            }),
        );
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(ibo, "uint16");
        pass.drawIndexed(d.indices.length);
        this.#transient.push(vbo, ubo, ibo);
    }

    #drawColorMesh(
        d: DrawableMesh,
        pass: GPURenderPassEncoder,
        useMask: boolean,
        invertMask: boolean,
        maskTex?: GPUTexture,
        atlasLayout?: MaskLayoutRect,
        channelFlag?: LaidOutClippingContext["channelFlag"],
        modelBounds?: MaskLayoutRect,
    ): void {
        const device = this.#device;
        const sampler = this.#sampler;
        const solidLayout = this.#solidBindGroupLayout;
        const texturedLayout = this.#texturedBindGroupLayout;
        const clippedSolidLayout = this.#clippedSolidBindGroupLayout;
        const clippedTexturedLayout = this.#clippedTexturedBindGroupLayout;
        if (
            !device ||
            !sampler ||
            !solidLayout ||
            !texturedLayout ||
            !clippedSolidLayout ||
            !clippedTexturedLayout
        ) {
            return;
        }
        if (!d.visible || d.opacity <= 0) return;

        const set =
            this.#pipelines[d.blendMode] ?? this.#pipelines[BlendMode.Normal];
        if (!set) return;

        const layoutVec = maskLayoutVec4(
            atlasLayout ?? { x: 0, y: 0, width: 1, height: 1 },
        );
        const ch = maskChannelVec4(channelFlag ?? [0, 0, 0, 1]);
        const boundsVec = maskLayoutVec4(
            modelBounds ?? { x: -1, y: -1, width: 2, height: 2 },
        );

        const gpuTex = this.#gpuTextures[d.textureIndex] ?? null;
        if (gpuTex) {
            const interleaved = interleavePosUv(d.vertexPositions, d.uvs);
            const vbo = device.createBuffer({
                size: interleaved.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Float32Array(vbo.getMappedRange()).set(interleaved);
            vbo.unmap();

            const uboSize = useMask && maskTex ? 64 : 16;
            const ubo = device.createBuffer({
                size: uboSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            if (useMask && maskTex) {
                new Float32Array(ubo.getMappedRange()).set([
                    d.opacity,
                    invertMask ? 1 : 0,
                    0,
                    0,
                    layoutVec[0]!,
                    layoutVec[1]!,
                    layoutVec[2]!,
                    layoutVec[3]!,
                    ch[0]!,
                    ch[1]!,
                    ch[2]!,
                    ch[3]!,
                    boundsVec[0]!,
                    boundsVec[1]!,
                    boundsVec[2]!,
                    boundsVec[3]!,
                ]);
            } else {
                new Float32Array(ubo.getMappedRange()).set([
                    d.opacity,
                    0,
                    0,
                    0,
                ]);
            }
            ubo.unmap();

            const ibo = writeIndexBuffer(device, d.indices);
            if (useMask && maskTex) {
                pass.setPipeline(set.clippedTextured);
                pass.setBindGroup(
                    0,
                    device.createBindGroup({
                        layout: clippedTexturedLayout,
                        entries: [
                            { binding: 0, resource: { buffer: ubo } },
                            { binding: 1, resource: sampler },
                            { binding: 2, resource: gpuTex.createView() },
                            { binding: 3, resource: maskTex.createView() },
                        ],
                    }),
                );
            } else {
                pass.setPipeline(set.textured);
                pass.setBindGroup(
                    0,
                    device.createBindGroup({
                        layout: texturedLayout,
                        entries: [
                            { binding: 0, resource: { buffer: ubo } },
                            { binding: 1, resource: sampler },
                            { binding: 2, resource: gpuTex.createView() },
                        ],
                    }),
                );
            }
            pass.setVertexBuffer(0, vbo);
            pass.setIndexBuffer(ibo, "uint16");
            pass.drawIndexed(d.indices.length);
            this.#transient.push(vbo, ubo, ibo);
            return;
        }

        const vbo = device.createBuffer({
            size: d.vertexPositions.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(vbo.getMappedRange()).set(d.vertexPositions);
        vbo.unmap();

        if (useMask && maskTex) {
            const ubo = device.createBuffer({
                size: 80,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Float32Array(ubo.getMappedRange()).set([
                PREVIEW_FILL.r,
                PREVIEW_FILL.g,
                PREVIEW_FILL.b,
                PREVIEW_FILL.a * d.opacity,
                invertMask ? 1 : 0,
                0,
                0,
                0,
                layoutVec[0]!,
                layoutVec[1]!,
                layoutVec[2]!,
                layoutVec[3]!,
                ch[0]!,
                ch[1]!,
                ch[2]!,
                ch[3]!,
                boundsVec[0]!,
                boundsVec[1]!,
                boundsVec[2]!,
                boundsVec[3]!,
            ]);
            ubo.unmap();
            const ibo = writeIndexBuffer(device, d.indices);
            pass.setPipeline(set.clippedFill);
            pass.setBindGroup(
                0,
                device.createBindGroup({
                    layout: clippedSolidLayout,
                    entries: [
                        { binding: 0, resource: { buffer: ubo } },
                        { binding: 1, resource: sampler },
                        { binding: 2, resource: maskTex.createView() },
                    ],
                }),
            );
            pass.setVertexBuffer(0, vbo);
            pass.setIndexBuffer(ibo, "uint16");
            pass.drawIndexed(d.indices.length);
            this.#transient.push(vbo, ubo, ibo);
            return;
        }

        const fillUbo = this.#makeColorUbo(
            device,
            PREVIEW_FILL.r,
            PREVIEW_FILL.g,
            PREVIEW_FILL.b,
            PREVIEW_FILL.a * d.opacity,
        );
        const fillIbo = writeIndexBuffer(device, d.indices);
        pass.setPipeline(set.fill);
        pass.setBindGroup(
            0,
            device.createBindGroup({
                layout: solidLayout,
                entries: [{ binding: 0, resource: { buffer: fillUbo } }],
            }),
        );
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(fillIbo, "uint16");
        pass.drawIndexed(d.indices.length);

        const lines = triangleEdgesToLineList(d.indices);
        const lineUbo = this.#makeColorUbo(
            device,
            PREVIEW_STROKE.r,
            PREVIEW_STROKE.g,
            PREVIEW_STROKE.b,
            PREVIEW_STROKE.a * d.opacity,
        );
        const lineIbo = writeIndexBuffer(device, lines);
        pass.setPipeline(set.line);
        pass.setBindGroup(
            0,
            device.createBindGroup({
                layout: solidLayout,
                entries: [{ binding: 0, resource: { buffer: lineUbo } }],
            }),
        );
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(lineIbo, "uint16");
        pass.drawIndexed(lines.length);
        this.#transient.push(vbo, fillUbo, fillIbo, lineUbo, lineIbo);
    }

    #makeColorUbo(
        device: GPUDevice,
        r: number,
        g: number,
        b: number,
        a: number,
    ): GPUBuffer {
        const ubo = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(ubo.getMappedRange()).set([r, g, b, a]);
        ubo.unmap();
        return ubo;
    }

    endFrame(): void {
        const device = this.#device;
        const encoder = this.#encoder;
        if (!device || !encoder) return;

        // Empty frame still clears once.
        if (this.#pendingClear && !this.#pass) {
            this.#beginColorPass();
        }
        this.#endColorPass();

        const buffers = this.#transient.splice(0);
        device.queue.submit([encoder.finish()]);
        for (const b of buffers) b.destroy();
        this.#encoder = null;
        this.#swapView = null;
        this.#pendingClear = false;
    }

    resize(width: number, height: number): void {
        if (!this.#canvas) return;
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#ensureMsaa();
    }

    getDevice(): GPUDevice | null {
        return this.#device;
    }

    destroy(): void {
        for (const b of this.#transient) b.destroy();
        this.#transient = [];
        this.#clearGpuTextures();
        this.#msaaTexture?.destroy();
        this.#msaaTexture = null;
        this.#maskTexture?.destroy();
        this.#maskTexture = null;
        this.#whiteTexture?.destroy();
        this.#whiteTexture = null;
        this.#device?.destroy();
        this.#device = null;
        this.#context = null;
        this.#format = null;
        this.#pipelines = [null, null, null];
        this.#solidBindGroupLayout = null;
        this.#texturedBindGroupLayout = null;
        this.#clippedSolidBindGroupLayout = null;
        this.#clippedTexturedBindGroupLayout = null;
        this.#maskWriteBindGroupLayout = null;
        this.#maskWritePipeline = null;
        this.#sampler = null;
        this.#encoder = null;
        this.#pass = null;
        this.#swapView = null;
        this.#canvas = null;
    }
}

export function createWebGpuRenderer(
    options?: WebGpuRendererOptions,
): WebGpuRenderer {
    return new WebGpuRendererImpl(options);
}

export function isWebGpuAvailable(): boolean {
    return typeof navigator !== "undefined" && !!navigator.gpu;
}
