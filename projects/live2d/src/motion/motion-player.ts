import { evaluateMotion3 } from "./evaluate-curve.js";
import type {
    Motion3Clip,
    MotionApplySample,
    MotionPriorityLevel,
    PlayMotionOptions,
} from "./types.js";
import { MotionPriority } from "./types.js";

export interface MotionPlayerHandlers {
    onStart?: (info: { group: string; index: number; slot: string }) => void;
    onFinish?: (info: { group: string; index: number; slot: string }) => void;
    onEvent?: (info: {
        group: string;
        index: number;
        slot: string;
        time: number;
        value: string;
    }) => void;
}

interface ActiveMotion {
    slot: string;
    group: string;
    index: number;
    clip: Motion3Clip;
    priority: MotionPriorityLevel;
    loop: boolean;
    fadeInTime: number;
    fadeOutTime: number;
    time: number;
    fadingOut: boolean;
    fadeOutElapsed: number;
    lastEventIndex: number;
    started: boolean;
}

interface QueuedMotion {
    group: string;
    index: number;
    clip: Motion3Clip;
    options: PlayMotionOptions;
}

/**
 * Multi-slot motion player with per-slot queue.
 *
 * Default slot is `priority:{n}` so idle (1) and normal (2) can run together.
 * Same slot replaces (with fade-out) unless `queue: true`.
 */
export class MotionPlayer {
    #slots = new Map<string, ActiveMotion>();
    #queues = new Map<string, QueuedMotion[]>();
    #handlers: MotionPlayerHandlers;

    constructor(handlers: MotionPlayerHandlers = {}) {
        this.#handlers = handlers;
    }

    get isPlaying(): boolean {
        return this.#slots.size > 0;
    }

