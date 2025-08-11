import { Issue, issueInvalidType } from "../errors";
import type { InferInput, InferOutput, Schema } from "../schema";

export function Array<T extends Schema<any, any>>(item: T): Schema<Array<InferInput<T>>, Array<InferOutput<T>>> {
	return {
		kind: "array",
		item,
		_parse(data, ctx) {
			if (typeOf(data) !== "table") {
				ctx.push(issueInvalidType("array", typeOf(data), ctx.path));
				return ctx.err([]);
			}
			const out: unknown[] = [];
			let i = 0;
			let ok = true;
			for (const [idx, val] of ipairs(data as Array<unknown>)) {
				const child = ctx.child(idx - 1); // zero-based for TS ergonomics
				const res = item._parse(val, child);

				if (res.isOk()) {
					out[i] = res.unwrap();
				} else {
					ok = false;

					for (const issue of res.unwrapErr()) ctx.push(issue);
				}

				i++;
			}

			return ok ? ctx.ok(out as Array<InferOutput<T>>) : ctx.err([]);
		},
	};
}

export function Tuple<T extends Schema<any, any>[]>(
	...items: T
): Schema<{ [K in keyof T]: InferInput<T[K]> }, { [K in keyof T]: InferOutput<T[K]> }> {
	return {
		kind: "tuple",
		_parse(data, ctx) {
			if (typeOf(data) !== "table") {
				ctx.push(issueInvalidType("tuple", typeOf(data), ctx.path));
				return ctx.err([]);
			}

			const out: unknown[] = [];
			let i = 0;
			let ok = true;
			for (const [idx, val] of ipairs(data as Array<unknown>)) {
				const child = ctx.child(idx - 1);
				const item = items[idx];
				const res = item._parse(val, child);

				if (res.isOk()) {
					out[i] = res.unwrap();
				} else {
					ok = false;
					for (const issue of res.unwrapErr()) ctx.push(issue);
				}

				i++;
			}

			return ok ? ctx.ok(out as { [K in keyof T]: InferOutput<T[K]> }) : ctx.err([]);
		},
	};
}

export function Union<T extends readonly Schema<any, any>[]>(
	...members: T
): Schema<InferInput<T[number]>, InferOutput<T[number]>> {
	return {
		kind: "union",
		_parse(data, ctx) {
			const subIssues: Issue[][] = [];
			for (const schema of members) {
				const res = schema._parse(data, ctx);
				if (res.isOk()) return ctx.ok(res.unwrap() as InferOutput<T[number]>);

				subIssues.push(res.unwrapErr());
			}

			ctx.push({ code: "invalid_union", message: "No union member matched", path: ctx.path });

			// flatten member issues to help debugging
			for (const issues of subIssues) for (const it of issues) ctx.push(it);
			return ctx.err([]);
		},
	};
}

export function Optional<S extends Schema<any, any>>(
	schema: S,
): Schema<InferInput<S> | undefined, InferOutput<S> | undefined> {
	return {
		kind: "optional",
		inner: schema,
		_parse(data, ctx) {
			if (data === undefined) return ctx.ok(undefined);
			return schema._parse(data, ctx);
		},
	};
}
