import bcrypt from "bcrypt";

export async function hashPassword(password: string): Promise<string> {
	const	rounds = 10;
	const	hash = await bcrypt.hash(password, rounds);
	return hash;
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
	const	result = await bcrypt.compare(password, hash);
	return result;
}