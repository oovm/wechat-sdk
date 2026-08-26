import type { Pose3Clip } from "./types.js";

/**
 * When a part in a pose group becomes visible, hide sibling parts in that group.
 * Mirrors Cubism Pose minimum semantics for part-opacity switching.
 */
export function applyPose3Activation(
    clip: Pose3Clip,
    activatedPartId: string,
    setPartOpacity: (partId: string, opacity: number) => void,
): void {
    for (const group of clip.groups) {
        if (!group.includes(activatedPartId)) continue;
        for (const partId of group) {
            setPartOpacity(partId, partId === activatedPartId ? 1 : 0);
        }
        return;
    }
}
