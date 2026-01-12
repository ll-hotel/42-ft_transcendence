import { appendFile } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

enum Level {
	warn = "WARN",
	error = "ERROR",
	info = "INFO",
	debug = "DEBUG",
}

export async function createDir(path: string) : Promise<boolean> {
	try {
		await mkdir(path, { recursive: true });
		return true;
	} catch (err) {
		console.error('Error creating directory:', err);
		return false;
	}
}

const logfileDir = join(process.cwd(), 'logs/');

export async function log(level: Level , msg: string, file: string = "default.log") {
	const time = new Date().toUTCString();
	const logMsg = "[" + time + "]: (" + level + "): " + msg;
	const logFile = logfileDir + file;
	console.log(logMsg);
	if (!await createDir(logfileDir))
		return;
	appendFile(logFile, logMsg + "\n", (err) => err ? console.log(err) : null);
}

export function debug(msg: string, file?: string): void {
	log(Level.debug, msg, file);
}

export function info(msg: string, file?: string): void {
	log(Level.info, msg, file);
}

export function warn(msg: string, file?: string): void {
	log(Level.warn, msg, file);
}

export function error(msg: string, file?: string): void {
	log(Level.error, msg, file);
}