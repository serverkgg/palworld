import type { Bridge, BridgeExtractOptions } from "@serverkgg/bridge";
import { EDITION_VARIABLE, PalworldEdition } from "../shared";

export const BRIDGE_READ_LIMIT = 4 * 1024 * 1024;

export interface FakeFilesOptions {
	edition?: PalworldEdition;
	listLimit?: number;
	files?: Record<string, string>;
	archives?: Record<string, Record<string, string>>;
}

interface Extracted {
	path: string;
	destination: string;
	tree: boolean;
}

export interface FakeFiles {
	context: Bridge.Context;
	files: Map<string, string>;
	extracted: Extracted[];
	commands: string[][];
	logged: string[];
}

const globOf = (glob: string) => {
	const pattern = glob
		.split("**")
		.map((part) => {
			return part
				.split("*")
				.map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
				.join("[^/]*");
		})
		.join(".*");

	return new RegExp(`^${pattern}$`);
};

const nameOf = (path: string) => {
	return path.split("/").at(-1) ?? "";
};

const pathOf = (raw: string) => {
	const segments = raw.split("/").filter((segment) => segment.length > 0 && segment !== ".");

	if (segments.some((segment) => segment === ".." || segment.includes("\\"))) {
		throw new Error(`path "${raw}" is not allowed`);
	}

	return segments.join("/");
};

export const fakeFiles = (options: FakeFilesOptions = {}): FakeFiles => {
	const files = new Map(
		Object.entries(options.files ?? {}).map(([path, content]) => [
			pathOf(path),
			content,
		]),
	);
	const archives = options.archives ?? {};
	const extracted: Extracted[] = [];
	const commands: string[][] = [];
	const logged: string[] = [];

	const under = (raw: string) => {
		const path = pathOf(raw);

		return [
			...files.keys(),
		].filter((key) => path === "" || key === path || key.startsWith(`${path}/`));
	};

	const copyTree = (rawFrom: string, rawTo: string) => {
		const from = pathOf(rawFrom);
		const to = pathOf(rawTo);
		const keys = under(from);

		for (const key of keys) {
			files.set(`${to}${key.slice(from.length)}`, files.get(key) ?? "");
		}

		return keys.length > 0;
	};

	const foldersIn = (root: string) => {
		const folders = new Set<string>();

		for (const key of under(root)) {
			const [folder, ...rest] = key.slice(pathOf(root).length + 1).split("/");

			if (folder !== undefined && rest.length > 0) {
				folders.add(folder);
			}
		}

		return [
			...folders,
		];
	};

	const copy = (args: string[]) => {
		const [mode = "", first = "", ...rest] = args;

		if (mode === "-T") {
			return copyTree(first, rest[0] ?? "");
		}

		return mode === "-t" && rest.every((source) => copyTree(source, `${first}/${nameOf(source)}`));
	};

	const grep = (args: string[]) => {
		const pattern = new RegExp(args.at(-2) ?? "");
		const content = files.get(pathOf(args.at(-1) ?? ""));

		if (content === undefined) {
			return {
				stdout: "",
				stderr: "no such file",
				code: 2,
			};
		}

		const lines = content.split("\n").filter((line) => pattern.test(line));

		return {
			stdout: lines.map((line) => `${line}\n`).join(""),
			stderr: "",
			code: lines.length > 0 ? 0 : 1,
		};
	};

	for (const path of Object.keys(archives)) {
		files.set(path, "zip");
	}

	const context = {
		variable(key: string) {
			return key === EDITION_VARIABLE ? (options.edition ?? PalworldEdition.Windows) : null;
		},
		log(message: string) {
			logged.push(message);
		},
		async exec(command: string[]) {
			commands.push(command);

			const [program, flag, ...args] = command;

			if (program === "find" && flag !== undefined) {
				return {
					stdout: foldersIn(flag)
						.map((folder) => `${folder}\n`)
						.join(""),
					stderr: "",
					code: 0,
				};
			}

			if (program === "grep") {
				return grep(command);
			}

			const done = program === "cp" && flag === "-a" && copy(args);

			return {
				stdout: "",
				stderr: "",
				code: done ? 0 : 1,
			};
		},
		files: {
			async exists(path: string) {
				return under(path).length > 0;
			},
			async read(raw: string) {
				const content = files.get(pathOf(raw));

				if (content === undefined) {
					throw new Error(`missing ${raw}`);
				}

				if (content.length > BRIDGE_READ_LIMIT) {
					throw new Error(`path "${raw}" is larger than the read limit`);
				}

				return content;
			},
			async write(path: string, content: string) {
				files.set(pathOf(path), content);
			},
			async ensure(...paths: string[]) {
				for (const path of paths) {
					pathOf(path);
				}
			},
			async remove(raw: string) {
				if (pathOf(raw) === "") {
					throw new Error("the server directory cannot be removed");
				}

				for (const key of under(raw)) {
					files.delete(key);
				}
			},
			async move(rawFrom: string, rawTo: string) {
				const from = pathOf(rawFrom);
				const to = pathOf(rawTo);

				for (const key of under(from)) {
					files.set(`${to}${key.slice(from.length)}`, files.get(key) ?? "");
					files.delete(key);
				}
			},
			async list(glob: string) {
				const pattern = globOf(glob);
				const listed = [
					...files.entries(),
				].filter(([path]) => pattern.test(path));

				if (listed.length > (options.listLimit ?? Number.POSITIVE_INFINITY)) {
					throw new Error("file listing exceeded its result limit");
				}

				return listed.map(([path, content]) => ({
					path,
					name: nameOf(path),
					directory: false,
					sizeBytes: content.length,
					modifiedAt: "",
				}));
			},
			async extract(path: string, destination: string, extractOptions: BridgeExtractOptions = {}) {
				extracted.push({
					path,
					destination,
					tree: extractOptions.tree === true,
				});

				const archive = files.has(path) ? archives[path] : undefined;

				if (archive === undefined) {
					throw new Error(`${path} is not a readable archive`);
				}

				for (const [name, content] of Object.entries(archive)) {
					files.set(`${destination}/${name}`, content);
				}

				return Object.keys(archive).map((name) => `${destination}/${name}`);
			},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		files,
		extracted,
		commands,
		logged,
	};
};
