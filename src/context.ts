import { Issue, Path } from "./errors";
import { Result } from "./result";

export interface Ctx {
	path: Path;
	push(issue: Issue): void;
	child(key: string | number): Ctx;
	ok<T>(val: T): Result<T, Issue[]>;
	err(issues: Issue[]): Result<any, Issue[]>;
}

export function makeCtx(basePath: Path = []): Ctx {
	const collected: Issue[] = [];
	const ctx: Ctx = {
		path: basePath,
		push(issue) {
			collected.push(issue);
		},
		child(key) {
			return makeCtx([...basePath, key]);
		},
		ok(val) {
			return Result.ok(val);
		},
		err(_) {
			return Result.err(collected.size() > 0 ? collected : _);
		},
	};

	return ctx;
}
