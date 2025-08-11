import { Ctx } from "../context";
import { Issue, issueInvalidType, Path } from "../errors";
import { Result } from "../result";
import type { InferInput, InferOutput, Schema } from "../schema";
import { Optional } from "../schemas";

import { Array } from "../schemas/array";
import { Object } from "../schemas/object";

export type Action<I, O> = (data: I, ctx: Ctx) => Result<O, Issue[]>;

export function Pipe<I, O>(schema: Schema<I, O>, ...actions: Action<O, any>[]): Schema<I, any> {
	return {
		kind: `pipe(${schema.kind})`,
		_parse(data, ctx) {
			const base = schema._parse(data, ctx);
			if (base.isErr()) return base;

			let current: any = base.unwrap();
			for (const action of actions) {
				const res = action(current, ctx);
				if (res.isErr()) return res;

				current = res.unwrap();
			}

			return ctx.ok(current);
		},
	};
}

function tooSmall(path: Path, message: string): Issue {
	return { code: "too_small", message, path };
}
function tooBig(path: Path, message: string): Issue {
	return { code: "too_big", message, path };
}
function custom(path: Path, message: string): Issue {
	return { code: "custom", message, path };
}

function matchLuaPattern(str: string, pat: string): boolean {
	// We assume pat is already a Lua pattern string. For simple use-cases only.
	return (str as unknown as string).match(pat as unknown as any) !== undefined;
}

export function Trim(): Action<string, string> {
	return (data, ctx) => ctx.ok((data as string).gsub("%s+", "")[0] as unknown as string);
}

export function TrimStart(): Action<string, string> {
	return (data, ctx) => ctx.ok((data as string).gsub("^%s+", "")[0] as unknown as string);
}

export function TrimEnd(): Action<string, string> {
	return (data, ctx) => ctx.ok((data as string).gsub("%s+$", "")[0] as unknown as string);
}

export function Regex(pat: string, message = "Invalid format"): Action<string, string> {
	return (data, ctx) => (matchLuaPattern(data, pat) ? ctx.ok(data) : ctx.err([custom(ctx.path, message)]));
}

export function MinLength(min: number): Action<string | Array<unknown>, any> {
	return (data, ctx) => {
		const len = typeIs(data, "string") ? data.size() : (data as Array<unknown>).size();
		return len >= min ? ctx.ok(data) : ctx.err([tooSmall(ctx.path, `Expected length >= ${min}`)]);
	};
}

export function MaxLength(max: number): Action<string | Array<unknown>, any> {
	return (data, ctx) => {
		const len = typeIs(data, "string") ? data.size() : (data as Array<unknown>).size();
		return len <= max ? ctx.ok(data) : ctx.err([tooBig(ctx.path, `Expected length <= ${max}`)]);
	};
}

export function NonEmpty(): Action<string | Array<unknown>, any> {
	return MinLength(1);
}

export function ToLowerCase(): Action<string, string> {
	return (d, ctx) => ctx.ok((d as string).lower());
}
export function ToUpperCase(): Action<string, string> {
	return (d, ctx) => ctx.ok((d as string).upper());
}

// ---- number actions ----
export function MinValue(min: number): Action<number, number> {
	return (data, ctx) => (data >= min ? ctx.ok(data) : ctx.err([tooSmall(ctx.path, `Expected >= ${min}`)]));
}

export function MaxValue(max: number): Action<number, number> {
	return (data, ctx) => (data <= max ? ctx.ok(data) : ctx.err([tooBig(ctx.path, `Expected <= ${max}`)]));
}

export function MultipleOf(step: number): Action<number, number> {
	return (data, ctx) =>
		data % step === 0
			? ctx.ok(data)
			: ctx.err([{ code: "not_multiple_of", message: `Expected multiple of ${step}`, path: ctx.path }]);
}

export function Integer(): Action<number, number> {
	return (data, ctx) =>
		math.floor(data) === data
			? ctx.ok(data)
			: ctx.err([{ code: "not_integer", message: "Expected integer", path: ctx.path }]);
}

export function Finite(): Action<number, number> {
	return (data, ctx) =>
		data === data && data < math.huge && data > -math.huge
			? ctx.ok(data)
			: ctx.err([{ code: "not_finite", message: "Expected finite number", path: ctx.path }]);
}

export function Transform<I, O>(fn: (v: I) => O): Action<I, O> {
	return (d, ctx) => ctx.ok(fn(d as I));
}

export function Check<I>(predicate: (v: I) => boolean, message = "Validation failed"): Action<I, I> {
	return (data, ctx) => (predicate(data as I) ? ctx.ok(data as I) : ctx.err([custom(ctx.path, message)]));
}

export function Record<VS extends Schema<any, any>>(
	valueSchema: VS,
): Schema<Record<string, InferInput<VS>>, Record<string, InferOutput<VS>>> {
	return {
		kind: "record",
		_parse(data, ctx) {
			if (typeOf(data) !== "table") {
				ctx.push(issueInvalidType("object", typeOf(data), ctx.path));
				return ctx.err([]);
			}
			const out: Record<string, unknown> = {};
			let ok = true;
			for (const [k, v] of pairs(data as Record<string, unknown>)) {
				const child = ctx.child(k);
				const res = valueSchema._parse(v, child);
				if (res.isOk()) out[k] = res.unwrap();
				else {
					ok = false;
					for (const issue of res.unwrapErr()) ctx.push(issue);
				}
			}
			return ok ? ctx.ok(out as Record<string, InferOutput<VS>>) : ctx.err([]);
		},
	};
}

