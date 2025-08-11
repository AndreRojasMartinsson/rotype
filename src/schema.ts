import { Ctx, makeCtx } from "./context";
import { Issue, issueInvalidType } from "./errors";
import { Result } from "./result";

export type Shape = { readonly [k: string]: Schema<any, any> };

export interface Schema<I, O = I> {
	kind: string;
	shape?: Shape;
	inner?: Schema<any, any>;
	item?: Schema<any, any>;
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

export function CreateTypeOf<T extends keyof CheckableTypes>(typeName: T) {
	return function (): Schema<T> {
		return {
			kind: typeName,
			_parse(data, ctx) {
				if (typeIs(data, typeName)) return ctx.ok(data);

				ctx.push(issueInvalidType(typeName, typeOf(data), ctx.path));
				return ctx.err([]);
			},
		};
	};
}
