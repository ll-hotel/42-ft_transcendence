export enum Status {
	success = 200,
	created = 201,
	bad_request = 400,
	unauthorized = 401,
	not_found = 404,
	internal_server_error = 500,
};

export type ApiResponse = { status: Status, payload?: any };

export class api {
	static async get(uri: string) {
		return this.request("GET", uri);
	}
	static async post(uri: string, body: object = {}) {
		return this.request("POST", uri, body);
	}
	private static async request(method: "GET" | "POST", uri: string, body: string | object = "") {
		const token = localStorage.getItem("accessToken");
		let headers;
		let jsonBody: string | null = null;
		if (method == "GET") {
			headers = {
				"Accept": "application/json",
				"Authorization": "Bearer " + token,
			};
		} else {
			headers = {
				"Accept": "application/json",
				"Authorization": "Bearer " + token,
				"Content-Type": "application/json",
			};
			jsonBody = JSON.stringify(body);
		}
		return fetch(`https://${window.location.hostname}${encodeURI(uri)}`, {
			method,
			headers,
			body: jsonBody,
		}
		).then(async function(response) {
			try {
				const json = (await response.json()) as any;
				return {
					status: response.status,
					payload: json,
				};
			} catch {
				console.log("[api] JSON error while parsing response:", "");
				return null;
			}
		})
	}
}
