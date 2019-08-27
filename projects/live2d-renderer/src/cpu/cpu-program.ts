import type {
    DrawableProgram,
    ModelProgram,
    ParameterProgram,
} from "@doki-land/live2d-core";

const CPU_PROGRAM_KIND = "cpu-program" as const;

export interface CpuProgramFile {
    readonly kind: typeof CPU_PROGRAM_KIND;
    readonly version: 1;
    readonly program: {
        readonly format: "moc2" | "moc3";
        readonly parameters: readonly ParameterProgram[];
        readonly drawables: readonly {
            readonly index: number;
            readonly textureIndex: number;
            readonly positions: number[];
            readonly uvs: number[];
            readonly indices: number[];
            readonly opacity: number;
            readonly renderOrder: number;
            readonly blendMode?: number;
            readonly invertedMask?: boolean;
            readonly maskIndices?: number[];
            readonly visible?: boolean;
            readonly deformParamIndex: number;
            readonly deformDeltas: number[] | null;
        }[];
    };
}

function assert(cond: unknown, message: string): asserts cond {
    if (!cond) {
        throw new Error(`@doki-land/live2d-renderer: ${message}`);
    }
}

/** Build a minimal one-quad CPU program for fixtures / homepage. */
export function createQuadProgram(
    options: {
        parameterId?: string;
        /** Delta applied to top-right vertex at param max (x,y). */
        topRightDelta?: readonly [number, number];
    } = {},
): ModelProgram {
    const parameterId = options.parameterId ?? "PARAM_ANGLE_X";
    const [dx, dy] = options.topRightDelta ?? [0.25, 0.1];

    const parameters: ParameterProgram[] = [
        {
            id: parameterId,
            min: -1,
            max: 1,
            defaultValue: 0,
        },
    ];

    const positions = new Float32Array([
        -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    ]);
    const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const deformDeltas = new Float32Array(8);
    deformDeltas[4] = dx;
    deformDeltas[5] = dy;

    const drawable: DrawableProgram = {
        index: 0,
        textureIndex: 0,
        positions,
        uvs,
        indices,
        opacity: 1,
        renderOrder: 0,
        blendMode: 0,
        invertedMask: false,
        maskIndices: [],
        visible: true,
        deformParamIndex: 0,
        deformDeltas,
    };

    return {
        format: "moc3",
        codec: "cpu-program",
        parameters,
        drawables: [drawable],
    };
}

/** Serialize a CPU ModelProgram to UTF-8 JSON bytes. */
export function serializeCpuProgram(program: ModelProgram): ArrayBuffer {
    assert(
        program.codec === "cpu-program",
        "serializeCpuProgram expects codec cpu-program",
    );
    const file: CpuProgramFile = {
        kind: CPU_PROGRAM_KIND,
        version: 1,
        program: {
            format: program.format,
            parameters: program.parameters,
            drawables: program.drawables.map((d) => ({
                index: d.index,
                textureIndex: d.textureIndex,
                positions: [...d.positions],
                uvs: [...d.uvs],
                indices: [...d.indices],
                opacity: d.opacity,
                renderOrder: d.renderOrder,
                blendMode: d.blendMode,
                invertedMask: d.invertedMask,
                maskIndices: [...d.maskIndices],
                visible: d.visible,
                deformParamIndex: d.deformParamIndex,
                deformDeltas: d.deformDeltas ? [...d.deformDeltas] : null,
            })),
        },
    };
    return new TextEncoder().encode(`${JSON.stringify(file, null, 2)}\n`)
        .buffer;
}

export function isCpuProgramBytes(bytes: ArrayBuffer): boolean {
    try {
        const text = new TextDecoder().decode(bytes).trimStart();
        if (!text.startsWith("{")) return false;
        const parsed = JSON.parse(text) as { kind?: string };
        return parsed.kind === CPU_PROGRAM_KIND;
    } catch {
        return false;
    }
}

/** Parse CPU program JSON bytes into a ModelProgram. */
export function parseCpuProgram(bytes: ArrayBuffer): ModelProgram {
    let file: CpuProgramFile;
    try {
        file = JSON.parse(new TextDecoder().decode(bytes)) as CpuProgramFile;
    } catch {
        throw new Error("@doki-land/live2d-renderer: invalid cpu-program JSON");
    }
    assert(file.kind === CPU_PROGRAM_KIND, "not a cpu-program file");
    assert(
        file.version === 1,
        `unsupported cpu-program version ${file.version}`,
    );
    assert(file.program, "cpu-program missing program");

    return {
        format: file.program.format,
        codec: "cpu-program",
        parameters: file.program.parameters,
        drawables: file.program.drawables.map((d) => ({
            index: d.index,
            textureIndex: d.textureIndex,
            positions: new Float32Array(d.positions),
            uvs: new Float32Array(d.uvs),
            indices: new Uint16Array(d.indices),
            opacity: d.opacity,
            renderOrder: d.renderOrder,
            blendMode: d.blendMode ?? 0,
            invertedMask: d.invertedMask ?? false,
            maskIndices: d.maskIndices ?? [],
            visible: d.visible ?? true,
            deformParamIndex: d.deformParamIndex,
            deformDeltas:
                d.deformDeltas === null
                    ? null
                    : new Float32Array(d.deformDeltas),
        })),
    };
}

export { CPU_PROGRAM_KIND };
