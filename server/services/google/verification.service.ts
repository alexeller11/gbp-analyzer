export type VoiceOfMerchantState = {
  hasVoiceOfMerchant?: boolean;
  hasBusinessAuthority?: boolean;
  waitForVoiceOfMerchant?: unknown;
  verify?: unknown;
  resolveOwnershipConflict?: unknown;
  complyWithGuidelines?: unknown;
};

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
}

export async function getVoiceOfMerchantState(
  accessToken: string,
  locationId: string
): Promise<VoiceOfMerchantState | null> {
  const url = `https://mybusinessverifications.googleapis.com/v1/locations/${locationId}:getVoiceOfMerchantState`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(accessToken)
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (
      errorText.includes("PERMISSION_DENIED") ||
      errorText.includes("not found") ||
      errorText.includes("INVALID_ARGUMENT")
    ) {
      return null;
    }

    throw new Error(`getVoiceOfMerchantState falhou para locationId=${locationId}: ${errorText}`);
  }

  const data = await response.json();
  return data ?? null;
}

export function computeEffectiveVerification(input: {
  isVerified: boolean;
  verificationState: string | null;
  hasVoiceOfMerchant: boolean;
  hasBusinessAuthority: boolean;
}) {
  return (
    input.isVerified ||
    input.verificationState === "VERIFIED" ||
    input.hasVoiceOfMerchant ||
    input.hasBusinessAuthority
  );
}
