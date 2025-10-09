type ApiResponse = { status: number, message: string };

async function get(path: string, cache: RequestCache = "default"): Promise<ApiResponse> {
    return await fetch(`https://${window.location.hostname}/${encodeURI(path)}`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        credentials: "include",
        cache,
    }).then(function (res) {
        return res.json() as any as ApiResponse;
    });
}

async function post(path: string, body: object = {}): Promise<ApiResponse> {
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
