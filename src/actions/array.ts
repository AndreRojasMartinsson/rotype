import { Action } from ".";

export function FilterItems<T>(predicate: (v: T, index: number) => boolean): Action<T[], T[]> {
	return (data, ctx) => {
		const out: defined[] = [];
		let i = 0;
		for (const [idx, v] of ipairs(data as Array<unknown>)) {
			if (predicate(v as T, idx - 1)) out.push(v as defined);
			i++;
		}
		return ctx.ok(out as T[]);
	};
}

export function FindItem<T>(predicate: (v: T, index: number) => boolean): Action<T[], T | undefined> {
	return (data, ctx) => {
		for (const [idx, v] of ipairs(data as Array<unknown>)) {
			if (predicate(v as T, idx - 1)) return ctx.ok(v as T);
		}
		return ctx.ok(undefined);
	};
}

export function MapItems<T, U>(mapper: (v: T, index: number) => U): Action<T[], U[]> {
	return (data, ctx) => {
		const out = new Array<defined>();
		for (const [idx, v] of ipairs(data as Array<unknown>)) out.push(mapper(v as T, idx - 1) as defined);
		return ctx.ok(out as U[]);
	};
}

export function ReduceItems<T, R>(reducer: (acc: R, v: T, index: number) => R, initial: R): Action<T[], R> {
	return (data, ctx) => {
		let acc = initial;
		for (const [idx, v] of ipairs(data as Array<unknown>)) acc = reducer(acc, v as T, idx - 1);
		return ctx.ok(acc);
	};
}
