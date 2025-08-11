import { Ctx, makeCtx } from "./context";
import { Issue } from "./errors";
import { Result } from "./result";

export interface Schema<I, O = I> {
	kind: string;
	_parse(data: unknown, ctx: Ctx): Result<O, Issue[]>;
}

export type InferInput<S> = S extends Schema<infer I, unknown> ? I : never;
export type InferOutput<S> = S extends Schema<unknown, infer O> ? O : never;

export function parse<S extends Schema<any, any>>(schema: S, data: unknown): Result<InferOutput<S>, Issue[]> {
	const ctx = makeCtx();
	const res = schema._parse(data, ctx);

	return res;
}

export function is<S extends Schema<any, any>>(schema: S, data: unknown): data is InferOutput<S> {
	const ctx = makeCtx();

	return schema._parse(data, ctx).isOk();
}
