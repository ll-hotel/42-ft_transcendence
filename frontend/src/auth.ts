export async function register(form: HTMLFormElement): Promise<boolean> {
	const username = form.children.namedItem("username")?.nodeValue || "";
	const password = form.children.namedItem("password")?.nodeValue || "";
	alert(username);
	alert(password);
	return true;
}
