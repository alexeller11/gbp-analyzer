import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { businesses, gbpLocations } from "../../drizzle/schema.ts";

function classifyPriority(params: {
  score: number;
  website: string | null;
  phone: string | null;
  city: string | null;
  primaryCategory: string | null;
  isVerified: boolean;
}) {
  if (params.score >= 55) {
    return {
      priorityLevel: "high",
      priorityReason: "Perfil mais completo, com maior potencial de presença consolidada."
    };
  }

  if (params.website && !params.phone) {
    return {
      priorityLevel: "medium",
      priorityReason: "Tem presença digital, mas ainda faltam dados estratégicos para fortalecer a ficha."
    };
  }

  if (!params.website && !params.phone && !params.city && !params.primaryCategory) {
    return {
      priorityLevel: "high",
      priorityReason: "Perfil com baixa estrutura. Boa oportunidade para otimização e ganho rápido."
    };
  }

  if (params.isVerified) {
    return {
      priorityLevel: "medium",
      priorityReason: "Perfil já validado, com espaço para refinamento e crescimento."
    };
  }

  return {
    priorityLevel: "low",
    priorityReason: "Perfil em estágio intermediário, com menor urgência comercial no momento."
  };
}

function buildAiSummary(params: {
  name: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  primaryCategory: string | null;
  score: number;
  priorityReason: string;
}) {
  const missing = [];

  if (!params.primaryCategory) missing.push("categoria");
  if (!params.city) missing.push("cidade");
  if (!params.phone) missing.push("telefone");
  if (!params.website) missing.push("site");

  const missingText =
    missing.length > 0
      ? `Ainda faltam ${missing.join(", ")}.`
      : "O perfil já tem uma boa base de informações.";

  return `${params.name} está com score ${params.score}/100. ${missingText} ${params.priorityReason}`;
}

export async function refreshBusinessInsights(userId: number) {
  const allBusinesses = await db.query.businesses.findMany({
    where: eq(businesses.userId, userId)
  });

  const allLocations = await db.query.gbpLocations.findMany({
    where: eq(gbpLocations.userId, userId)
  });

  const locationByBusinessId = new Map<number, (typeof allLocations)[number]>();

  for (const location of allLocations) {
    if (!locationByBusinessId.has(location.businessId)) {
      locationByBusinessId.set(location.businessId, location);
    }
  }

  let updated = 0;

  for (const business of allBusinesses) {
    const location = locationByBusinessId.get(business.id);

    const priority = classifyPriority({
      score: business.score,
      website: business.website,
      phone: business.phone,
      city: business.city,
      primaryCategory: business.primaryCategory,
      isVerified: location?.isVerified || false
    });

    const aiSummary = buildAiSummary({
      name: business.name,
      website: business.website,
      phone: business.phone,
      city: business.city,
      state: business.state,
      primaryCategory: business.primaryCategory,
      score: business.score,
      priorityReason: priority.priorityReason
    });

    await db
      .update(businesses)
      .set({
        priorityLevel: priority.priorityLevel,
        priorityReason: priority.priorityReason,
        aiSummary,
        updatedAt: new Date()
      })
      .where(eq(businesses.id, business.id));

    updated += 1;
  }

  return {
    updated
  };
}