// intersection: both schemas must pass; merge object outputs if both are objects
export function Intersection<A extends Schema<any, any>, B extends Schema<any, any>>(
	a: A,
	b: B,
): Schema<InferInput<A> & InferInput<B>, InferOutput<A> & InferOutput<B>> {
	return {
		kind: `intersection(${a.kind}&${b.kind})`,
		_parse(data, ctx) {
			const r1 = a._parse(data, ctx);
			if (!r1.isOk()) return r1;
			const r2 = b._parse(data, ctx);
			if (!r2.isOk()) return r2;
			const v1 = r1.unwrap();
			const v2 = r2.unwrap();

			if (typeOf(v1) === "table" && typeOf(v2) === "table") {
				const out: Record<string, unknown> = {};
				for (const [k, v] of pairs(v1)) out[k as string] = v;
				for (const [k, v] of pairs(v2)) out[k as string] = v;
				return ctx.ok(out);
			}
			// default: prefer second schema's value
			return ctx.ok(r2.unwrap());
		},
	};
}

// merge: object-specific intersection with right wins
export function Merge<A extends Schema<Record<string, any>, any>, B extends Schema<Record<string, any>, any>>(
	a: A,
	b: B,
): Schema<InferInput<A> & InferInput<B>, InferOutput<A> & InferOutput<B>> {
	return {
		kind: `merge(${a.kind}+${b.kind})`,
		_parse(data, ctx) {
			const r1 = a._parse(data, ctx);
			const r2 = b._parse(data, ctx);
			if (!r1.isOk()) return r1 as any;
			if (!r2.isOk()) return r2 as any;
			const out: Record<string, unknown> = {};
			for (const [k, v] of pairs(r1.unwrap() as Record<string, unknown>)) out[k as string] = v;
			for (const [k, v] of pairs(r2.unwrap() as Record<string, unknown>)) out[k as string] = v; // right wins
			return ctx.ok(out as any);
		},
	};
}

export function Enumerations<T extends readonly string[]>(values: T): Schema<T[number]> {
	const set = new Set<string>(values as unknown as Array<string>);
	return {
		kind: "enum",
		_parse(data, ctx) {
			if (typeOf(data) !== "string") {
				ctx.push(issueInvalidType("string", typeOf(data), ctx.path));
				return ctx.err([]);
			}
			if (set.has(data as string)) return ctx.ok(data as T[number]);
			ctx.push({ code: "invalid_literal", message: `Expected one of ${values.join(", ")}`, path: ctx.path });
			return ctx.err([]);
		},
	};
}

export type Brand<B extends string, T> = T & { readonly __brand: B };
export type Flavor<F extends string, T> = T & { readonly __flavor?: F };

export function Brand<B extends string>(_: B): Action<any, Brand<B, any>> {
	// runtime no-op, type-level brand
	return (d, ctx) => ctx.ok(d as Brand<B, any>);
}

export function Flavor<F extends string>(_: F): Action<any, Flavor<F, any>> {
	// runtime no-op, type-level flavor
	return (d, ctx) => ctx.ok(d as Flavor<F, any>);
}

export function ReadonlyAction<T>(): Action<T, Readonly<T>> {
	return (d, ctx) => ctx.ok(d as Readonly<T>);
}
export { ReadonlyAction as readonly };

export function RawTransform<I, O>(fn: (v: I, ctx: Ctx) => Result<O, Issue[]>): Action<I, O> {
	return (d, ctx) => fn(d as I, ctx);
}

export function ToMinValue(min: number): Action<number, number> {
	return (d, ctx) => ctx.ok(math.max(d as number, min));
}
export function ToMaxValue(max: number): Action<number, number> {
	return (d, ctx) => ctx.ok(math.min(d as number, max));
}

export function Clamp(min: number, max: number): Action<number, number> {
	return (d, ctx) => ctx.ok(math.clamp(d as number, min, max));
}

export function Abs(): Action<number, number> {
	return (d, ctx) => ctx.ok(math.abs(d as number));
}

export function DeepPartial<S extends Schema<any, any>>(schema: S): Schema<any, any> {
	if (schema.shape) {
		const shape = schema.shape;
		const newShape: Record<string, Schema<any, any>> = {};
		for (const [k, v] of pairs(shape)) {
			newShape[k] = Optional(DeepPartial(v));
		}
		return Object(newShape);
	}

	if (schema.item) {
		const item = schema.item;
		return Array(DeepPartial(item));
	}
	return schema;
}

export function DeepRequired<S extends Schema<any, any>>(schema: S): Schema<any, any> {
	if (schema.shape) {
		const shape = schema.shape;
		const newShape: Record<string, Schema<any, any>> = {};
		for (const [k, v] of pairs(shape)) {
			let inner = DeepRequired(v);
			// strip optional
			if (inner.kind === "optional") inner = inner.inner ?? inner;
			newShape[k] = inner;
		}
		return Object(newShape);
	}
	if (schema.item) {
		const item = schema.item;
		return Array(DeepRequired(item));
	}
	return schema;
}
