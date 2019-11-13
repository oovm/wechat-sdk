import type {
    FrameProfile,
    Live2dRuntime,
    LoadProgress,
    ModelSource,
    PlayMotionOptions,
    RendererKind,
} from "@doki-land/live2d";
import type { Live2dElement } from "@doki-land/live2d-element";
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from "react";
import "./Live2d.css";

export interface Live2dHandle {
    getRuntime: () => Live2dRuntime | null;
    setParameter: (id: string, value: number) => void;
    clearManualAngleX: () => void;
    listParameters: () => ReturnType<Live2dRuntime["listParameters"]>;
    playMotion: (
        group: string,
        index?: number,
        options?: PlayMotionOptions,
    ) => Promise<boolean>;
    stopMotion: (opts?: { fade?: boolean; slot?: string }) => void;
    listPlayingMotions: () => ReturnType<Live2dRuntime["listPlayingMotions"]>;
    capturePng: (opts?: {
        mimeType?: "image/png";
        quality?: number;
    }) => Promise<Blob>;
    reload: () => Promise<void>;
}

export interface Live2dProps {
    /** model3.json URL or structured ModelSource. */
    model?: ModelSource | null;
    width?: number;
    height?: number;
    /** Renderer try order. Default prefers Canvas2D for reliable preview. */
    prefer?: RendererKind[];
    autoplay?: boolean;
    /** Animate PARAM_ANGLE_X automatically while playing. */
    autoSway?: boolean;
    /** Show built-in loading overlay with progress bar. */
    showProgress?: boolean;
    interactive?: boolean;
    tracking?: "pointer" | "none";
    onReady?: (modelId: string) => void;
    onError?: (error: unknown) => void;
    onProgress?: (progress: LoadProgress) => void;
    onProfile?: (profile: FrameProfile) => void;
    onHit?: (payload: { area: string; x: number; y: number }) => void;
}

function syncSource(
    el: Live2dElement,
    model: ModelSource | null | undefined,
    setLoading: (value: boolean) => void,
    setLoadProgress: (value: LoadProgress | null) => void,
): void {
    if (model == null) {
        el.removeAttribute("model");
        el.source = null;
        setLoading(false);
        setLoadProgress(null);
        return;
    }
    if (typeof model === "string") {
        el.source = null;
        el.model = model;
    } else {
        el.removeAttribute("model");
        el.source = model;
    }
    setLoading(true);
    setLoadProgress({ stage: "mounting", progress: 0.01 });
}

