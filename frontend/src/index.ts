import { gotoPage, strToPageName, PageName } from "./PageLoader.js";

document.addEventListener("DOMContentLoaded", async function() {
	const content = document.getElementById("content");
	if (content === null) {
		alert("Missing content div");
		return;
	}
	const uri = window.location.pathname;
	const name = strToPageName(uri.substring(1)) || "login";

	window.history.pushState({ page: name }, "", "/" + name);
	await gotoPage(name);

	const headerButtons = document.querySelectorAll('header button');
	headerButtons.forEach(btn => {
	btn.addEventListener('click', async () => {
		const page = btn.getAttribute('data-page') as PageName;
		if (!page) return;
			await gotoPage(page);
		
		headerButtons.forEach(b => b.classList.remove('font-bold'));
		btn.classList.add('font-bold');
	});

});
});
