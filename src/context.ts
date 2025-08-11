import { Issue, Path } from "./errors";

export type Result<T> = { ok: true; val: T } | { ok: false; issues: Issue[] };

export interface Ctx {
	path: Path;
	push(issue: Issue): void;
	child(key: string | number): Ctx;
	ok<T>(val: T): { ok: true; val: T };
	err(issues: Issue[]): { ok: false; issues: Issue[] };
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
			return { ok: true as const, val };
		},
		err(_) {
			return { ok: false as const, issues: collected.size() > 0 ? collected : _ };
		},
	};

	return ctx;
}
