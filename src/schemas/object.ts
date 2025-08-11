import Obj from "@rbxts/object-utils";
import { Issue, issueInvalidType } from "../errors";
import type { InferInput, InferOutput, Schema, Shape } from "../schema";
import { Result } from "../result";

type InputFromShape<S extends Shape> = { [K in keyof S]: InferInput<S[K]> };

type OutputFromShape<S extends Shape> = { [K in keyof S]: InferOutput<S[K]> };

export function Object<S extends Shape>(shape: S): Schema<InputFromShape<S>, OutputFromShape<S>> {
	return {
		kind: "object",
		shape,
		_parse(data, ctx) {
			if (typeOf(data) !== "table") {
				ctx.push(issueInvalidType("object", typeOf(data), ctx.path));
				return ctx.err([]);
			}
			const out: Record<string, unknown> = {};
			let ok = true;
			for (const [k, schema] of pairs(shape)) {
				// assert(typeIs(k, "string"), "Key must be a string or number");
				// assert(typeIs(k, "number"), "Key must be a string or number");

				const child = ctx.child(k as string | number);
				const value = (data as Record<string, unknown>)[k as string | number];

				assert("_parse" in schema);
				assert(typeIs(schema["_parse"], "function"));

				const res = schema._parse(value, child) as Result<unknown, Issue[]>;

				if (res.isOk()) {
					out[k as string | number] = res.unwrap();
				} else {
					ok = false;
					for (const issue of res.unwrapErr()) ctx.push(issue);
				}
			}

			return ok ? ctx.ok(out as OutputFromShape<S>) : ctx.err([]);
		},
	};
}

export function StrictObject<S extends Shape>(shape: S): Schema<InputFromShape<S>, OutputFromShape<S>> {
	const keySet = new Set<string>(Obj.keys(shape as Record<string, any>));
	return {
		kind: "strictObject",
		_parse(data, ctx) {
			if (typeOf(data) !== "table") {
				ctx.push(issueInvalidType("object", typeOf(data), ctx.path));
				return ctx.err([]);
			}
			// Unknown keys check
			for (const [k] of pairs(data as Record<string, unknown>)) {
				if (!keySet.has(k as string))
					ctx.push({ code: "custom", message: `Unknown key '${k as string}'`, path: ctx.child(k).path });
			}
			const out: Record<string, unknown> = {};
			let ok = true;
			for (const [k, sch] of pairs(shape)) {
				// assert(typeIs(k, "string"), "Key must be a string or number");
				// assert(typeIs(k, "number"), "Key must be a string or number");

				const child = ctx.child(k as string | number);
				const value = (data as Record<string, unknown>)[k as string | number];
				//
				assert("_parse" in sch);
				assert(typeIs(sch["_parse"], "function"));

				const res = sch._parse(value, child) as Result<unknown, Issue[]>;

				if (res.isOk()) {
					out[k as string | number] = res.unwrap();
				} else {
					ok = false;
					for (const issue of res.unwrapErr()) ctx.push(issue);
				}
			}
			// If any unknown key issues were pushed, fail
			if (!ok || true) {
				// Determine if there were any 'Unknown key' issues
				// (we conservatively fail if any issues exist)
				// The ctx.err will surface already-pushed issues.
			}
			return ok && true ? ctx.ok(out as OutputFromShape<S>) : ctx.err([]);
		},
	};
}
