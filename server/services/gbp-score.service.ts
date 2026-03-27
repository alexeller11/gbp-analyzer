export type GbpScoreResult = {
  score: number;
  insights: string[];
};

export function calculateGbpScore(business: any): GbpScoreResult {
  let score = 0;
  const insights: string[] = [];

  // Nome
  if (business.name) {
    score += 10;
  }

  // Categoria
  if (business.primaryCategory) {
    score += 10;
  } else {
    insights.push("Categoria não definida corretamente");
  }

  // Telefone
  if (business.phone) {
    score += 10;
  } else {
    insights.push("Sem telefone cadastrado");
  }

  // Website
  if (business.website) {
    score += 10;
  } else {
    insights.push("Sem site vinculado");
  }

  // Cidade
  if (business.city) {
    score += 10;
  }

  // Verificação
  if (business.location?.isVerified) {
    score += 30;
  } else {
    insights.push("Perfil não verificado no Google");
  }

  // Categoria bônus
  if (business.primaryCategory && business.website) {
    score += 10;
  }

  return {
    score,
    insights
  };
}
