/**
 * Settings JSON format detection (moc2 vs moc3).
 * Shared by loader normalize and renderer backends — keep binary peek in renderer.
 */

import type { ModelFormat } from "./model.js";

/** Detect moc2 vs moc3 from model settings JSON shape. Returns null if unknown. */
export function detectModelSettingsFormat(json: unknown): ModelFormat | null {
    if (!json || typeof json !== "object") return null;
    const o = json as Record<string, unknown>;
    const fileRefs = o.FileReferences;
    if (fileRefs && typeof fileRefs === "object") {
        const moc = (fileRefs as Record<string, unknown>).Moc;
        if (typeof moc === "string") {
            const lower = moc.toLowerCase();
            if (lower.endsWith(".moc3") || lower.endsWith(".program.json")) {
                return "moc3";
            }
            if (lower.endsWith(".moc")) {
                return "moc2";
            }
            // Cubism 3 settings without a recognized extension still count as moc3.
            return "moc3";
        }
    }
    if (typeof o.model === "string" && Array.isArray(o.textures)) {
        return "moc2";
    }
    return null;
}
