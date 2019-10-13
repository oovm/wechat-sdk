/** Model binary family (file extension / settings shape). */
export type ModelFormat = "moc2" | "moc3";

/** Normalized, format-agnostic model settings. */
export interface ModelSettings {
    format: ModelFormat;
    url: string;
    name?: string;
    moc: string;
    textures: string[];
    motionGroups: Record<string, MotionDefinition[]>;
    expressions: ExpressionDefinition[];
    physics?: string;
    pose?: string;
    hitAreas: HitAreaDefinition[];
    layout?: Record<string, number>;
}

export interface MotionDefinition {
    file: string;
    sound?: string;
    fadeInTime?: number;
    fadeOutTime?: number;
}

export interface ExpressionDefinition {
    name: string;
    file: string;
}

export interface HitAreaDefinition {
    name: string;
    id: string;
}

/** Opaque in-memory model handle. */
export interface InternalModel {
    readonly id: string;
    readonly settings: ModelSettings;
    readonly format: ModelFormat;
}
