import { Ctx, Result } from "./context";

export interface Schema<I, O = I> {
	kind: string;
	_parse(data: unknown, ctx: Ctx): Result<O>;
}

export type InferInput<S> = S extends Schema<infer I, unknown> ? I : never;
export type InferOutput<S> = S extends Schema<unknown, infer O> ? O : never;
