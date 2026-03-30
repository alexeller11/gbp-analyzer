// server/google/verification.service.ts

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

export async function getVoiceOfMerchantState(
  accessToken: string,
  locationId: string
) {
  try {
    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=metadata`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await res.json();

    return data?.metadata?.hasVoiceOfMerchant ?? false;
  } catch (err) {
    console.error("Erro verification:", err);
    return false;
  }
}
