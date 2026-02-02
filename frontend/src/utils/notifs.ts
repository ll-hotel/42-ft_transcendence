const notifMaxCount: number = 1;

export function notify(message: string, type: "success" | "error" | "info", duration: number = 3000) {
	let container = document.getElementById("notif-container");
	if (!container) {
		container = document.createElement("div");
		container.id = "notif-container";
		container.className = "fixed top-4 right-4 z-50 space-y-2 text-right"; // top right notifs

		document.body.appendChild(container);
	}

	if (container.children.length >= notifMaxCount) {
		container.firstElementChild?.remove();
	}

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

	el.className = `px-4 py-2 rounded text-white w-fit ml-auto font-semibold drop-shadow-xl/80 ${color}`;
	el.textContent = message;

	const bar = document.createElement("div");
	bar.style.position = "absolute";
	bar.style.left = "0";
	bar.style.bottom = "0";
	bar.style.height = "4px";
	bar.style.width = "100%";
	bar.style.backgroundColor = `black`;
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
