import type { Expression3Clip, ExpressionBlendMode } from "./types.js";

export interface ExpressionApplyBinding {
    readonly value: number;
}

function blendValue(
    current: number,
    target: number,
    mode: ExpressionBlendMode,
    weight: number,
): number {
    if (weight <= 0) return current;
    if (weight >= 1) {
        if (mode === "Add") return current + target;
        if (mode === "Multiply") return current * target;
        return target;
    }
    const full =
        mode === "Add"
            ? current + target
            : mode === "Multiply"
              ? current * target
              : target;
    return current + (full - current) * weight;
}

/** Apply expression parameters on top of the current parameter state. */
export function applyExpression3Clip(
    clip: Expression3Clip,
    weight: number,
    bindings: ReadonlyMap<string, ExpressionApplyBinding>,
    setParameter: (id: string, value: number) => void,
): void {
    if (weight <= 0) return;
    for (const p of clip.parameters) {
        const binding = bindings.get(p.id);
        if (!binding) continue;
        setParameter(p.id, blendValue(binding.value, p.value, p.blend, weight));
    }
}
