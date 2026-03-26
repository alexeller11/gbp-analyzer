export type GbpAccount = {
  name: string;
  accountName?: string;
  type?: string;
};

export type GbpLocation = {
  name: string;
  title: string;
  storefrontAddress?: {
    locality?: string;
    administrativeArea?: string;
    regionCode?: string;
    addressLines?: string[];
  };
  websiteUri?: string;
  phoneNumbers?: {
    primaryPhone?: string;
  };
  categories?: {
    primaryCategory?: {
      displayName?: string;
      name?: string;
    };
  };
  metadata?: Record<string, unknown>;
  languageCode?: string;
  storeCode?: string;
  profile?: Record<string, unknown>;
};

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
}

export function parseAccountId(accountName: string): string {
  return accountName.replace("accounts/", "");
}

export function parseLocationId(locationName: string): string {
  const parts = locationName.split("/");
  return parts[parts.length - 1] || "";
}

export async function listAccounts(accessToken: string): Promise<GbpAccount[]> {
  const response = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    {
      headers: authHeaders(accessToken)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`accounts.list falhou: ${errorText}`);
  }

  const data = await response.json();
  return data.accounts ?? [];
}

export async function listLocations(
  accessToken: string,
  accountId: string
): Promise<GbpLocation[]> {
  const readMask = [
    "name",
    "title",
    "storefrontAddress",
    "websiteUri",
    "phoneNumbers",
    "categories",
    "metadata",
    "languageCode",
    "storeCode",
    "profile"
  ].join(",");

  const allLocations: GbpLocation[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const params = new URLSearchParams({
      readMask,
      pageSize: "100"
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?${params.toString()}`,
      {
        headers: authHeaders(accessToken)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`locations.list falhou: ${errorText}`);
    }

    const data = await response.json();
    allLocations.push(...(data.locations ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allLocations;
}
