export function notify(message: string, type: "success" | "error" | "info") {
	let container = document.getElementById("notif-container");
	if (!container) {
		container = document.createElement("div");
		container.id = "notif-container";
		// 	container.className = "fixed bottom-4 right-4 z-50 flex flex-col-reverse space-y-reverse space-y-2"; // bot right notifs
		container.className = "fixed top-4 right-4 z-50 space-y-2"; // top right notifs

		document.body.appendChild(container);
	}
	const duration = 3000;

	if (container.children.length >= 1) // notif limit before reset top notif
		container.lastElementChild?.remove();

	const el = document.createElement("div");
	el.style.position = "relative";
	el.style.overflow = "hidden";
	el.style.opacity = "0";
	el.style.transform = "translateY(8px)";
	el.style.transition = "opacity 0.2s ease, transform 0.2s ease";

	let color = "";
	switch (type) {
		case "success":
			color = "bg-green-600";
			break;
		case "error":
			color = "bg-red-600";
			break;
		case "info":
			color = "bg-orange-600";
			break;
	}

	el.className = `px-4 py-2 rounded text-white font-semibold shadow ${color}`;
	el.textContent = message;

	const bar = document.createElement("div");
	bar.style.position = "absolute";
	bar.style.left = "0";
	bar.style.bottom = "0";
	bar.style.height = "4px";
	bar.style.width = "100%";
	bar.style.backgroundColor = "black";
	bar.style.transformOrigin = "left";
	bar.style.transform = "scaleX(1)";
	bar.style.transition = `transform ${duration}ms linear`;

	el.appendChild(bar);
	container.appendChild(el);

	requestAnimationFrame(() => {
		setTimeout(() => {
			el.style.opacity = "1";
			el.style.transform = "translateY(0)";
			bar.style.transform = "scaleX(0)";
		}, 10);
	});

	setTimeout(() => {
		el.style.opacity = "0";
		el.style.transform = "translateY(8px)";
		setTimeout(() => el.remove(), 200);
	}, duration);
}
