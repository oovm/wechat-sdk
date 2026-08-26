export { allocateActorId, Live2dActorImpl } from "./actor.js";
export { ActorModelSlot } from "./actor-model-slot.js";
export {
    type CreateLive2dOptions,
    createSingleActorFacade,
    type Live2dRuntime,
    /** @deprecated Use `CreateLive2dOptions`. */
    type CreateLive2DOptions,
    /** @deprecated Use `Live2dRuntime`. */
    type Live2DRuntime,
} from "./single-facade.js";
export { createLive2dStage, Live2dStageImpl } from "./stage.js";
export {
    clientToStage,
    compareActorsForDraw,
    compareActorsForHit,
    modelNdcToStage,
    resolveActorTransform,
    stageFocusDrag,
    stageToModelNdc,
    transformDrawablesForStage,
} from "./transform.js";
