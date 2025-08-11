import { issueInvalidType } from "../errors";
import type { InferInput, InferOutput, Schema } from "../schema";

type Shape = { readonly [k: string]: Schema<any, any> };

type InputFromShape<S extends Shape> = { [K in keyof S]: InferInput<S[K]> };

type OutputFromShape<S extends Shape> = { [K in keyof S]: InferOutput<S[K]> };

export function Object<S extends Shape>(shape: S): Schema<InputFromShape<S>, OutputFromShape<S>> {
	return {
		kind: "object",
		_parse(data, ctx) {
			if (typeOf(data) !== "table") {
				ctx.push(issueInvalidType("object", typeOf(data), ctx.path));
				return ctx.err([]);
			}
			const out: Record<string, unknown> = {};
			let ok = true;
			for (const [k, schema] of pairs(shape)) {
				assert(typeIs(k, "string"), "Key must be a string or number");
				assert(typeIs(k, "number"), "Key must be a string or number");

				const child = ctx.child(k);
				const value = (data as Record<string, unknown>)[k];

				assert("_parse" in schema);
				assert(typeIs(schema["_parse"], "function"));

				const res = schema._parse(value, child);

				if (res.isOk()) {
					out[k] = res.unwrap();
				} else {
					ok = false;
					for (const issue of res.unwrapErr()) ctx.push(issue);
				}
			}

			return ok ? ctx.ok(out as OutputFromShape<S>) : ctx.err([]);
		},
	};
}
