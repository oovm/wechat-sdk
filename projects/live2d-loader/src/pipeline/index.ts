import type {
    AssetKey,
    AssetResolver,
    ExpressionDefinition,
    HitAreaDefinition,
    ModelFormat,
    ModelSettings,
    MotionDefinition,
} from "@doki-land/live2d-core";
import { detectModelSettingsFormat } from "@doki-land/live2d-core";
import {
    fetchArrayBufferWithProgress,
    fetchJsonWithProgress,
} from "../fetch/progress.js";

/** Resolve a relative asset URL against the model settings URL. */
export function resolveAssetUrl(baseUrl: string, relative: string): string {
    if (/^(?:[a-z]+:)?\/\//i.test(relative) || relative.startsWith("data:")) {
        return relative;
    }
    try {
        return new URL(relative, baseUrl).href;
    } catch {
        const slash = baseUrl.lastIndexOf("/");
        const dir = slash >= 0 ? baseUrl.slice(0, slash + 1) : "";
        return `${dir}${relative}`;
    }
}

export interface UrlAssetResolverOptions {
    onBytesProgress?: (
        key: AssetKey,
        update: { bytesLoaded: number; bytesTotal: number | null },
    ) => void;
}

export function createUrlAssetResolver(
    baseUrl: string,
    options: UrlAssetResolverOptions = {},
): AssetResolver {
    return {
        baseUrl,
        resolve(key: AssetKey) {
            return resolveAssetUrl(baseUrl, key);
        },
        async fetchJson(key: AssetKey) {
            const url = resolveAssetUrl(baseUrl, key);
            return fetchJsonWithProgress(url, (update) => {
                options.onBytesProgress?.(key, update);
            });
        },
        async fetchBytes(key: AssetKey) {
            const url = resolveAssetUrl(baseUrl, key);
            return fetchArrayBufferWithProgress(url, (update) => {
                options.onBytesProgress?.(key, update);
            });
        },
    };
}

export interface LoadPipelineContext {
    source: string;
    json?: unknown;
    format?: ModelFormat;
    settings?: ModelSettings;
}

export type LoadMiddleware = (
    ctx: LoadPipelineContext,
    next: () => Promise<void>,
) => Promise<void>;

export async function runLoadPipeline(
    ctx: LoadPipelineContext,
    middlewares: LoadMiddleware[],
): Promise<LoadPipelineContext> {
    let index = 0;
    const dispatch = async (): Promise<void> => {
        const mw = middlewares[index++];
        if (!mw) return;
        await mw(ctx, dispatch);
    };
    await dispatch();
    return ctx;
}

/** Fetch model settings JSON from a URL. */
export async function fetchModelJson(
    url: string,
    onProgress?: (update: {
        bytesLoaded: number;
        bytesTotal: number | null;
    }) => void,
): Promise<unknown> {
    return fetchJsonWithProgress(url, onProgress);
}

/** Detect moc2 vs moc3 from settings JSON shape (core helper; throws if unknown). */
export function detectModelFormat(json: unknown): ModelFormat {
    if (!json || typeof json !== "object") {
        throw new Error(
            "@doki-land/live2d-loader: model json must be an object",
        );
    }
    const format = detectModelSettingsFormat(json);
    if (!format) {
        throw new Error(
            "@doki-land/live2d-loader: unrecognized Live2D model json",
        );
    }
    return format;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
}

/** Normalize raw model3.json / model.json into ModelSettings. */
export function normalizeModelSettings(
    json: unknown,
    url: string,
): ModelSettings {
    const format = detectModelFormat(json);
    const o = json as Record<string, unknown>;

    if (format === "moc3") {
        const fileRefs = o.FileReferences as Record<string, unknown>;
        const moc = fileRefs.Moc as string;
        const textures = asStringArray(fileRefs.Textures);
        const motionGroups: Record<string, MotionDefinition[]> = {};
        const motions = fileRefs.Motions;
        if (motions && typeof motions === "object") {
            for (const [group, list] of Object.entries(
                motions as Record<string, unknown>,
            )) {
                if (!Array.isArray(list)) continue;
                motionGroups[group] = list
                    .map((item) => {
                        if (!item || typeof item !== "object") return null;
                        const file = (item as Record<string, unknown>).File;
                        if (typeof file !== "string") return null;
                        const def: MotionDefinition = { file };
                        const sound = (item as Record<string, unknown>).Sound;
                        if (typeof sound === "string") def.sound = sound;
                        const fadeIn = (item as Record<string, unknown>)
                            .FadeInTime;
                        if (typeof fadeIn === "number") def.fadeInTime = fadeIn;
                        const fadeOut = (item as Record<string, unknown>)
                            .FadeOutTime;
                        if (typeof fadeOut === "number")
                            def.fadeOutTime = fadeOut;
                        return def;
                    })
                    .filter((x): x is MotionDefinition => x !== null);
            }
        }
        const expressions: ExpressionDefinition[] = [];
        const expr = fileRefs.Expressions;
        if (Array.isArray(expr)) {
            for (const item of expr) {
                if (!item || typeof item !== "object") continue;
                const name = (item as Record<string, unknown>).Name;
                const file = (item as Record<string, unknown>).File;
                if (typeof name === "string" && typeof file === "string") {
                    expressions.push({ name, file });
                }
            }
        }
        const hitAreas: HitAreaDefinition[] = [];
        if (Array.isArray(o.HitAreas)) {
            for (const item of o.HitAreas) {
                if (!item || typeof item !== "object") continue;
                const name = (item as Record<string, unknown>).Name;
                const id = (item as Record<string, unknown>).Id;
                if (typeof name === "string" && typeof id === "string") {
                    hitAreas.push({ name, id });
                }
            }
        }
        return {
            format: "moc3",
            url,
            name: typeof o.Name === "string" ? o.Name : undefined,
            moc,
            textures,
            motionGroups,
            expressions,
            physics:
                typeof fileRefs.Physics === "string"
                    ? fileRefs.Physics
                    : undefined,
            pose: typeof fileRefs.Pose === "string" ? fileRefs.Pose : undefined,
            hitAreas,
        };
    }

    // moc2
    return {
        format: "moc2",
        url,
        moc: o.model as string,
        textures: asStringArray(o.textures),
        motionGroups: {},
        expressions: [],
        hitAreas: [],
    };
}
