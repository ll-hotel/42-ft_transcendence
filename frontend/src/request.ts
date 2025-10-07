export async function get(path: string, cache: RequestCache = "default"): Promise<JSON> {
	const response = await fetch(`http://${window.location.hostname}/api/${encodeURI(path)}`, {
		method: "GET",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json"
		},
		credentials: "include",
		cache,
	});
	if (response.ok === false) {
		return Promise.reject(response);
	}
	return response.json();
}

export async function post(path: string, body: object = {}): Promise<JSON> {
	const response = await fetch(`http://${window.location.hostname}/api/${encodeURI(path)}`, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json"
		},
		credentials: "include",
		body: JSON.stringify(body)
	});
	if (response.ok === false) {
		return Promise.reject(response);
	}
	return response.json();
}
