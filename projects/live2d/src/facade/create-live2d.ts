import {
    createMoc2Backend,
    createMoc3Backend,
    createRenderer,
} from "@doki-land/live2d-renderer";
import { allocateActorId } from "../stage/actor.js";
import {
    type CreateLive2dOptions,
    createSingleActorFacade,
    type Live2dRuntime,
} from "../stage/single-facade.js";
import { createLive2dStage } from "../stage/stage.js";

export type {
    CreateLive2dOptions,
    Live2dRuntime,
} from "../stage/single-facade.js";
export {
    MotionPriority,
    type PlayMotionOptions,
} from "../stage/single-facade.js";

/** Wire moc backends and a renderer into one single-actor session. */
export function createLive2d(options: CreateLive2dOptions = {}): Live2dRuntime {
    const backends = options.backends ?? [
        createMoc2Backend(),
        createMoc3Backend(),
    ];
    const stage = createLive2dStage({
        backends,
        renderer:
            options.renderer ?? createRenderer({ prefer: options.prefer }),
        updateMode: options.updateMode ?? "manual",
    }) as import("../stage/stage.js").Live2dStageImpl;
    const actor = stage.createActor({
        id: allocateActorId("default"),
    }) as import("../stage/actor.js").Live2dActorImpl;
    return createSingleActorFacade(stage, actor, backends);
}
