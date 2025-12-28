/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */



export default {
	async fetch(request: Request, env: any) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
				},
			});
		}

		if (url.pathname === "/details") {
			const id = url.searchParams.get("id");

			const res = await fetch(
				`https://maps.googleapis.com/maps/api/place/details/json?place_id=${id}&language=tr&key=${env.GOOGLE_PLACES_KEY}`
			);

			const data = await res.json();

			return new Response(
				JSON.stringify(data.result, null, 2),
				{
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
					},
				}
			);
		}



		if (url.searchParams.get("sync") === "true") {
			const googleRes = await fetch(
				`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=40.1553,26.4142&radius=5000&type=cafe&key=${env.GOOGLE_PLACES_KEY}`
			);

			const data = await googleRes.json();


			// console.log("GOOGLE DATA:", data.results?.length);
			// console.log("FIRST CAFE:", data.results?.[0]);

			const cafes = (data.results || []).map((place: any) => ({
				id: place.place_id,
				name: place.name,
				location: place.vicinity,
				rating: place.rating || 0,
				user_ratings_total: place.user_ratings_total || 0,
				photos: place.photos
					? place.photos.map(
						(p: any) =>
							`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${env.GOOGLE_PLACES_KEY}`
					)
					: [],
				opening_hours: place.opening_hours || null,
				open_now: place.opening_hours?.open_now ?? null,
				types: place.types || [],
				formatted_address: place.vicinity || null,
				url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
				reviews: [],

			}));

			await env.CAFES_BUCKET.put(
				"cafes.json",
				JSON.stringify(cafes, null, 2),
				{
					httpMetadata: {
						contentType: "application/json",
						cacheControl: "public, max-age=86400",
					},
				}
			);

			return new Response(
				JSON.stringify({
					ok: true,
					synced: cafes.length,
					samplePhoto: cafes[0]?.photos?.[0],
				}),
				{ headers: { "Content-Type": "application/json" } }
			);
		}


		const object = await env.CAFES_BUCKET.get("cafes.json");

		if (!object) {
			return new Response("Not found", { status: 404 });
		}

		return new Response(object.body, {
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=300",
			},
		});
	},
};




