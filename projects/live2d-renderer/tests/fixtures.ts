/**
 * Optional redistributable sample MOC binaries for integration tests.
 * CI lacks `live2d-ts-ref-repos`; only catalog entries with `local: true`
 * are part of the offline corpus — suites must `describe.skipIf(!bytes)`
 * when these resolve to null.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** `live2d.ts` repo root (`projects/live2d-renderer/tests` → ../../..) */
export const LIVE2D_TS_ROOT = resolve(HERE, "../../..");
/** Sibling checkout used by local developers */
export const REF_REPOS_ROOT = resolve(LIVE2D_TS_ROOT, "../live2d-ts-ref-repos");

export function tryReadFixture(
    ...candidates: readonly string[]
): ArrayBuffer | null {
    for (const p of candidates) {
        if (!existsSync(p)) continue;
        try {
            return Uint8Array.from(readFileSync(p)).buffer;
        } catch {
            /* next */
        }
    }
    return null;
}

export const WANKO_MOC3_CANDIDATES = [
    resolve(
        LIVE2D_TS_ROOT,
        "projects/homepage/public/models/samples/moc3-wanko/Wanko.moc3",
    ),
    resolve(REF_REPOS_ROOT, "sample-models/moc3-wanko/Wanko.moc3"),
    resolve(REF_REPOS_ROOT, "sample-models/Wanko/Wanko.moc3"),
    resolve(
        REF_REPOS_ROOT,
        "CubismWebSamples/Samples/Resources/Wanko/Wanko.moc3",
    ),
] as const;

export const HIJIKI_MOC2_CANDIDATES = [
    resolve(
        LIVE2D_TS_ROOT,
        "projects/homepage/public/models/samples/moc2-hijiki/moc/hijiki.moc",
    ),
    resolve(REF_REPOS_ROOT, "sample-models/moc2-hijiki/moc/hijiki.moc"),
] as const;

export const CLIPPING_MOC3_CANDIDATES = [
    resolve(
        REF_REPOS_ROOT,
        "CubismUnityComponents/Assets/Live2D/Cubism/Samples/Models/Clipping/Clipping.moc3",
    ),
] as const;

export const MARK_MOC3_CANDIDATES = [
    resolve(
        REF_REPOS_ROOT,
        "CubismWebSamples/Samples/Resources/Mark/Mark.moc3",
    ),
] as const;

export const HARU_MOC3_CANDIDATES = [
    resolve(
        REF_REPOS_ROOT,
        "CubismWebSamples/Samples/Resources/Haru/Haru.moc3",
    ),
    resolve(
        REF_REPOS_ROOT,
        "CubismNativeSamples/Samples/Resources/Haru/Haru.moc3",
    ),
] as const;

export const MAO_MOC3_CANDIDATES = [
    resolve(REF_REPOS_ROOT, "CubismWebSamples/Samples/Resources/Mao/Mao.moc3"),
    resolve(
        REF_REPOS_ROOT,
        "CubismNativeSamples/Samples/Resources/Mao/Mao.moc3",
    ),
] as const;
