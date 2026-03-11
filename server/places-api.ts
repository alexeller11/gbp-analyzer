/**
 * Google Places API - dados reais de negócios
 */

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export interface PlaceResult {
  placeId: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  totalReviews?: number;
  lat?: number;
  lng?: number;
  photos?: string[];
  hours?: string[];
  reviews?: PlaceReview[];
  description?: string;
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  time: string;
  photoUrl?: string;
}

/** Busca place_id a partir de URL do Google Maps ou nome */
export async function findPlaceFromUrl(input: string): Promise<string | null> {
  let fullUrl = input;

  // Expande URL encurtada (maps.app.goo.gl ou goo.gl)
  if (input.includes("goo.gl")) {
    try {
      const res = await fetch(input, { method: "HEAD", redirect: "follow" });
      fullUrl = res.url;
      console.log("[Places] URL expandida:", fullUrl.substring(0, 100));
    } catch (e) {
      console.warn("[Places] Não foi possível expandir URL:", e);
      fullUrl = input;
    }
  }

  // Tenta extrair place_id no formato !1s<placeId>
  const placesIdMatch = fullUrl.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
  if (placesIdMatch) {
    console.log("[Places] place_id extraído direto:", placesIdMatch[1]);
    return placesIdMatch[1];
  }

  // Tenta place_id na query string
  const placeIdQS = fullUrl.match(/place_id[=!:]([A-Za-z0-9_-]+)/);
  if (placeIdQS) return placeIdQS[1];

  // Extrai nome do negócio da URL expandida
  let searchQuery = "";
  let lat: number | undefined, lng: number | undefined;
  try {
    const u = new URL(fullUrl);
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      searchQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    } else {
      searchQuery = u.searchParams.get("q") || u.searchParams.get("query") || "";
    }
    const coordMatch = fullUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) { lat = parseFloat(coordMatch[1]); lng = parseFloat(coordMatch[2]); }
  } catch {
    searchQuery = input;
  }

  console.log("[Places] Buscando por texto:", searchQuery, "coords:", lat, lng);
  if (!searchQuery) return null;
  return await findPlaceByText(searchQuery, lat, lng);
}

async function findPlaceByText(query: string, lat?: number, lng?: number): Promise<string | null> {
  const key = PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY não configurada");

  // Tenta findplacefromtext primeiro
  const params: Record<string, string> = {
    input: query,
    inputtype: "textquery",
    fields: "place_id",
    key,
  };
  if (lat && lng) params.locationbias = `point:${lat},${lng}`;

  const url1 = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${new URLSearchParams(params)}`;
  const res1 = await fetch(url1);
  const data1 = await res1.json();
  console.log("[Places] findplacefromtext status:", data1.status, "candidates:", data1.candidates?.length);
  if (data1.candidates?.[0]?.place_id) return data1.candidates[0].place_id;

  // Fallback: textsearch
  const params2: Record<string, string> = { query, key };
  if (lat && lng) params2.location = `${lat},${lng}`;
  const url2 = `https://maps.googleapis.com/maps/api/place/textsearch/json?${new URLSearchParams(params2)}`;
  const res2 = await fetch(url2);
  const data2 = await res2.json();
  console.log("[Places] textsearch status:", data2.status, "results:", data2.results?.length);
  return data2.results?.[0]?.place_id || null;
}

