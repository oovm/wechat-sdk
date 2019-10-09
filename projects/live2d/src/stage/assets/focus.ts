import type { ParameterBinding } from "@doki-land/live2d-renderer";

/**
 * Map canvas focus (-1..1, Y-up) onto commonly used model parameter IDs.
 *
 * ANGLE_X/Y use the full declared range, ANGLE_Z combines both axes, and body
 * and eye parameters receive the corresponding normalized axis. Parameters not
 * declared by a model are skipped.
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
    // Each binding maps normalized input through its own declared range.
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
