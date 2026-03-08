/**
 * Google My Business API Integration - API v1 (atual)
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

export interface GoogleLocationInsights {
  name: string;
  metric: string;
  totalValue: { value: number; };
}

/** Busca contas do Google Business */
export async function getBusinessAccounts(accessToken: string): Promise<any> {
  const response = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Accounts API error: ${response.status} ${JSON.stringify(err)}`);
  }
  return response.json();
}

/** Busca localizações de uma conta */
export async function getBusinessLocations(accessToken: string, accountId: string): Promise<any> {
  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=name,title,storefrontAddress,websiteUri,phoneNumbers,categories`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Locations API error: ${response.status} ${JSON.stringify(err)}`);
  }
  const data = await response.json();
  return data.locations || [];
}

/** Busca detalhes de uma localização */
export async function getLocationDetails(accessToken: string, locationName: string): Promise<any> {
  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=name,title,storefrontAddress,websiteUri,phoneNumbers,categories`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Location details API error: ${response.status} ${JSON.stringify(err)}`);
  }
  const data = await response.json();
  return {
    displayName: data.title,
    category: data.categories?.primaryCategory,
    address: data.storefrontAddress,
    phoneNumbers: data.phoneNumbers?.primaryPhone ? [data.phoneNumbers.primaryPhone] : [],
    websiteUrl: data.websiteUri,
    metadata: {},
  };
}

/** Busca avaliações de uma localização */
export async function getLocationReviews(accessToken: string, locationName: string): Promise<GoogleReview[]> {
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data.reviews || [];
}

/** Busca insights de uma localização */
export async function getLocationInsights(accessToken: string, locationName: string): Promise<GoogleLocationInsights[]> {
  return [];
}

export function parseLocationName(locationName: string): { accountId: string; locationId: string; } {
  const match = locationName.match(/accounts\/([^/]+)\/locations\/([^/]+)/);
  if (!match) throw new Error("Invalid location name format");
  return { accountId: match[1], locationId: match[2] };
}
