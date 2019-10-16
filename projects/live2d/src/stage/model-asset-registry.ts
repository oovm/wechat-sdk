import type {
    AssetResolver,
    InternalModel,
    Live2dStageAssets,
    LoadProgress,
    ModelAsset,
    ModelSettings,
    ModelSource,
} from "@doki-land/live2d-core";
import { modelSourceUrl } from "@doki-land/live2d-core";
import {
    createUrlAssetResolver,
    fetchModelJson,
    normalizeModelSettings,
    resolveModelSourceUrl,
} from "@doki-land/live2d-loader";
import type {
    ModelBackend,
    Renderer,
    TextureData,
} from "@doki-land/live2d-renderer";
import {
    compileSharedModelCompile,
    selectModelBackend,
} from "@doki-land/live2d-renderer";
import type { Motion3Clip } from "../motion/index.js";
import { loadTextureData, releaseTextureData } from "./assets/load-textures.js";
import { resolveModelAssetKey } from "./model-asset-key.js";

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}

/** @internal */
export class ModelAssetHandle implements ModelAsset {
    readonly #entry: SharedModelAssetEntry;

    constructor(entry: SharedModelAssetEntry) {
        this.#entry = entry;
    }

    get key(): string {
        return this.#entry.key;
    }

    get settings(): ModelSettings {
        return this.#entry.settings;
    }

    /** @internal */
    get entry(): SharedModelAssetEntry {
        return this.#entry;
    }
}

/** @internal */
export interface SharedModelAssetEntry {
    readonly key: string;
    readonly settings: ModelSettings;
    readonly backend: ModelBackend;
    readonly resolver: AssetResolver;
    readonly sharedCompile: ReturnType<typeof compileSharedModelCompile>;
    readonly textures: TextureData[];
    readonly motionCache: Map<string, Motion3Clip>;
    refCount: number;
}

/** Lease held by one actor slot while a model is attached. */
export interface ModelAssetLease {
    readonly asset: ModelAssetHandle;
    readonly motionCache: Map<string, Motion3Clip>;
    readonly resolver: AssetResolver;
    readonly textures: readonly TextureData[];
    createInstance(renderer: Renderer): Promise<{
        model: InternalModel;
        backend: ModelBackend;
    }>;
    release(): void;
}

export interface ModelAssetRegistryOptions {
    backends: readonly ModelBackend[];
}

export class ModelAssetRegistry implements Live2dStageAssets {
    readonly #backends: readonly ModelBackend[];
    readonly #entries = new Map<string, SharedModelAssetEntry>();
    readonly #inFlight = new Map<string, Promise<SharedModelAssetEntry>>();

    constructor(options: ModelAssetRegistryOptions) {
        this.#backends = options.backends;
    }

    async load(
        source: ModelSource,
        resolver?: AssetResolver,
    ): Promise<ModelAsset> {
        const entry = await this.#ensureEntry(source, resolver);
        return new ModelAssetHandle(entry);
    }

    async acquire(
        source: ModelSource,
        resolver: AssetResolver | undefined,
        onProgress?: (payload: LoadProgress) => void,
    ): Promise<ModelAssetLease> {
        const entry = await this.#ensureEntry(source, resolver, onProgress);
        entry.refCount += 1;
        return this.#leaseFromEntry(entry);
    }

    acquireExisting(asset: ModelAsset): ModelAssetLease {
        const handle = asset as ModelAssetHandle;
        const entry = handle.entry;
        if (
            !this.#entries.has(entry.key) ||
            this.#entries.get(entry.key) !== entry
        ) {
            throw new Error(
                "@doki-land/live2d: ModelAsset does not belong to this stage",
            );
        }
        entry.refCount += 1;
        return this.#leaseFromEntry(entry);
    }

    destroy(): void {
        this.#inFlight.clear();
        for (const entry of this.#entries.values()) {
            releaseTextureData(entry.textures);
            entry.motionCache.clear();
        }
        this.#entries.clear();
    }

