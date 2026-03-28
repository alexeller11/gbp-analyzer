export type GbpAccountType =
  | "PERSONAL"
  | "ORGANIZATION"
  | "LOCATION_GROUP"
  | "USER_GROUP"
  | string;

export type GbpAccount = {
  name: string;
  accountName?: string;
  type?: GbpAccountType;
  role?: string;
  verificationState?: string;
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

export type GbpVerification = {
  name: string;
  method?: string;
  state?: string;
  createTime?: string;
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

export function isContainerAccount(type?: string) {
  return type === "ORGANIZATION" || type === "USER_GROUP";
}

export async function listAccounts(
  accessToken: string,
  parentAccountName?: string
): Promise<GbpAccount[]> {
  const allAccounts: GbpAccount[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const params = new URLSearchParams();

    if (parentAccountName) {
      params.set("name", parentAccountName);
    }

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `https://mybusinessaccountmanagement.googleapis.com/v1/accounts${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    const response = await fetch(url, {
      headers: authHeaders(accessToken)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`accounts.list falhou: ${errorText}`);
    }

    const data = await response.json();
    allAccounts.push(...(data.accounts ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allAccounts;
}

export async function discoverAllAccounts(accessToken: string): Promise<GbpAccount[]> {
  const visited = new Set<string>();
  const queue: GbpAccount[] = await listAccounts(accessToken);
  const result: GbpAccount[] = [];

  while (queue.length > 0) {
    const account = queue.shift()!;
    if (!account?.name || visited.has(account.name)) {
      continue;
    }

    visited.add(account.name);
    result.push(account);

    if (isContainerAccount(account.type)) {
      const childAccounts = await listAccounts(accessToken, account.name);

      for (const child of childAccounts) {
        if (child?.name && !visited.has(child.name)) {
          queue.push(child);
        }
      }
    }
  }

  return result;
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

      if (
        errorText.includes("does not support this method") ||
        errorText.includes("INVALID_ARGUMENT") ||
        errorText.includes("not found") ||
        errorText.includes("PERMISSION_DENIED")
      ) {
        return [];
      }

      throw new Error(`locations.list falhou para accountId=${accountId}: ${errorText}`);
    }

    const data = await response.json();
    allLocations.push(...(data.locations ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allLocations;
}

export async function listLocationVerifications(
  accessToken: string,
  locationId: string
): Promise<GbpVerification[]> {
  const response = await fetch(
    `https://mybusinessverifications.googleapis.com/v1/locations/${locationId}/verifications`,
    {
      headers: authHeaders(accessToken)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    if (
      response.status === 404 ||
      response.status === 403 ||
      errorText.includes("SERVICE_DISABLED") ||
      errorText.includes("has not been used in project") ||
      errorText.includes("PERMISSION_DENIED")
    ) {
      return [];
    }

    throw new Error(`locations.verifications.list falhou para locationId=${locationId}: ${errorText}`);
  }

  const data = await response.json();
  return data.verifications ?? [];
}

export function resolveVerificationFromApi(
  verifications: GbpVerification[]
): {
  verificationStatus: "verified" | "pending" | "failed" | "unverified" | "unknown";
  verificationState: string | null;
  verificationMethod: string | null;
  isVerified: boolean;
  verificationSource: string;
} {
  if (!verifications.length) {
    return {
      verificationStatus: "unknown",
      verificationState: null,
      verificationMethod: null,
      isVerified: false,
      verificationSource: "verifications_api_empty"
    };
  }

  const latest = [...verifications].sort((a, b) => {
    const da = a.createTime ? new Date(a.createTime).getTime() : 0;
    const db = b.createTime ? new Date(b.createTime).getTime() : 0;
    return db - da;
  })[0];

  const state = latest?.state ?? null;
  const method = latest?.method ?? null;

  if (state === "COMPLETED") {
    return {
      verificationStatus: "verified",
      verificationState: state,
      verificationMethod: method,
      isVerified: true,
      verificationSource: "verifications_api"
    };
  }

  if (state === "PENDING") {
    return {
      verificationStatus: "pending",
      verificationState: state,
      verificationMethod: method,
      isVerified: false,
      verificationSource: "verifications_api"
    };
  }

  if (state === "FAILED") {
    return {
      verificationStatus: "failed",
      verificationState: state,
      verificationMethod: method,
      isVerified: false,
      verificationSource: "verifications_api"
    };
  }

  return {
    verificationStatus: "unknown",
    verificationState: state,
    verificationMethod: method,
    isVerified: false,
    verificationSource: "verifications_api"
  };
}
