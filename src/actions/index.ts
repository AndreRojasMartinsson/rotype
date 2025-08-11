import { Ctx } from "../context";
import { Issue, issueInvalidType, Path } from "../errors";
import { Result } from "../result";
import type { InferInput, InferOutput, Schema } from "../schema";

export type Action<I, O> = (data: I, ctx: Ctx) => Result<O, Issue[]>;

export function pipe<I, O>(schema: Schema<I, O>, ...actions: Action<O, any>[]): Schema<I, any> {
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

export function regex(pat: string, message = "Invalid format"): Action<string, string> {
	return (data, ctx) => (matchLuaPattern(data, pat) ? ctx.ok(data) : ctx.err([custom(ctx.path, message)]));
}

export function minLength(min: number): Action<string | Array<unknown>, any> {
	return (data, ctx) => {
		const len = typeIs(data, "string") ? data.size() : (data as Array<unknown>).size();
		return len >= min ? ctx.ok(data) : ctx.err([tooSmall(ctx.path, `Expected length >= ${min}`)]);
	};
}

export function maxLength(max: number): Action<string | Array<unknown>, any> {
	return (data, ctx) => {
		const len = typeIs(data, "string") ? data.size() : (data as Array<unknown>).size();
		return len <= max ? ctx.ok(data) : ctx.err([tooBig(ctx.path, `Expected length <= ${max}`)]);
	};
}

export function nonEmpty(): Action<string | Array<unknown>, any> {
	return minLength(1);
}

export function toLowerCase(): Action<string, string> {
	return (d, ctx) => ctx.ok((d as string).lower());
}
export function toUpperCase(): Action<string, string> {
	return (d, ctx) => ctx.ok((d as string).upper());
}

// ---- number actions ----
export function minValue(min: number): Action<number, number> {
	return (data, ctx) => (data >= min ? ctx.ok(data) : ctx.err([tooSmall(ctx.path, `Expected >= ${min}`)]));
}

export function maxValue(max: number): Action<number, number> {
	return (data, ctx) => (data <= max ? ctx.ok(data) : ctx.err([tooBig(ctx.path, `Expected <= ${max}`)]));
}

export function multipleOf(step: number): Action<number, number> {
	return (data, ctx) =>
		data % step === 0
			? ctx.ok(data)
			: ctx.err([{ code: "not_multiple_of", message: `Expected multiple of ${step}`, path: ctx.path }]);
}

export function integer(): Action<number, number> {
	return (data, ctx) =>
		math.floor(data) === data
			? ctx.ok(data)
			: ctx.err([{ code: "not_integer", message: "Expected integer", path: ctx.path }]);
}

export function finite(): Action<number, number> {
	return (data, ctx) =>
		data === data && data < math.huge && data > -math.huge
			? ctx.ok(data)
			: ctx.err([{ code: "not_finite", message: "Expected finite number", path: ctx.path }]);
}

export function transform<I, O>(fn: (v: I) => O): Action<I, O> {
	return (d, ctx) => ctx.ok(fn(d as I));
}

export function check<I>(predicate: (v: I) => boolean, message = "Validation failed"): Action<I, I> {
	return (data, ctx) => (predicate(data as I) ? ctx.ok(data as I) : ctx.err([custom(ctx.path, message)]));
}

export function record<VS extends Schema<any, any>>(
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

export function enums<T extends readonly string[]>(values: T): Schema<T[number]> {
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
