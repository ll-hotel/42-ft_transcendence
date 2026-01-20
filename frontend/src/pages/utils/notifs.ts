export function notify(message: string, type: "success" | "error" | "info") {
  let container = document.getElementById("notif-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notif-container";
    container.className = "fixed bottom-4 right-4 z-50 flex flex-col-reverse space-y-reverse space-y-2";
// container.className = "fixed top-4 right-4 z-50 space-y-2" top right notifs

    document.body.appendChild(container);
  }


  if (container.children.length >= 4) // notif limit before reset top notif
    container.children[0].remove();

  const el = document.createElement("div");

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
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}



//container.className = "fixed bottom-4 right-4 z-50 flex flex-col-reverse space-y-reverse space-y-2";