    #leaseFromEntry(entry: SharedModelAssetEntry): ModelAssetLease {
        let released = false;
        return {
            asset: new ModelAssetHandle(entry),
            motionCache: entry.motionCache,
            resolver: entry.resolver,
            textures: entry.textures,
            createInstance: async (renderer) => {
                const model = await entry.backend.createModel(entry.settings, {
                    renderer,
                    resolver: entry.resolver,
                    sharedCompile: entry.sharedCompile,
                });
                return { model, backend: entry.backend };
            },
            release: () => {
                if (released) return;
                released = true;
                entry.refCount = Math.max(0, entry.refCount - 1);
                if (entry.refCount === 0) {
                    releaseTextureData(entry.textures);
                    entry.textures.length = 0;
                    entry.motionCache.clear();
                    this.#entries.delete(entry.key);
                }
            },
        };
    }

    async #ensureEntry(
        source: ModelSource,
        resolver?: AssetResolver,
        onProgress?: (payload: LoadProgress) => void,
    ): Promise<SharedModelAssetEntry> {
        const key = resolveModelAssetKey(source);
        const existing = this.#entries.get(key);
        if (existing) return existing;

        let pending = this.#inFlight.get(key);
        if (!pending) {
            pending = this.#compileEntry(key, source, resolver, onProgress);
            this.#inFlight.set(key, pending);
        }
        try {
            const entry = await pending;
            this.#entries.set(key, entry);
            return entry;
        } finally {
            this.#inFlight.delete(key);
        }
    }

    async #compileEntry(
        key: string,
        source: ModelSource,
        resolver: AssetResolver | undefined,
        onProgress?: (payload: LoadProgress) => void,
    ): Promise<SharedModelAssetEntry> {
        const notify = (payload: LoadProgress) => onProgress?.(payload);

        notify({
            stage: "resolve",
            progress: 0.02,
            detail: "resolve source",
        });

        let json: unknown;
        let baseUrl: string;
        let settingsUrl: string;

        if (typeof source === "object" && source.kind === "json") {
            json = source.json;
            baseUrl = source.baseUrl;
            settingsUrl = source.baseUrl;
            notify({
                stage: "settings",
                progress: 0.2,
                detail: "inline settings",
            });
        } else {
            const raw =
                typeof source === "string"
                    ? source
                    : source.kind === "npm"
                      ? modelSourceUrl(source)
                      : source.url;
            const cdnBase =
                typeof source === "object" && source.kind === "npm"
                    ? source.cdnBase
                    : undefined;
            const fetchUrl = resolveModelSourceUrl(raw, {
                npmCdnBase: cdnBase,
            });
            notify({
                stage: "settings",
                progress: 0.05,
                detail: fetchUrl,
            });
            json = await fetchModelJson(fetchUrl, (u) => {
                const ratio =
                    u.bytesTotal && u.bytesTotal > 0
                        ? u.bytesLoaded / u.bytesTotal
                        : 0;
                notify({
                    stage: "settings",
                    progress: lerp(0.05, 0.22, ratio),
                    detail: fetchUrl,
                    bytesLoaded: u.bytesLoaded,
                    bytesTotal: u.bytesTotal,
                });
            });
            baseUrl = fetchUrl;
            settingsUrl = fetchUrl;
        }

        const settings = normalizeModelSettings(json, settingsUrl);
        notify({
            stage: "moc",
            progress: 0.25,
            detail: settings.moc,
        });

        const assetResolver =
            resolver ??
            createUrlAssetResolver(baseUrl, {
                onBytesProgress: (assetKey, u) => {
                    const isMoc = assetKey === settings.moc;
                    const ratio =
                        u.bytesTotal && u.bytesTotal > 0
                            ? u.bytesLoaded / u.bytesTotal
                            : 0;
                    if (isMoc) {
                        notify({
                            stage: "moc",
                            progress: lerp(0.25, 0.8, ratio),
                            detail: assetKey,
                            bytesLoaded: u.bytesLoaded,
                            bytesTotal: u.bytesTotal,
                        });
                    } else {
                        notify({
                            stage: "textures",
                            progress: lerp(0.8, 0.9, ratio),
                            detail: assetKey,
                            bytesLoaded: u.bytesLoaded,
                            bytesTotal: u.bytesTotal,
                        });
                    }
                },
            });

        const backend = selectModelBackend([...this.#backends], json);
        notify({
            stage: "decode",
            progress: 0.85,
            detail: `decode ${settings.format}`,
        });

        const mocBytes = await assetResolver.fetchBytes(settings.moc);
        const sharedCompile = compileSharedModelCompile(settings, mocBytes);

        const textures: TextureData[] = [];
        if (settings.textures.length > 0) {
            notify({
                stage: "textures",
                progress: 0.88,
                detail: `${settings.textures.length} textures`,
            });
            textures.push(
                ...(await loadTextureData(assetResolver, settings.textures, {
                    onProgress: (u) => {
                        const ratio = u.total > 0 ? (u.index + 1) / u.total : 1;
                        notify({
                            stage: "textures",
                            progress: lerp(0.88, 0.96, ratio),
                            detail: u.key,
                            bytesLoaded: u.bytesLoaded,
                            bytesTotal: u.bytesTotal,
                        });
                    },
                })),
            );
        }

        notify({
            stage: "ready",
            progress: 1,
            detail: settings.name ?? key,
        });

        return {
            key,
            settings,
            backend,
            resolver: assetResolver,
            sharedCompile,
            textures,
            motionCache: new Map(),
            refCount: 0,
        };
    }
}
