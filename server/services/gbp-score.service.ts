export type GbpScoredBusinessInput = {
  name: string;
  primaryCategory: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  portfolioType?: string | null;
  location: {
    isVerified: boolean;
    verificationState: string | null;
  } | null;
};

export type GbpScoreResult = {
  score: number;
  opportunityScore: number;
  opportunityLevel: "baixa" | "media" | "alta";
  insights: string[];
  priorities: string[];
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
  const priorities: string[] = [];

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
    priorities.push("Revisar o nome do perfil");
  }

  if (business.primaryCategory?.trim()) {
    breakdown.category = 15;
    score += breakdown.category;
  } else {
    insights.push("Categoria principal não definida corretamente");
    priorities.push("Definir ou revisar a categoria principal");
  }

  if (business.phone?.trim()) {
    breakdown.phone = 10;
    score += breakdown.phone;
  } else {
    insights.push("Telefone não cadastrado");
    priorities.push("Cadastrar telefone");
  }

  if (business.website?.trim()) {
    breakdown.website = 15;
    score += breakdown.website;
  } else {
    insights.push("Site não vinculado ao perfil");
    priorities.push("Adicionar site ou landing page");
  }

  if (business.city?.trim() && business.state?.trim()) {
    breakdown.city = 10;
    score += breakdown.city;
  } else {
    insights.push("Cidade ou estado incompletos no perfil");
    priorities.push("Revisar localização e consistência geográfica");
  }

  const isVerified =
  business.location?.isVerified ||
  business.location?.verificationState === "VERIFIED";

if (isVerified) {
    breakdown.verification = 30;
    score += breakdown.verification;
  } else {
    insights.push("Perfil não verificado no Google");
    priorities.push("Solicitar ou concluir a verificação do perfil");
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
    priorities.push("Completar informações essenciais do perfil");
  }

  score = Math.max(0, Math.min(100, score));

  let opportunityScore = 0;

  if (!business.location?.isVerified) opportunityScore += 35;
  if (!business.website?.trim()) opportunityScore += 20;
  if (!business.phone?.trim()) opportunityScore += 10;
  if (!business.primaryCategory?.trim()) opportunityScore += 20;
  if (score < 50) opportunityScore += 25;
  if (business.portfolioType === "prospect") opportunityScore += 10;

  opportunityScore = Math.max(0, Math.min(100, opportunityScore));

  let opportunityLevel: "baixa" | "media" | "alta" = "baixa";
  if (opportunityScore >= 60) opportunityLevel = "alta";
  else if (opportunityScore >= 30) opportunityLevel = "media";

  return {
    score,
    opportunityScore,
    opportunityLevel,
    insights,
    priorities,
    breakdown
  };
}
