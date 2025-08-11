import { issueInvalidType } from "../errors";
import { Schema } from "../schema";

export function string(): Schema<string> {
	return {
		kind: "string",
		_parse(data, ctx) {
			if (typeIs(data, "string")) return ctx.ok(data);

			ctx.push(issueInvalidType("string", typeOf(data), ctx.path));
			return ctx.err([]);
		},
	};
}
