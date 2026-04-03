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
      priorityLevel: "low",
      priorityReason: "Ficha em bom estado geral. Mantém acompanhamento regular."
    };
  }

  if (params.website && !params.phone) {
    return {
      priorityLevel: "medium",
      priorityReason: "Tem boa base, mas ainda faltam dados importantes para fortalecer a ficha."
    };
  }

  if (!params.website && !params.phone && !params.city && !params.primaryCategory) {
    return {
      priorityLevel: "high",
      priorityReason: "Ficha com baixa completude. Boa candidata para ação prioritária da agência."
    };
  }

  if (params.isVerified) {
    return {
      priorityLevel: "medium",
      priorityReason: "Ficha validada, mas ainda com espaço para otimização operacional."
    };
  }

  return {
    priorityLevel: "medium",
    priorityReason: "Perfil em estágio intermediário e merece acompanhamento."
  };
}

function inferServiceStatus(score: number, isVerified: boolean) {
  if (score < 20 && !isVerified) return "urgent";
  if (score < 40) return "attention";
  return "active";
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
      : "A ficha já tem uma boa base de informações.";

  return `${params.name} está com health score ${params.score}/100. ${missingText} ${params.priorityReason}`;
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
    const isVerified = location?.isVerified || false;

    const priority = classifyPriority({
      score: business.score,
      website: business.website,
      phone: business.phone,
      city: business.city,
      primaryCategory: business.primaryCategory,
      isVerified
    });

    const serviceStatus = inferServiceStatus(business.score, isVerified);

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
        serviceStatus,
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
