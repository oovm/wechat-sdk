/**
 * Fetch helpers with optional byte-level progress.
 */

export type FetchProgressHandler = (update: {
    bytesLoaded: number;
    bytesTotal: number | null;
}) => void;

function safeProgress(
    onProgress: FetchProgressHandler | undefined,
    update: { bytesLoaded: number; bytesTotal: number | null },
): void {
    if (!onProgress) return;
    try {
        onProgress(update);
    } catch {
        // Progress UI must never abort the fetch.
    }
}

/**
 * Fetch bytes with progress. Uses `arrayBuffer()` when streaming is unavailable
 * or when Content-Length is known (avoids stuck ReadableStream readers in some
 * embedded Chromium hosts during rapid remounts).
 */
export async function fetchArrayBufferWithProgress(
    url: string,
    onProgress?: FetchProgressHandler,
): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(
            `@doki-land/live2d-loader: failed to fetch bytes (${res.status}): ${url}`,
        );
    }

    const totalHeader = res.headers.get("content-length");
    const bytesTotal = totalHeader ? Number(totalHeader) : null;
    const preferBuffer =
        !res.body ||
        !onProgress ||
        (bytesTotal !== null && Number.isFinite(bytesTotal) && bytesTotal >= 0);

    if (preferBuffer) {
        safeProgress(onProgress, { bytesLoaded: 0, bytesTotal });
        const buf = await res.arrayBuffer();
        safeProgress(onProgress, {
            bytesLoaded: buf.byteLength,
            bytesTotal: bytesTotal ?? buf.byteLength,
        });
        return buf;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytesLoaded = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            bytesLoaded += value.byteLength;
            safeProgress(onProgress, { bytesLoaded, bytesTotal });
        }
    }

    const out = new Uint8Array(bytesLoaded);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
    }
    safeProgress(onProgress, {
        bytesLoaded,
        bytesTotal: bytesTotal ?? bytesLoaded,
    });
    return out.buffer;
}

export async function fetchJsonWithProgress(
    url: string,
    onProgress?: FetchProgressHandler,
): Promise<unknown> {
    const bytes = await fetchArrayBufferWithProgress(url, onProgress);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as unknown;
}
