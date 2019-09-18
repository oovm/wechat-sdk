import type { ActorTransform } from "@doki-land/live2d-core";
import { DEFAULT_ACTOR_TRANSFORM } from "@doki-land/live2d-core";
import type { DrawableMesh } from "@doki-land/live2d-renderer";

/** Merge partial transform with defaults. */
export function resolveActorTransform(
    patch?: Partial<ActorTransform>,
): ActorTransform {
    const base = DEFAULT_ACTOR_TRANSFORM;
    const scale = patch?.scale ?? base.scale ?? 1;
    return {
        x: patch?.x ?? base.x,
        y: patch?.y ?? base.y,
        scale,
        scaleX: patch?.scaleX ?? patch?.scale ?? scale,
        scaleY: patch?.scaleY ?? patch?.scale ?? scale,
        rotation: patch?.rotation ?? base.rotation ?? 0,
        anchorX: patch?.anchorX ?? base.anchorX ?? 0.5,
        anchorY: patch?.anchorY ?? base.anchorY ?? 1,
    };
}

/**
 * Map model-space NDC (Y-up, -1..1) to normalized stage space (0..1, Y-down).
 *
 * Model width/height of 2 NDC units map to `scale` stage units; anchor aligns
 * the model bbox to `(x, y)` in stage space.
 */
export function modelNdcToStage(
    modelX: number,
    modelY: number,
    transform: ActorTransform,
): { stageX: number; stageY: number } {
    const scaleX = transform.scaleX ?? transform.scale ?? 1;
    const scaleY = transform.scaleY ?? transform.scale ?? 1;
    const anchorX = transform.anchorX ?? 0.5;
    const anchorY = transform.anchorY ?? 1;
    const rotation = transform.rotation ?? 0;

    const anchorModelX = -1 + anchorX * 2;
    const anchorModelY = 1 - anchorY * 2;

    let localX = (modelX - anchorModelX) * scaleX * 0.5;
    let localY = (anchorModelY - modelY) * scaleY * 0.5;

    if (rotation !== 0) {
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);
        const rx = localX * c - localY * s;
        const ry = localX * s + localY * c;
        localX = rx;
        localY = ry;
    }

    return {
        stageX: transform.x + localX,
        stageY: transform.y + localY,
    };
}

/** Inverse of {@link modelNdcToStage} for a given transform (ignores rotation). */
export function stageToModelNdc(
    stageX: number,
    stageY: number,
    transform: ActorTransform,
): { modelX: number; modelY: number } {
    const scaleX = transform.scaleX ?? transform.scale ?? 1;
    const scaleY = transform.scaleY ?? transform.scale ?? 1;
    const anchorX = transform.anchorX ?? 0.5;
    const anchorY = transform.anchorY ?? 1;
    const anchorModelX = -1 + anchorX * 2;
    const anchorModelY = 1 - anchorY * 2;

    const localX = (stageX - transform.x) / (scaleX * 0.5);
    const localY = (stageY - transform.y) / (scaleY * 0.5);

    return {
        modelX: localX + anchorModelX,
        modelY: anchorModelY - localY,
    };
}

/** Canvas client coordinates → normalized stage space (0..1). */
export function clientToStage(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
): { stageX: number; stageY: number } {
    const rect = canvas.getBoundingClientRect();
    const x = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const y = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
    return {
        stageX: Math.min(1, Math.max(0, x)),
        stageY: Math.min(1, Math.max(0, y)),
    };
}

/** Focus drag vector in -1..1 from actor center toward a stage point. */
export function stageFocusDrag(
    stageX: number,
    stageY: number,
    transform: ActorTransform,
): { dragX: number; dragY: number } {
    const dx = stageX - transform.x;
    const dy = transform.y - stageY;
    const dragX = Math.min(1, Math.max(-1, dx * 2));
    const dragY = Math.min(1, Math.max(-1, dy * 2));
    return { dragX, dragY };
}

/** Layer name → sort key (lower draws first). */
export function layerOrderIndex(
    layer: string,
    definedLayers: readonly string[],
): number {
    const idx = definedLayers.indexOf(layer);
    return idx >= 0 ? idx : definedLayers.length;
}

/** Sort actors for draw / hit-test (back to front for hit). */
export function compareActorsForDraw<
    T extends { layer: string; order: number; creationIndex: number },
>(a: T, b: T, definedLayers: readonly string[]): number {
    const la = layerOrderIndex(a.layer, definedLayers);
    const lb = layerOrderIndex(b.layer, definedLayers);
    return la - lb || a.order - b.order || a.creationIndex - b.creationIndex;
}

/** Front-to-back order for hit testing. */
export function compareActorsForHit<
    T extends { layer: string; order: number; creationIndex: number },
>(a: T, b: T, definedLayers: readonly string[]): number {
    return compareActorsForDraw(b, a, definedLayers);
}

/** Bake actor stage placement into drawable vertices (renderer stays single-pass). */
export function transformDrawablesForStage(
    drawables: readonly DrawableMesh[],
    transform: ActorTransform,
    opacity: number,
): DrawableMesh[] {
    const alpha = Math.min(1, Math.max(0, opacity));
    return drawables.map((d) => {
        if (!d.visible || alpha <= 0) return { ...d, visible: false };
        const pos = new Float32Array(d.vertexPositions.length);
        for (let i = 0; i < pos.length; i += 2) {
            const { stageX, stageY } = modelNdcToStage(
                d.vertexPositions[i]!,
                d.vertexPositions[i + 1]!,
                transform,
            );
            pos[i] = stageX * 2 - 1;
            pos[i + 1] = 1 - stageY * 2;
        }
        return {
            ...d,
            vertexPositions: pos,
            opacity: d.opacity * alpha,
        };
    });
}
