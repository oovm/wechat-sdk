import type { Physics3Clip } from "./types.js";

export interface Physics3ApplyBinding {
    readonly value: number;
}

/**
 * Minimal Physics3 apply gate — **not** a full Cubism spring / pendulum solver.
 *
 * For each output destination parameter id that exists in `bindings`, performs a
 * trivial identity step (write current value back). Exists so load → update can
 * exercise the physics clip API; real physics evaluation is a later milestone.
 */
export function applyPhysics3(
    clip: Physics3Clip,
    _deltaTimeSeconds: number,
    bindings: ReadonlyMap<string, Physics3ApplyBinding>,
    setParameter: (id: string, value: number) => void,
): void {
    for (const id of clip.outputParameterIds) {
        const binding = bindings.get(id);
        if (!binding) continue;
        // Identity / zero-step: prove the output walk without changing values.
        setParameter(id, binding.value);
    }
}
