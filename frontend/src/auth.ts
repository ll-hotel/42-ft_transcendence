function register(form: HTMLFormElement): boolean {
	const form_data = new FormData(form);
	const username = form_data.get("username")?.toString() || "";
	const password = form_data.get("password")?.toString() || "";

	/// Usernames are formed of alphanumerical characters ONLY.
	const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
	/// Passwords must contain at least 1 lowercase, 1 uppercase, 1 digit and a minima 8 characters.
	const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)()[a-zA-Z0-9#@]{8,64}$/;
	if (REGEX_USERNAME.test(username) === false) {
		alert("Invalid username");
		return false;
	}
	if (REGEX_PASSWORD.test(password) === false) {
		alert("Invalid password");
		return false;
	}
	post("/api/register", { username, password })
	.then(function (res) {
		alert(res.message);
	}).catch(function (err) {
		alert("Failed to log in");
		console.log(err);
	});
	return true;
}

function login(form: HTMLFormElement): boolean {
	const form_data = new FormData(form);
	const username = form_data.get("username")?.toString() || "";
	const password = form_data.get("password")?.toString() || "";

	if (username.length < 3) {
		alert("Username too short!");
		return false;
	}
	if (password.length < 8) {
		alert("Password too short!");
		return false;
	}
	post("/api/login", { username, password })
	.then(function (res) {
		alert(res.message);
	}).catch(function (err) {
		alert("Failed to log in");
		console.log(err);
	});
	return true;
}

function logout(): boolean {
	if (document.cookie.indexOf("access_token") === -1) {
		alert("You are not logged in!");
		return false;
	}
	post("/api/logout")
	.then(function (res) {
		alert(res.message);
	}).catch(function (err) {
		alert("Failed to log in");
		console.log(err);
	});
	return true;
}