export const Live2d = forwardRef<Live2dHandle, Live2dProps>(function Live2d(
    {
        model = null,
        width = 320,
        height = 320,
        prefer = ["canvas2d", "webgl2", "webgpu"],
        autoplay = true,
        autoSway = true,
        showProgress = true,
        interactive = true,
        tracking = "pointer",
        onReady,
        onError,
        onProgress,
        onProfile,
        onHit,
    },
    ref,
) {
    const [actor, setActor] = useState<Live2dElement | null>(null);
    const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
    const [loading, setLoading] = useState(false);

    const modelAttr = typeof model === "string" ? model : "";

    const progressPercent = Math.round(
        Math.min(1, Math.max(0, loadProgress?.progress ?? 0)) * 100,
    );

    const progressLabel = useMemo(() => {
        const p = loadProgress;
        if (!p) return "Loading…";
        if (p.bytesLoaded != null && p.bytesTotal != null && p.bytesTotal > 0) {
            const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
            return `${p.stage} · ${kb(p.bytesLoaded)} / ${kb(p.bytesTotal)}`;
        }
        return p.detail ? `${p.stage} · ${p.detail}` : p.stage;
    }, [loadProgress]);

    useImperativeHandle(
        ref,
        () => ({
            getRuntime: () => actor?.runtime ?? null,
            setParameter(id, value) {
                actor?.runtime?.setParameter(id, value);
                if (!autoplay) {
                    actor?.runtime?.update(0);
                }
            },
            clearManualAngleX() {
                /* autosway lives on <live-2d> */
            },
            listParameters: () => actor?.runtime?.listParameters() ?? [],
            playMotion: (group, index, options) =>
                actor?.playMotion(group, index, options) ??
                Promise.resolve(false),
            stopMotion: (opts) => actor?.runtime?.stopMotion(opts),
            listPlayingMotions: () =>
                actor?.runtime?.listPlayingMotions() ?? [],
            capturePng: (opts) => {
                const runtime = actor?.runtime;
                if (!runtime) {
                    return Promise.reject(
                        new Error("react-plugin-live2d: runtime not mounted"),
                    );
                }
                return runtime.capturePng(opts);
            },
            reload: async () => {
                if (!actor || model == null) {
                    if (actor)
                        syncSource(actor, model, setLoading, setLoadProgress);
                    return;
                }
                setLoading(true);
                setLoadProgress({
                    stage: "resolve",
                    progress: 0.02,
                    detail: "resolve source",
                });
                syncSource(actor, model, setLoading, setLoadProgress);
                await actor.loadModel();
            },
        }),
        [actor, autoplay, model],
    );

    useEffect(() => {
        if (!actor) return;

        const handleReady = (event: Event) => {
            setLoading(false);
            const detail = (event as CustomEvent<{ model?: string }>).detail;
            setLoadProgress({
                stage: "ready",
                progress: 1,
                detail: detail?.model,
            });
            onReady?.(detail?.model ?? "");
        };

        const handleError = (event: Event) => {
            setLoading(false);
            const detail = (
                event as CustomEvent<{ cause?: unknown; error?: string }>
            ).detail;
            onError?.(detail?.cause ?? detail?.error ?? "live2d-error");
        };

        const handleProgress = (event: Event) => {
            const payload = (event as CustomEvent<LoadProgress>).detail;
            setLoadProgress(payload);
            onProgress?.(payload);
        };

        const handleProfile = (event: Event) => {
            onProfile?.((event as CustomEvent<FrameProfile>).detail);
        };

        const handleHit = (event: Event) => {
            const detail = (
                event as CustomEvent<{
                    area: string | null;
                    modelX: number;
                    modelY: number;
                }>
            ).detail;
            if (detail?.area) {
                onHit?.({
                    area: detail.area,
                    x: detail.modelX,
                    y: detail.modelY,
                });
            }
        };

        actor.addEventListener("live2d-ready", handleReady);
        actor.addEventListener("live2d-error", handleError);
        actor.addEventListener("live2d-progress", handleProgress);
        actor.addEventListener("live2d-profile", handleProfile);
        actor.addEventListener("live2d-hit", handleHit);

        actor.renderOptions = { prefer: [...prefer] };
        syncSource(actor, model, setLoading, setLoadProgress);

        return () => {
            actor.removeEventListener("live2d-ready", handleReady);
            actor.removeEventListener("live2d-error", handleError);
            actor.removeEventListener("live2d-progress", handleProgress);
            actor.removeEventListener("live2d-profile", handleProfile);
            actor.removeEventListener("live2d-hit", handleHit);
        };
    }, [actor, model, prefer, onReady, onError, onProgress, onProfile, onHit]);

    return (
        <div
            className="doki-live2d-root"
            style={{ width: `${width}px`, height: `${height}px` }}
        >
            <live-2d
                ref={setActor}
                model={modelAttr}
                width={width}
                height={height}
                autoplay={autoplay}
                autosway={autoSway}
                interactive={interactive}
                tracking={tracking}
            />
            {showProgress && loading ? (
                <div
                    className="doki-live2d-progress"
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div className="doki-live2d-progress__track">
                        <div
                            className="doki-live2d-progress__fill"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="doki-live2d-progress__label">
                        {progressLabel} · {progressPercent}%
                    </div>
                </div>
            ) : null}
        </div>
    );
});
