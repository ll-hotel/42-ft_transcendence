import { request_api } from "../api.js";

function logout(): boolean {
	if (document.cookie.indexOf("access_token") === -1) {
		alert("You are not logged in!");
		return false;
	}
	request_api("/api/logout")
	.then(function (res) {
		alert(res.message);
	}).catch(function (err) {
		alert("Failed to log in");
		console.log(err);
	});
	return true;
}

(function() {
	const forms = document.getElementsByTagName("form");
	if (forms.length === 0) {
		alert("Missing form");
		return;
	}
	const form = forms[0];
	form.setAttribute("onsubmit", `function(form) {
		if (document.cookie.indexOf("access_token") === -1) {
			alert("You are not logged in!");
			return false;
		}
		request_api("/api/logout")
		.then(function (res) {
			alert(res.message);
		}).catch(function (err) {
			alert("Failed to log in");
			console.log(err);
		});
		return true;
	}`);
})();