    listPlaying(): ReadonlyArray<{
        slot: string;
        group: string;
        index: number;
        time: number;
        priority: MotionPriorityLevel;
    }> {
        return [...this.#slots.values()].map((a) => ({
            slot: a.slot,
            group: a.group,
            index: a.index,
            time: a.time,
            priority: a.priority,
        }));
    }

    /**
     * Start a clip on a slot. Returns false if rejected by priority
     * (and not queued).
     */
    start(
        group: string,
        index: number,
        clip: Motion3Clip,
        options: PlayMotionOptions = {},
    ): boolean {
        const priority = options.priority ?? MotionPriority.normal;
        const slot = options.slot ?? `priority:${priority}`;
        const existing = this.#slots.get(slot);

        if (existing && priority < existing.priority) {
            if (options.queue) {
                this.#enqueue(slot, { group, index, clip, options });
                return true;
            }
            return false;
        }

        if (existing && options.queue && !existing.fadingOut) {
            this.#enqueue(slot, { group, index, clip, options });
            return true;
        }

        if (existing) {
            // Replace: fade out current, then start — or hard-swap if no fade.
            if (existing.fadeOutTime > 0 && !existing.fadingOut) {
                existing.fadingOut = true;
                existing.fadeOutElapsed = 0;
                this.#enqueueFront(slot, { group, index, clip, options });
                return true;
            }
            this.#finish(existing, false);
        }

        this.#slots.set(
            slot,
            this.#createActive(slot, group, index, clip, options),
        );
        return true;
    }

    /** Fade out (default) or hard-stop; `slot` omits → all slots. */
    stop(fade = true, slot?: string): void {
        if (slot !== undefined) {
            const a = this.#slots.get(slot);
            if (!a) return;
            this.#stopOne(a, fade);
            return;
        }
        for (const a of [...this.#slots.values()]) {
            this.#stopOne(a, fade);
        }
    }

    clear(): void {
        this.#slots.clear();
        this.#queues.clear();
    }

    /**
     * Advance all slots and return blended samples (weight baked in; apply as absolute).
     */
    update(deltaTimeSeconds: number): MotionApplySample[] {
        const dt = Math.max(0, deltaTimeSeconds);
        const layerSamples: Array<{
            priority: number;
            samples: MotionApplySample[];
        }> = [];

        for (const a of [...this.#slots.values()]) {
            const samples = this.#tick(a, dt);
            if (samples) {
                layerSamples.push({ priority: a.priority, samples });
            }
        }

        layerSamples.sort((a, b) => a.priority - b.priority);
        return blendMotionLayers(layerSamples);
    }

    #tick(a: ActiveMotion, dt: number): MotionApplySample[] | null {
        if (!a.started) {
            a.started = true;
            this.#handlers.onStart?.({
                group: a.group,
                index: a.index,
                slot: a.slot,
            });
        }

        a.time += dt;

        if (a.fadingOut) {
            a.fadeOutElapsed += dt;
            if (a.fadeOutElapsed >= a.fadeOutTime) {
                this.#finish(a, true);
                return null;
            }
        } else if (!a.loop && a.time >= a.clip.duration) {
            if (a.fadeOutTime > 0) {
                a.fadingOut = true;
                a.fadeOutElapsed = 0;
            } else {
                const samples = this.#sample(a, a.clip.duration, 1);
                this.#finish(a, true);
                return samples;
            }
        }

        let playTime = a.time;
        if (a.loop && a.clip.duration > 0) {
            playTime = a.time % a.clip.duration;
        } else {
            playTime = Math.min(playTime, a.clip.duration);
        }

        this.#emitEvents(a, playTime);
        return this.#sample(a, playTime, this.#fadeWeight(a));
    }

    #createActive(
        slot: string,
        group: string,
        index: number,
        clip: Motion3Clip,
        options: PlayMotionOptions,
    ): ActiveMotion {
        const fadeIn =
            options.fadeInTime ?? (clip.fadeInTime > 0 ? clip.fadeInTime : 0);
        const fadeOut =
            options.fadeOutTime ??
            (clip.fadeOutTime > 0 ? clip.fadeOutTime : 0);
        return {
            slot,
            group,
            index,
            clip,
            priority: options.priority ?? MotionPriority.normal,
            loop: options.loop ?? clip.loop,
            fadeInTime: Math.max(0, fadeIn),
            fadeOutTime: Math.max(0, fadeOut),
            time: 0,
            fadingOut: false,
            fadeOutElapsed: 0,
            lastEventIndex: -1,
            started: false,
        };
    }

    #enqueue(slot: string, item: QueuedMotion): void {
        const q = this.#queues.get(slot) ?? [];
        q.push(item);
        this.#queues.set(slot, q);
    }

    #enqueueFront(slot: string, item: QueuedMotion): void {
        const q = this.#queues.get(slot) ?? [];
        q.unshift(item);
        this.#queues.set(slot, q);
    }

    #stopOne(a: ActiveMotion, fade: boolean): void {
        if (!fade || a.fadeOutTime <= 0) {
            this.#finish(a, true);
            return;
        }
        a.fadingOut = true;
        a.fadeOutElapsed = 0;
    }

    #finish(a: ActiveMotion, promoteQueue: boolean): void {
        if (this.#slots.get(a.slot) !== a) return;
        this.#slots.delete(a.slot);
        this.#handlers.onFinish?.({
            group: a.group,
            index: a.index,
            slot: a.slot,
        });
        if (!promoteQueue) return;
        const q = this.#queues.get(a.slot);
        const next = q?.shift();
        if (next) {
            this.#slots.set(
                a.slot,
                this.#createActive(
                    a.slot,
                    next.group,
                    next.index,
                    next.clip,
                    next.options,
                ),
            );
        }
    }

    #sample(
        a: ActiveMotion,
        playTime: number,
        weight: number,
    ): MotionApplySample[] {
        const values = evaluateMotion3(a.clip, playTime);
        return values.map((v) => ({
            target: v.target,
            id: v.id,
            value: v.value,
            weight,
        }));
    }

    #fadeWeight(a: ActiveMotion): number {
        let w = 1;
        if (a.fadeInTime > 0 && a.time < a.fadeInTime) {
            w = sineEase(a.time / a.fadeInTime);
        }
        if (a.fadingOut && a.fadeOutTime > 0) {
            const u = 1 - a.fadeOutElapsed / a.fadeOutTime;
            w *= sineEase(Math.max(0, u));
        }
        return w;
    }

    #emitEvents(a: ActiveMotion, playTime: number): void {
        const events = a.clip.userData;
        for (let i = a.lastEventIndex + 1; i < events.length; i += 1) {
            const e = events[i]!;
            if (e.time > playTime) break;
            a.lastEventIndex = i;
            this.#handlers.onEvent?.({
                group: a.group,
                index: a.index,
                slot: a.slot,
                time: e.time,
                value: e.value,
            });
        }
        if (a.loop && a.clip.duration > 0) {
            const prevMod =
                ((a.time - 1e-6) % a.clip.duration) +
                (a.time - 1e-6 < 0 ? a.clip.duration : 0);
            if (playTime < prevMod - 1e-4) {
                a.lastEventIndex = -1;
            }
        }
    }
}

/** Blend layers low→high priority; later layers lerp over earlier by their weight. */
export function blendMotionLayers(
    layers: ReadonlyArray<{
        priority: number;
        samples: readonly MotionApplySample[];
    }>,
): MotionApplySample[] {
    const map = new Map<
        string,
        {
            target: MotionApplySample["target"];
            id: string;
            value: number;
            weight: number;
        }
    >();
    for (const layer of layers) {
        for (const s of layer.samples) {
            const key = `${s.target}\0${s.id}`;
            const w = Math.min(1, Math.max(0, s.weight));
            const prev = map.get(key);
            if (!prev) {
                map.set(key, {
                    target: s.target,
                    id: s.id,
                    value: s.value,
                    weight: w,
                });
            } else {
                prev.value = prev.value + (s.value - prev.value) * w;
                prev.weight = Math.min(1, prev.weight + w * (1 - prev.weight));
            }
        }
    }
    return [...map.values()];
}

function sineEase(t: number): number {
    const x = Math.min(1, Math.max(0, t));
    return 0.5 - 0.5 * Math.cos(x * Math.PI);
}
