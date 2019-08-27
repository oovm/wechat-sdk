/**
 * Resolve model settings URLs, including `npm:` specifiers via a CDN.
 */

const DEFAULT_NPM_CDN = "https://cdn.jsdelivr.net/npm";

export interface ResolveModelSourceOptions {
    /** Default: `https://cdn.jsdelivr.net/npm` */
    npmCdnBase?: string;
}

/**
 * Parse `name@version/path`, `@scope/name@version/path`, or `name/path`.
 * When version is omitted, jsDelivr resolves the latest published version.
 */
export function resolveNpmSpecifier(
    spec: string,
    cdnBase: string = DEFAULT_NPM_CDN,
): string {
    const trimmed = spec.trim().replace(/^\/+/, "");
    if (!trimmed) {
        throw new Error("@doki-land/live2d-loader: empty npm model specifier");
    }

    let pkg = "";
    let version: string | null = null;
    let assetPath = "";

    if (trimmed.startsWith("@")) {
        // @scope/name[@version][/path]
        const scopeSlash = trimmed.indexOf("/");
        if (scopeSlash < 0) {
            throw new Error(
                `@doki-land/live2d-loader: scoped npm specifier needs /name: ${spec}`,
            );
        }
        const afterScope = trimmed.slice(scopeSlash + 1);
        const at = afterScope.indexOf("@");
        const slash = afterScope.indexOf("/");
        if (at >= 0 && (slash < 0 || at < slash)) {
            pkg = `${trimmed.slice(0, scopeSlash + 1)}${afterScope.slice(0, at)}`;
            const rest = afterScope.slice(at + 1);
            const pathSlash = rest.indexOf("/");
            if (pathSlash < 0) {
                version = rest;
            } else {
                version = rest.slice(0, pathSlash);
                assetPath = rest.slice(pathSlash + 1);
            }
        } else if (slash >= 0) {
            pkg = `${trimmed.slice(0, scopeSlash + 1)}${afterScope.slice(0, slash)}`;
            assetPath = afterScope.slice(slash + 1);
        } else {
            pkg = trimmed;
        }
    } else {
        const at = trimmed.indexOf("@");
        const slash = trimmed.indexOf("/");
        if (at >= 0 && (slash < 0 || at < slash)) {
            pkg = trimmed.slice(0, at);
            const rest = trimmed.slice(at + 1);
            const pathSlash = rest.indexOf("/");
            if (pathSlash < 0) {
                version = rest;
            } else {
                version = rest.slice(0, pathSlash);
                assetPath = rest.slice(pathSlash + 1);
            }
        } else if (slash >= 0) {
            pkg = trimmed.slice(0, slash);
            assetPath = trimmed.slice(slash + 1);
        } else {
            pkg = trimmed;
        }
    }

    if (!pkg) {
        throw new Error(
            `@doki-land/live2d-loader: invalid npm model specifier: ${spec}`,
        );
    }
    if (!assetPath) {
        throw new Error(
            `@doki-land/live2d-loader: npm model specifier needs an asset path (got "${spec}")`,
        );
    }

    const base = cdnBase.replace(/\/+$/, "");
    const nameWithVersion = version ? `${pkg}@${version}` : pkg;
    return `${base}/${nameWithVersion}/${assetPath.replace(/^\/+/, "")}`;
}

/**
 * Turn a model source string into a fetchable URL.
 * - `npm:pkg[@ver]/path` → CDN URL (jsDelivr by default)
 * - `http(s)://...` / absolute / relative paths pass through
 */
export function resolveModelSourceUrl(
    source: string,
    options: ResolveModelSourceOptions = {},
): string {
    if (source.startsWith("npm:")) {
        return resolveNpmSpecifier(
            source.slice("npm:".length),
            options.npmCdnBase ?? DEFAULT_NPM_CDN,
        );
    }
    return source;
}

export { DEFAULT_NPM_CDN };
