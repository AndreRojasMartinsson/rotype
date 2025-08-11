export type IssueCode =
	| "invalid_type"
	| "invalid_literal"
	| "invalid_union"
	| "too_small"
	| "too_big"
	| "not_multiple_of"
	| "not_integer"
	| "not_finite"
	| "empty"
	| "custom";

export type Path = Array<string | number>;

export interface Issue {
	code: IssueCode;
	message: string;
	path: Path;
}

export class RoTypeError {
	public name: string;
	public message: string;

	constructor(public issues: Issue[]) {
		this.message = issues[0]?.message ?? "Validation Error";
		this.name = "RoTypeError";
	}
}
