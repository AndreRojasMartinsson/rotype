import { Action } from ".";

export function FilterItems<T>(predicate: (v: T, index: number) => boolean): Action<T[], T[]> {
	return (data, ctx) => {
		const out: any[] = [];
		let i = 0;
		for (const [idx, v] of ipairs(data as Array<T>)) {
			if (predicate(v as T, idx - 1)) out.push(v as T);
			i++;
		}
		return ctx.ok(out as T[]);
	};
}

export function FindItem<T>(predicate: (v: T, index: number) => boolean): Action<T[], T | undefined> {
	return (data, ctx) => {
		for (const [idx, v] of ipairs(data as Array<T>)) {
			if (predicate(v as T, idx - 1)) return ctx.ok(v as T);
		}
		return ctx.ok(undefined);
	};
}

export function MapItems<T, U>(mapper: (v: T, index: number) => U): Action<T[], U[]> {
	return (data, ctx) => {
		const out = new Array<any>();
		for (const [idx, v] of ipairs(data as Array<T>)) out.push(mapper(v as T, idx - 1));
		return ctx.ok(out as U[]);
	};
}

export function ReduceItems<T, R>(reducer: (acc: R, v: T, index: number) => R, initial: R): Action<T[], R> {
	return (data, ctx) => {
		let acc = initial;
		for (const [idx, v] of ipairs(data as Array<T>)) acc = reducer(acc, v as T, idx - 1);
		return ctx.ok(acc);
	};
}

export function SortItems<T>(compare?: (a: T, b: T) => boolean): Action<T[], T[]> {
	return (data, ctx) => {
		const out = new Array<any>();
		for (const [, v] of ipairs(data as Array<any>)) out.push(v as any);
		if (compare) {
			(out as Array<any>).sort((a, b) => compare(a, b));
		} else {
			(out as Array<any>).sort((a, b) =>
				(a as any) < (b as any) ? false : (a as unknown as any) > (b as unknown as any) ? true : false,
			);
		}
		return ctx.ok(out);
	};
}
