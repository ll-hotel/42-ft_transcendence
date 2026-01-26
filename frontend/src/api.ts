import { notify } from "./pages/utils/notifs.js";

export enum Status {
	success = 200,
	created = 201,
	bad_request = 400,
	unauthorized = 401,
	not_found = 404,
	internal_server_error = 500,
}

export type ApiResponse = { status: Status, payload?: any };

export class api {
	static async get(uri: string) {
		return this.request("GET", uri);
	}
	static async post(uri: string, body: object = {}) {
		return this.request("POST", uri, body);
	}
	static async delete(uri: string, body: object = {}) {
		return this.request("DELETE", uri, body);
	}
	static async patch(uri: string, body: object = {}) {
		return this.request("PATCH", uri, body);
	}
	private static async request(method: "GET" | "POST" | "DELETE" | "PATCH", uri: string, body: string | object = "") {
		let headers;
		let jsonBody: string | null = null;
		if (method == "GET") {
			headers = {
				"Accept": "application/json",
			};
		} else {
			headers = {
				"Accept": "application/json",
				"Content-Type": "application/json",
			};
			jsonBody = JSON.stringify(body);
		}
		return fetch(`${encodeURI(uri)}`, {
			method,
			headers,
			body: jsonBody,
			credentials: "include",
		}).then(async (response) => {
			try {
				const json = (await response.json()) as any;
				return {
					status: response.status,
					payload: json,
				};
			} catch (err) {
				notify("Invalid API response", "error");
				return null;
			}
		}).catch(() => {
			notify("Request rejected", "error");
			return null;
		});
	}
}