/** Busca detalhes completos de um lugar */
export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const fields = "place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,photos,opening_hours,reviews,types,editorial_summary";
  
  // Busca reviews com dois sorts diferentes para tentar pegar mais que 5
  const fetchDetails = async (sort: "newest" | "most_relevant") => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${PLACES_API_KEY}&language=pt-BR&reviews_sort=${sort}`;
    const res = await fetch(url);
    return res.json();
  };

  const [dataNewer, dataMostRelevant] = await Promise.all([
    fetchDetails("newest"),
    fetchDetails("most_relevant"),
  ]);

  const data = dataNewer;
  if (data.status !== "OK" || !data.result) return null;

  const r = data.result;

  // Combina reviews dos dois sorts, deduplica por autor+tempo
  const reviewsMap = new Map<string, any>();
  const addReviews = (reviews: any[]) => {
    for (const rv of (reviews || [])) {
      const key = `${rv.author_name}_${rv.time}`;
      if (!reviewsMap.has(key)) reviewsMap.set(key, rv);
    }
  };
  addReviews(dataNewer.result?.reviews || []);
  addReviews(dataMostRelevant.result?.reviews || []);

  return {
    placeId,
    name: r.name,
    category: r.types?.[0]?.replace(/_/g, " ") || "Negócio",
    address: r.formatted_address,
    phone: r.formatted_phone_number,
    website: r.website,
    rating: r.rating,
    totalReviews: r.user_ratings_total,
    lat: r.geometry?.location?.lat,
    lng: r.geometry?.location?.lng,
    photos: r.photos?.slice(0, 5).map((p: any) =>
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${PLACES_API_KEY}`
    ),
    hours: r.opening_hours?.weekday_text,
    reviews: Array.from(reviewsMap.values()).map((rv: any) => ({
      author: rv.author_name,
      rating: rv.rating,
      text: rv.text,
      time: new Date(rv.time * 1000).toISOString(),
      photoUrl: rv.profile_photo_url,
    })),
    description: r.editorial_summary?.overview,
  };
}

/** Busca concorrentes próximos */
export async function getNearbyCompetitors(
  lat: number, lng: number, category: string,
  excludePlaceId?: string, businessName?: string
): Promise<PlaceResult[]> {
  const key = PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY não configurada");

  const location = `${lat},${lng}`;
  const allResults: any[] = [];

  // Estratégia 1: busca pela categoria do negócio
  const catQuery = category && category !== "Estabelecimento" && category !== "Negócio"
    ? category
    : businessName?.split(" ").slice(-2).join(" ") || "loja";

  const url1 = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(catQuery)}&location=${location}&radius=5000&key=${key}&language=pt-BR`;
  const r1 = await fetch(url1);
  const d1 = await r1.json();
  console.log("[Competitors] query1:", catQuery, "status:", d1.status, "results:", d1.results?.length);
  if (d1.results) allResults.push(...d1.results);

  // Estratégia 2: nearbysearch por tipo se tiver poucos resultados
  if (allResults.length < 3) {
    const typeMap: Record<string, string> = {
      restaurante: "restaurant", academia: "gym", farmácia: "pharmacy",
      hotel: "lodging", supermercado: "supermarket", dentista: "dentist",
      materiais: "hardware_store", construção: "hardware_store",
      padaria: "bakery", bar: "bar", café: "cafe", loja: "store",
      salão: "beauty_salon", cabelereiro: "hair_care", clínica: "doctor",
    };
    const catLower = (category + " " + (businessName || "")).toLowerCase();
    let type = "store";
    for (const [k, v] of Object.entries(typeMap)) {
      if (catLower.includes(k)) { type = v; break; }
    }
    const url2 = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=5000&type=${type}&key=${key}&language=pt-BR`;
    const r2 = await fetch(url2);
    const d2 = await r2.json();
    console.log("[Competitors] nearbysearch type:", type, "status:", d2.status, "results:", d2.results?.length);
    if (d2.results) allResults.push(...d2.results);
  }

  // Deduplica e filtra o próprio negócio
  const seen = new Set<string>();
  return allResults
    .filter((p: any) => {
      if (!p.place_id || p.place_id === excludePlaceId) return false;
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    })
    .slice(0, 6)
    .map((p: any) => ({
      placeId: p.place_id,
      name: p.name,
      category,
      address: p.formatted_address || p.vicinity,
      rating: p.rating,
      totalReviews: p.user_ratings_total,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
    }));
}

/** Busca detalhes de múltiplos concorrentes (com avaliações) */
export async function getCompetitorDetails(placeIds: string[]): Promise<PlaceResult[]> {
  const results = await Promise.allSettled(placeIds.map(id => getPlaceDetails(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<PlaceResult> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);
}
