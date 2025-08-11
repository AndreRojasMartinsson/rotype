import { issueInvalidType } from "../errors";
import { CreateTypeOf, Schema } from "../schema";

export * from "./array";
export * from "./object";
export * from "./roblox";

export const String = CreateTypeOf("string");
export const Number = CreateTypeOf("number");
export const Boolean = CreateTypeOf("boolean");
export const Thread = CreateTypeOf("thread");
export const Vector = CreateTypeOf("vector");
export const Buffer = CreateTypeOf("buffer");

export function Function(): Schema<Callback> {
	return {
		kind: "function",
		_parse(data, ctx) {
			if (typeOf(data) === "function") return ctx.ok(data);
			ctx.push(issueInvalidType("function", typeOf(data), ctx.path));
			return ctx.err([]);
		},
	};
}

export function Undefined(): Schema<undefined> {
	return {
		kind: "undefined",
		_parse(data, ctx) {
			if (data === undefined) return ctx.ok(undefined);
			ctx.push(issueInvalidType("undefined", typeOf(data), ctx.path));
			return ctx.err([]);
		},
	};
}

export function Literal<T extends string | number | boolean>(value: T): Schema<T> {
	return {
		kind: "literal",
		_parse(data, ctx) {
			if (data === value) return ctx.ok(value);
			ctx.push({ code: "invalid_literal", message: `Expected literal ${tostring(value)}`, path: ctx.path });
			return ctx.err([]);
		},
	};
}
