export function notify(message: string, type: "success" | "error" | "info") {
  let container = document.getElementById("notif-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notif-container";
    container.className = "fixed top-4 right-4 z-50 space-y-2";
    document.body.appendChild(container);
  }


  if (container.children.length >= 4) // notif limit before reset top notif
    container.children[0].remove();

  const el = document.createElement("div");
  el.className = `px-4 py-2 rounded text-white font-semibold shadow ${
    type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-orange-600" }`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

