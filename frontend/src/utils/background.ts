export function initStarfield() {
	if (document.getElementById("bg-canvas")) 
		return;

	const canvas = document.createElement("canvas");
	canvas.id = "bg-canvas";
	canvas.style.position = "fixed";
	canvas.style.inset = "0";
	canvas.style.zIndex = "-1";
	canvas.style.background = "radial-gradient(circle at center, black)";
	document.body.appendChild(canvas);

	const ctx = canvas.getContext("2d")!;
	let w = (canvas.width = window.innerWidth);
	let h = (canvas.height = window.innerHeight);

	window.addEventListener("resize", () => {
		w = canvas.width = window.innerWidth;
		h = canvas.height = window.innerHeight;
	});

	type Star = {
		x: number;
		y: number;
		z: number;
		size: number;
		speed: number;
	};

	const STAR_COUNT = Math.floor((w * h) / 8000); // screen
	const stars: Star[] = [];

	function createStar(): Star {
		return {
			x: Math.random() * w,
			y: Math.random() * h,
			z: Math.random(), // 0 , 1 depth (screen distance effect)
			size: 0.5 + Math.random() * 1.5,
			speed: 0.1 + Math.random() * 0.4
		};
	}

	for (let i = 0; i < STAR_COUNT; i++)
		stars.push(createStar());

	function draw() {
		ctx.clearRect(0, 0, w, h);

		for (const s of stars) {
			s.y += s.speed * (0.3 + s.z);

			if (s.y > h) {
				s.y = 0;
				s.x = Math.random() * w;
				s.z = Math.random();
			}

			const alpha = 0.3 + s.z * 0.7;

			ctx.beginPath();
			ctx.arc(s.x, s.y, s.size * (0.5 + s.z), 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255,255,255,${alpha})`;
			ctx.fill();
		}

		requestAnimationFrame(draw);
	}

	draw();
}
