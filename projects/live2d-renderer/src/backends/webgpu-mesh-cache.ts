/**
 * Per-drawable WebGPU buffer / bind-group cache.
 * Static index/uv topology stays resident; vertex positions + small UBOs use writeBuffer.
 */

import {
    interleaveByteLength,
    interleavePosUv,
} from "../render/mesh-interleave.js";

/** WebGPU INDEX buffers must be a multiple of 4 bytes. */
export function indexBufferByteSize(byteLength: number): number {
    return (byteLength + 3) & ~3;
}

export interface WebGpuMeshSlot {
    index: number;
    vbo: GPUBuffer;
    vboBytes: number;
    interleaved: Float32Array<ArrayBufferLike>;
    ibo: GPUBuffer;
    iboBytes: number;
    indicesRef: Uint16Array | null;
    uvsRef: Float32Array | null;
    /** Uniform buffer (max 80 bytes covers all shader variants). */
    ubo: GPUBuffer;
    uboFloats: Float32Array<ArrayBufferLike>;
    bgMask: GPUBindGroup | null;
    bgTextured: GPUBindGroup | null;
    bgClippedTextured: GPUBindGroup | null;
    bgSolid: GPUBindGroup | null;
    bgClippedSolid: GPUBindGroup | null;
    texIndex: number;
    useWhite: boolean;
    maskGeneration: number;
}

function createOrGrowBuffer(
    device: GPUDevice,
    prev: GPUBuffer | null,
    prevBytes: number,
    needBytes: number,
    usage: GPUBufferUsageFlags,
): { buffer: GPUBuffer; bytes: number } {
    const bytes = Math.max(4, needBytes);
    if (prev && prevBytes >= bytes) return { buffer: prev, bytes: prevBytes };
    prev?.destroy();
    return {
        buffer: device.createBuffer({
            size: bytes,
            usage,
        }),
        bytes,
    };
}

export class WebGpuMeshCache {
    readonly #slots = new Map<number, WebGpuMeshSlot>();
    #maskGeneration = 0;

    bumpMaskGeneration(): void {
        this.#maskGeneration += 1;
    }

    get maskGeneration(): number {
        return this.#maskGeneration;
    }

    clear(): void {
        for (const slot of this.#slots.values()) {
            slot.vbo.destroy();
            slot.ibo.destroy();
            slot.ubo.destroy();
        }
        this.#slots.clear();
    }

    /** Drop bind groups that reference model textures (after setTextures). */
    invalidateTextureBindGroups(): void {
        for (const slot of this.#slots.values()) {
            slot.bgMask = null;
            slot.bgTextured = null;
            slot.bgClippedTextured = null;
            slot.bgSolid = null;
            slot.bgClippedSolid = null;
            slot.texIndex = -1;
        }
    }

    ensureSlot(device: GPUDevice, drawableIndex: number): WebGpuMeshSlot {
        let slot = this.#slots.get(drawableIndex);
        if (slot) return slot;
        const vbo = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        const ibo = device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        const ubo = device.createBuffer({
            size: 80,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        slot = {
            index: drawableIndex,
            vbo,
            vboBytes: 64,
            interleaved: new Float32Array(16),
            ibo,
            iboBytes: 4,
            indicesRef: null,
            uvsRef: null,
            ubo,
            uboFloats: new Float32Array(20),
            bgMask: null,
            bgTextured: null,
            bgClippedTextured: null,
            bgSolid: null,
            bgClippedSolid: null,
            texIndex: -1,
            useWhite: false,
            maskGeneration: -1,
        };
        this.#slots.set(drawableIndex, slot);
        return slot;
    }

    /**
     * Upload interleaved pos/uv when positions change every frame; refresh
     * index buffer only when the `indices` TypedArray identity changes.
     */
    uploadMesh(
        device: GPUDevice,
        slot: WebGpuMeshSlot,
        positions: Float32Array,
        uvs: Float32Array,
        indices: Uint16Array,
    ): void {
        slot.interleaved = interleavePosUv(positions, uvs, slot.interleaved);
        const vBytes = interleaveByteLength(positions);
        const grownV = createOrGrowBuffer(
            device,
            slot.vbo,
            slot.vboBytes,
            vBytes,
            GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        );
        slot.vbo = grownV.buffer;
        slot.vboBytes = grownV.bytes;
        device.queue.writeBuffer(
            slot.vbo,
            0,
            slot.interleaved.buffer as ArrayBuffer,
            slot.interleaved.byteOffset,
            vBytes,
        );

        const iBytes = indexBufferByteSize(indices.byteLength);
        const grownI = createOrGrowBuffer(
            device,
            slot.ibo,
            slot.iboBytes,
            iBytes,
            GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        );
        if (grownI.buffer !== slot.ibo) {
            slot.indicesRef = null;
        }
        slot.ibo = grownI.buffer;
        slot.iboBytes = grownI.bytes;
        if (slot.indicesRef !== indices || slot.uvsRef !== uvs) {
            if (iBytes === indices.byteLength) {
                device.queue.writeBuffer(
                    slot.ibo,
                    0,
                    indices.buffer as ArrayBuffer,
                    indices.byteOffset,
                    indices.byteLength,
                );
            } else {
                const padded = new Uint16Array(iBytes / 2);
                padded.set(indices);
                device.queue.writeBuffer(slot.ibo, 0, padded);
            }
            slot.indicesRef = indices;
            slot.uvsRef = uvs;
        }
    }

    writeUbo(
        device: GPUDevice,
        slot: WebGpuMeshSlot,
        floats: ArrayLike<number>,
    ): void {
        const n = floats.length;
        for (let i = 0; i < n; i++) slot.uboFloats[i] = floats[i]!;
        device.queue.writeBuffer(
            slot.ubo,
            0,
            slot.uboFloats.buffer as ArrayBuffer,
            slot.uboFloats.byteOffset,
            Math.max(16, (n * 4 + 15) & ~15),
        );
    }
}
