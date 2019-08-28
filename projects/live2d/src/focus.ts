import type { ParameterBinding } from "@doki-land/live2d-renderer";

/**
 * Map canvas focus (-1..1, Y-up) onto standard Cubism drag parameters.
 *
 * Matches the Cubism sample / community widget weights:
 * ANGLE_X/Y full range, ANGLE_Z = -dragX*dragY, BODY_ANGLE_X, EYE_BALL_*.
 * Missing ids on a given model are skipped.
 */
export function focusParameterUpdates(
    parameters: readonly ParameterBinding[],
    dragX: number,
    dragY: number,
): Array<{ id: string; value: number }> {
    const byId = new Map(parameters.map((p) => [p.id, p]));
    const x = clampUnit(dragX);
    const y = clampUnit(dragY);
    const out: Array<{ id: string; value: number }> = [];

    const set = (id: string, normalized: number) => {
        const binding = byId.get(id);
        if (!binding) return;
        out.push({ id, value: valueFromNormalized(binding, normalized) });
    };

    set("PARAM_ANGLE_X", x);
    set("PARAM_ANGLE_Y", y);
    set("PARAM_ANGLE_Z", clampUnit(x * y * -1));
    // Official sample uses dragX*10 vs ANGLE's *30; BODY range is typically ±10,
    // so full-range normalized drag still matches that relative weight.
    set("PARAM_BODY_ANGLE_X", x);
    set("PARAM_BODY_ANGLE_Y", y);
    set("PARAM_EYE_BALL_X", x);
    set("PARAM_EYE_BALL_Y", y);

    return out;
}

function clampUnit(n: number): number {
    if (n > 1) return 1;
    if (n < -1) return -1;
    return n;
}

function valueFromNormalized(
    binding: ParameterBinding,
    normalized: number,
): number {
    const n = clampUnit(normalized);
    return n >= 0
        ? binding.defaultValue + (binding.max - binding.defaultValue) * n
        : binding.defaultValue + (binding.defaultValue - binding.min) * n;
}
