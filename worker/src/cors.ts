export const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Remove this in Production
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export function withCors(response: Response) {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => newHeaders.set(key, value));
    console.log('CORS headers added:', Object.fromEntries(newHeaders.entries()));
    return new Response(response.body, {
        status: response.status,
        headers: newHeaders
    });
}