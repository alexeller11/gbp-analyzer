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
  return null; // placeholder
}
