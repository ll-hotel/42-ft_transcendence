import { appendFile } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

enum Level {
	warning = "(WARN)",
	error = "(ERROR)",
	info = "(INFO)"
}

export async function createDirectoryIfNotExists(path: string) {
	try {
		await mkdir(path, { recursive: true });
		console.log(`Directory created at ${path}`);
	} catch (err) {
		console.error('Error creating directory:', err);
	}
}

const LOG_FILE = join(process.cwd(), 'logs/');

export function print_log(file_path: string, level: Level ,msg: string): void {
	const time = new Date().toUTCString();
	let complete_msg = "[" + time + "]: " + level + ": " + msg + "\n";
	appendFile(LOG_FILE + file_path, complete_msg, (err) => {
			if (err)
				return console.log(err);
		});
}

export function error(file_path:string, msg: string)
{
	print_log(file_path, );
}