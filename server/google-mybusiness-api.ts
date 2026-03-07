/**
 * Google My Business API Integration
 * Handles API calls to fetch business profiles, reviews, and metrics
 */

export interface GoogleBusinessProfile {
  name: string;
  displayName: string;
  category?: {
    displayName: string;
  };
  websiteUrl?: string;
  phoneNumbers?: string[];
  address?: {
    addressLines?: string[];
    postalCode?: string;
    administrativeArea?: string;
    regionCode?: string;
  };
  locations?: Array<{
    name: string;
    displayName: string;
  }>;
}

export interface GoogleBusinessLocation {
  name: string;
  displayName: string;
  storeCode?: string;
  businessType?: string;
  address?: {
    addressLines?: string[];
    postalCode?: string;
    administrativeArea?: string;
    regionCode?: string;
  };
  websiteUrl?: string;
  phoneNumbers?: string[];
  regularHours?: {
    periods?: Array<{
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }>;
  };
}

export interface GoogleReview {
  name: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
  starRating: number;
  comment: string;
  createTime: string;
  updateTime: string;
}

export interface GoogleLocationInsights {
  name: string;
  metric: string;
  totalValue: {
    value: number;
  };
  timeSeries?: {
    interval: {
      startTime: string;
      endTime: string;
    };
    val: Array<{
      value: number;
    }>;
  };
}

/**
 * Fetch all business accounts for the authenticated user
 */
export async function getBusinessAccounts(accessToken: string): Promise<any> {
  try {
    const response = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching business accounts:", error);
    throw error;
  }
}

/**
 * Fetch all locations for a business account
 */
export async function getBusinessLocations(
  accessToken: string,
  accountId: string
): Promise<GoogleBusinessLocation[]> {
  try {
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.locations || [];
  } catch (error) {
    console.error("Error fetching business locations:", error);
    throw error;
  }
}

/**
 * Fetch reviews for a specific location
 */
export async function getLocationReviews(
  accessToken: string,
  locationName: string
): Promise<GoogleReview[]> {
  try {
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.reviews || [];
  } catch (error) {
    console.error("Error fetching location reviews:", error);
    throw error;
  }
}

/**
 * Fetch insights/metrics for a specific location
 */
export async function getLocationInsights(
  accessToken: string,
  locationName: string,
  metrics: string[] = ["QUERIES_DIRECT", "QUERIES_INDIRECT", "VIEWS_MAPS", "VIEWS_SEARCH"]
): Promise<GoogleLocationInsights[]> {
  try {
    const metricsParam = metrics.join(",");
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/insights:reportInsights`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationNames: [locationName],
          basicRequest: {
            metricRequests: metrics.map((metric) => ({
              metric,
            })),
            timeRange: {
              startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              endTime: new Date().toISOString(),
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.locationInsights || [];
  } catch (error) {
    console.error("Error fetching location insights:", error);
    throw error;
  }
}

/**
 * Get location details including name, category, address, etc
 */
export async function getLocationDetails(
  accessToken: string,
  locationName: string
): Promise<GoogleBusinessLocation> {
  try {
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching location details:", error);
    throw error;
  }
}

/**
 * Parse Google location name to extract account and location IDs
 * Format: accounts/{accountId}/locations/{locationId}
 */
export function parseLocationName(locationName: string): {
  accountId: string;
  locationId: string;
} {
  const match = locationName.match(/accounts\/([^/]+)\/locations\/([^/]+)/);
  if (!match) {
    throw new Error("Invalid location name format");
  }
  return {
    accountId: match[1],
    locationId: match[2],
  };
}
