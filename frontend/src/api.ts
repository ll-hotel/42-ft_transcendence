export enum Status {
	success = 200,
	created = 201,
	bad_request = 400,
	unauthorized = 401,
	not_found = 404,
	internal_server_error = 500,
};

export type ApiResponse = { status: Status, payload?: any };

export async function request_api(path: string, body: object = {}): Promise<ApiResponse | null> {
	return await fetch(`https://${window.location.hostname}${encodeURI(path)}`, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json"
		},
		credentials: "include",
		body: JSON.stringify(body)
	}).then(async function(response) {
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
	});
}
