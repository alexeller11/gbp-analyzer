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
  // Extrai place_id direto da URL se disponível
  const placeIdMatch = input.match(/place_id[=:]([A-Za-z0-9_-]+)/);
  if (placeIdMatch) return placeIdMatch[1];

  // Extrai nome do negócio da URL
  let searchQuery = "";
  try {
    const u = new URL(input);
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      searchQuery = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    } else {
      searchQuery = u.searchParams.get("q") || u.searchParams.get("query") || "";
    }
    // Pega também coordenadas se disponíveis para melhorar busca
    const coordMatch = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch && searchQuery) {
      return await findPlaceByText(searchQuery, parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
    }
  } catch {
    searchQuery = input;
  }

  if (!searchQuery) return null;
  return await findPlaceByText(searchQuery);
}

async function findPlaceByText(query: string, lat?: number, lng?: number): Promise<string | null> {
  const params: any = {
    input: query,
    inputtype: "textquery",
    fields: "place_id",
    key: PLACES_API_KEY,
  };
  if (lat && lng) params.locationbias = `point:${lat},${lng}`;

  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.candidates?.[0]?.place_id || null;
}

/** Busca detalhes completos de um lugar */
export async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const fields = "place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,photos,opening_hours,reviews,types,editorial_summary";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${PLACES_API_KEY}&language=pt-BR&reviews_sort=newest`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;

  const r = data.result;
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
    reviews: r.reviews?.map((rv: any) => ({
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
export async function getNearbyCompetitors(lat: number, lng: number, category: string, excludePlaceId?: string): Promise<PlaceResult[]> {
  // Mapeia categoria para tipo Places API
  const typeMap: Record<string, string> = {
    restaurante: "restaurant", academia: "gym", clinica: "hospital",
    dentista: "dentist", farmacia: "pharmacy", hotel: "lodging",
    supermercado: "supermarket", loja: "store", salao: "beauty_salon",
    advogado: "lawyer", contabilidade: "accounting", escola: "school",
  };
  const catLower = category.toLowerCase();
  let type = "establishment";
  for (const [k, v] of Object.entries(typeMap)) {
    if (catLower.includes(k)) { type = v; break; }
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${type}&key=${PLACES_API_KEY}&language=pt-BR`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK") return [];

  const competitors = data.results
    .filter((p: any) => p.place_id !== excludePlaceId)
    .slice(0, 5)
    .map((p: any) => ({
      placeId: p.place_id,
      name: p.name,
      category,
      address: p.vicinity,
      rating: p.rating,
      totalReviews: p.user_ratings_total,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
    }));

  return competitors;
}

/** Busca detalhes de múltiplos concorrentes (com avaliações) */
export async function getCompetitorDetails(placeIds: string[]): Promise<PlaceResult[]> {
  const results = await Promise.allSettled(placeIds.map(id => getPlaceDetails(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<PlaceResult> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);
}
