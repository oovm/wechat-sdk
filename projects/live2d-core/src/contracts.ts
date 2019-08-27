/**
 * Internal loading / session contracts shared across packages.
 * Format decode and GPU details stay in live2d-renderer.
 */

/** How the host names a model settings document. */
export type ModelSource =
    | string
    | { readonly kind: "url"; readonly url: string }
    | {
          readonly kind: "json";
          readonly json: unknown;
          readonly baseUrl: string;
      }
    | {
          readonly kind: "npm";
          /** Package name, optionally with `@version` (e.g. `live2d-widget-model-hijiki@1.0.5`). */
          readonly package: string;
          /** Path inside the package to model JSON. */
          readonly path: string;
          /** Optional CDN base; default is applied by the loader. */
          readonly cdnBase?: string;
      };

export function modelSourceUrl(source: ModelSource): string {
    if (typeof source === "string") return source;
    if (source.kind === "url") return source.url;
    if (source.kind === "npm") {
        const path = source.path.replace(/^\/+/, "");
        return `npm:${source.package}/${path}`;
    }
    return source.baseUrl;
}

/** Relative asset key as declared in settings (moc, texture, motion, …). */
export type AssetKey = string;

/** Resolve and fetch assets relative to a model settings URL. */
export interface AssetResolver {
    readonly baseUrl: string;

    resolve(key: AssetKey): string;

    fetchJson(key: AssetKey): Promise<unknown>;

    fetchBytes(key: AssetKey): Promise<ArrayBuffer>;
}

/** Session lifecycle (facade state machine). */
export type SessionPhase =
    | "idle"
    | "mounting"
    | "ready"
    | "loading"
    | "live"
    | "error"
    | "destroyed";

export interface SessionState {
    readonly phase: SessionPhase;
    readonly lastError: unknown | null;
    readonly generation: number;
}
