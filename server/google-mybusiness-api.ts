/**
 * Google Business Profile API — Automação Máxima
 * Usa Business Profile APIs v1 + Places API para dados completos
 */

export interface GoogleReview {
  name: string;
  reviewer: { displayName: string; profilePhotoUrl?: string; };
  reviewReply?: { comment: string; updateTime: string; };
  starRating: number;
  comment: string;
  createTime: string;
  updateTime: string;
}

export interface GBPLocation {
  locationName: string;    // accounts/xxx/locations/yyy
  accountId: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  website?: string;
  isVerified: boolean;
  totalReviews?: number;
  avgRating?: number;
  placeId?: string;
  lat?: number;
  lng?: number;
  photoCount?: number;
  description?: string;
}

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

/** Busca todas as contas GBP do usuário */
export async function getBusinessAccounts(accessToken: string): Promise<any[]> {
  const response = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error("[GBP] Accounts error:", err);
    return [];
  }
  const data = await response.json();
  return data.accounts || [];
}

/** Busca todas as localizações de uma conta com readMask completo */
export async function getBusinessLocations(accessToken: string, accountId: string): Promise<any[]> {
  const readMask = [
    "name", "title", "storefrontAddress", "websiteUri", "phoneNumbers",
    "categories", "metadata", "regularHours", "latlng",
  ].join(",");
  
  const allLocations: any[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ readMask, pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) break;
    const data = await response.json();
    allLocations.push(...(data.locations || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allLocations;
}

/** Busca detalhes de uma localização */
export async function getLocationDetails(accessToken: string, locationName: string): Promise<any> {
  const readMask = "name,title,storefrontAddress,websiteUri,phoneNumbers,categories,metadata,regularHours,latlng";
  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=${readMask}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) return null;
  return response.json();
}

/** Busca reviews paginadas (até 250 via GBP API v4) */
export async function getLocationReviews(accessToken: string, locationName: string): Promise<GoogleReview[]> {
  const allReviews: GoogleReview[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ pageSize: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      console.warn("[GBP Reviews] failed:", response.status);
      break;
    }
    const data = await response.json();
    allReviews.push(...(data.reviews || []));
    pageToken = data.nextPageToken;
    if (!pageToken || !data.reviews?.length) break;
  }
  return allReviews;
}

/** Enriquece uma localização GBP com dados da Places API (rating, reviews, coords, fotos) */
export async function enrichWithPlacesData(location: Partial<GBPLocation>): Promise<Partial<GBPLocation>> {
  if (!PLACES_KEY || !location.name) return location;

  try {
    // Busca por nome + endereço
    const query = `${location.name} ${location.address || ""}`.trim();
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_KEY}&language=pt-BR`;
    const res = await fetch(url);
    const data = await res.json();
    const place = data.results?.[0];
    if (!place) return location;

    // Busca detalhes para fotos e descrição
    let photoCount = place.photos?.length || 0;
    let description: string | undefined;
    let placeId = place.place_id;

    if (place.place_id) {
      const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=user_ratings_total,rating,photos,editorial_summary,geometry&key=${PLACES_KEY}&language=pt-BR`;
      const detRes = await fetch(detUrl);
      const detData = await detRes.json();
      const det = detData.result;
      if (det) {
        photoCount = det.photos?.length || photoCount;
        description = det.editorial_summary?.overview;
        if (!location.lat && det.geometry?.location) {
          location.lat = det.geometry.location.lat;
          location.lng = det.geometry.location.lng;
        }
        return {
          ...location,
          placeId,
          totalReviews: det.user_ratings_total || place.user_ratings_total,
          avgRating: det.rating || place.rating,
          photoCount,
          description,
          lat: location.lat || det.geometry?.location?.lat,
          lng: location.lng || det.geometry?.location?.lng,
        };
      }
    }

    return {
      ...location,
      placeId,
      totalReviews: place.user_ratings_total,
      avgRating: place.rating,
      photoCount,
      lat: location.lat || place.geometry?.location?.lat,
      lng: location.lng || place.geometry?.location?.lng,
    };
  } catch (e) {
    console.warn("[Places enrich] error:", e);
    return location;
  }
}

/** Converte localização GBP raw para GBPLocation estruturado */
export function parseLocation(raw: any, accountId: string): Partial<GBPLocation> {
  const categoryMap: Record<string, string> = {
    restaurant: "Restaurante", gym: "Academia", hospital: "Hospital",
    dentist: "Clínica Odontológica", pharmacy: "Farmácia", lodging: "Hotel/Pousada",
    supermarket: "Supermercado", store: "Loja", beauty_salon: "Salão de Beleza",
    lawyer: "Escritório de Advocacia", accounting: "Contabilidade", school: "Escola",
    bar: "Bar", cafe: "Cafeteria", bakery: "Padaria", car_repair: "Oficina Mecânica",
    clothing_store: "Loja de Roupas", electronics_store: "Loja de Eletrônicos",
    hair_care: "Cabeleireiro", real_estate_agency: "Imobiliária",
    travel_agency: "Agência de Viagens", veterinary_care: "Clínica Veterinária",
  };

  const rawCategory = raw.categories?.primaryCategory?.displayName
    || raw.categories?.primaryCategory?.name?.split("/").pop()?.replace(/_/g, " ")
    || "Negócio";

  const category = categoryMap[rawCategory.toLowerCase()] || rawCategory;

  const addr = raw.storefrontAddress;
  const address = addr
    ? [addr.addressLines?.[0], addr.locality, addr.administrativeArea, addr.regionCode].filter(Boolean).join(", ")
    : "";

  return {
    locationName: raw.name,
    accountId,
    name: raw.title || raw.name,
    category,
    address,
    phone: raw.phoneNumbers?.primaryPhone,
    website: raw.websiteUri,
    isVerified: raw.metadata?.hasGoogleUpdated || raw.metadata?.hasPendingVerification === false,
    lat: raw.latlng?.latitude,
    lng: raw.latlng?.longitude,
  };
}

export function parseLocationName(locationName: string): { accountId: string; locationId: string } {
  const match = locationName.match(/accounts\/([^/]+)\/locations\/([^/]+)/);
  if (!match) throw new Error("Invalid location name format");
  return { accountId: match[1], locationId: match[2] };
}
