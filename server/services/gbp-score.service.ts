export type GbpScoredBusinessInput = {
  name: string;
  primaryCategory: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  location: {
    isVerified: boolean;
    verificationState: string | null;
  } | null;
};

export type GbpScoreResult = {
  score: number;
  insights: string[];
  breakdown: {
    name: number;
    category: number;
    phone: number;
    website: number;
    city: number;
    verification: number;
    consistencyBonus: number;
  };
};

export function calculateGbpScore(
  business: GbpScoredBusinessInput
): GbpScoreResult {
  let score = 0;
  const insights: string[] = [];

  const breakdown = {
    name: 0,
    category: 0,
    phone: 0,
    website: 0,
    city: 0,
    verification: 0,
    consistencyBonus: 0
  };

  if (business.name?.trim()) {
    breakdown.name = 10;
    score += breakdown.name;
  } else {
    insights.push("Nome do perfil ausente ou incompleto");
  }

  if (business.primaryCategory?.trim()) {
    breakdown.category = 15;
    score += breakdown.category;
  } else {
    insights.push("Categoria principal não definida corretamente");
  }

  if (business.phone?.trim()) {
    breakdown.phone = 10;
    score += breakdown.phone;
  } else {
    insights.push("Telefone não cadastrado");
  }

  if (business.website?.trim()) {
    breakdown.website = 15;
    score += breakdown.website;
  } else {
    insights.push("Site não vinculado ao perfil");
  }

  if (business.city?.trim() && business.state?.trim()) {
    breakdown.city = 10;
    score += breakdown.city;
  } else {
    insights.push("Cidade ou estado incompletos no perfil");
  }

  if (business.location?.isVerified) {
    breakdown.verification = 30;
    score += breakdown.verification;
  } else {
    insights.push("Perfil não verificado no Google");
  }

  if (
    business.primaryCategory?.trim() &&
    business.phone?.trim() &&
    business.website?.trim()
  ) {
    breakdown.consistencyBonus = 10;
    score += breakdown.consistencyBonus;
  } else {
    insights.push("Perfil sem consistência completa de informações básicas");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    insights,
    breakdown
  };
}
