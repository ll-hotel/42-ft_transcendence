export type ApiResponse = { status?: number, message?: string };

export async function request_api(path: string, body: object = {}): Promise<ApiResponse> {
    return await fetch(`https://${window.location.hostname}${encodeURI(path)}`, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(body)
    }).then(function (res) {
        return res.json() as any as ApiResponse;
    });
}
