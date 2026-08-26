export type ExpressionBlendMode = "Add" | "Multiply" | "Override";

export interface Expression3Parameter {
    readonly id: string;
    readonly value: number;
    readonly blend: ExpressionBlendMode;
}

/** Parsed Cubism `exp3.json`. */
export interface Expression3Clip {
    readonly version: number;
    readonly parameters: readonly Expression3Parameter[];
}
