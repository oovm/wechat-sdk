/**
 * Fetch model texture images via AssetResolver → TextureData for draw passes.
 */

import type { AssetResolver } from "@doki-land/live2d-core";
import type { TextureData } from "@doki-land/live2d-renderer";

export interface LoadTexturesOptions {
    onProgress?: (update: {
        index: number;
        total: number;
        key: string;
        bytesLoaded: number;
        bytesTotal: number | null;
    }) => void;
}

function guessMime(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    return "image/png";
}

async function bytesToImageBitmap(
    bytes: ArrayBuffer,
    path: string,
): Promise<ImageBitmap> {
    if (typeof createImageBitmap !== "function") {
        throw new Error(
            "@doki-land/live2d: createImageBitmap is not available in this environment",
        );
    }
    const blob = new Blob([new Uint8Array(bytes)], {
        type: guessMime(path),
    });
    return createImageBitmap(blob);
}

/** Load texture paths from a resolver into GPU-uploadable TextureData. */
export async function loadTextureData(
    resolver: AssetResolver,
    paths: readonly string[],
    options: LoadTexturesOptions = {},
): Promise<TextureData[]> {
    const out: TextureData[] = [];
    const total = paths.length;
    for (let i = 0; i < paths.length; i++) {
        const key = paths[i]!;
        options.onProgress?.({
            index: i,
            total,
            key,
            bytesLoaded: 0,
            bytesTotal: null,
        });
        const bytes = await resolver.fetchBytes(key);
        options.onProgress?.({
            index: i,
            total,
            key,
            bytesLoaded: bytes.byteLength,
            bytesTotal: bytes.byteLength,
        });
        const image = await bytesToImageBitmap(bytes, key);
        out.push({
            index: i,
            image,
            width: image.width,
            height: image.height,
        });
    }
    return out;
}

/** Close ImageBitmaps previously passed to setTextures. */
export function releaseTextureData(textures: readonly TextureData[]): void {
    for (const t of textures) {
        const img = t.image;
        if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
            img.close();
        }
    }
}
