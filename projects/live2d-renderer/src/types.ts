/** Implemented renderer kinds. */
export type RendererKind = "webgpu" | "webgl2" | "canvas2d";

/** Blend modes for Live2D drawable compositing. */
export const BlendMode = {
    Normal: 0,
    Additive: 1,
    Multiplicative: 2,
} as const;

export type BlendMode = (typeof BlendMode)[keyof typeof BlendMode];

/** A single drawable mesh submitted to the GPU backend. */
export interface DrawableMesh {
    index: number;
    textureIndex: number;
    vertexPositions: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
    opacity: number;
    blendMode: BlendMode;
    invertedMask: boolean;
    renderOrder: number;
    dynamicFlag: boolean;
    maskIndices: number[];
    visible: boolean;
}

export interface TextureData {
    index: number;
    image: HTMLImageElement | ImageBitmap;
    width: number;
    height: number;
}

export interface ModelDrawPass {
    setTextures(textures: TextureData[]): void;

    draw(drawables: DrawableMesh[], modelMatrix: Float32Array): void;

    destroy(): void;
}

/** Top-level renderer bound to a canvas. */
export interface Renderer {
    readonly kind: RendererKind;

    initialize(canvas: HTMLCanvasElement): Promise<void>;

    createModelDrawPass(): ModelDrawPass;

    beginFrame(): void;

    endFrame(): void;

    resize(width: number, height: number): void;

    destroy(): void;
}

export interface WebGpuRenderer extends Renderer {
    readonly kind: "webgpu";

    getDevice(): GPUDevice | null;
}

export interface WebGl2Renderer extends Renderer {
    readonly kind: "webgl2";

    getGL(): WebGL2RenderingContext | null;
}
