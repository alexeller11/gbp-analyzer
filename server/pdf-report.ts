import { jsPDF } from "jspdf";
import type { Profile, Score, Suggestion, Review } from "../drizzle/schema";

/**
 * Generate PDF report for a profile
 */
export async function generateProfileReport(
  profile: Profile,
  score: Score | null,
  suggestions: Suggestion[],
  reviews: Review[]
): Promise<Buffer> {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Helper function to add text with automatic page break
  const addText = (
    text: string,
    options: { fontSize?: number; bold?: boolean; color?: [number, number, number] } = {}
  ) => {
    const { fontSize = 12, bold = false, color = [0, 0, 0] } = options;
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    if (bold) {
      doc.setFont("helvetica", "bold");
    } else {
      doc.setFont("helvetica", "normal");
    }

    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.35;

    for (const line of lines) {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    }
  };

  // Title
  addText("Relatório de Análise - Google Business Profile", {
    fontSize: 20,
    bold: true,
    color: [0, 51, 102],
  });
  yPosition += 5;

  // Profile Info
  addText(`Perfil: ${profile.name}`, { fontSize: 14, bold: true });
  addText(`Categoria: ${profile.category}`, { fontSize: 11 });
  addText(`Endereço: ${profile.address}`, { fontSize: 11 });
  if (profile.phone) addText(`Telefone: ${profile.phone}`, { fontSize: 11 });
  if (profile.website) addText(`Website: ${profile.website}`, { fontSize: 11 });
  yPosition += 10;

  // Score Section
  if (score) {
    addText("Pontuação Geral", { fontSize: 14, bold: true, color: [0, 102, 204] });
    addText(`Score Total: ${score.total.toFixed(1)}/100`, { fontSize: 12, bold: true });
    yPosition += 5;

    addText("Detalhamento por Dimensão:", { fontSize: 11, bold: true });
    addText(`• Completeness: ${score.completeness.toFixed(1)}/100`, { fontSize: 10 });
    addText(`• Review Score: ${score.reviewScore.toFixed(1)}/100`, { fontSize: 10 });
    addText(`• Engagement: ${score.engagement.toFixed(1)}/100`, { fontSize: 10 });
    addText(`• Consistency: ${score.consistency.toFixed(1)}/100`, { fontSize: 10 });
    addText(`• Media Score: ${score.mediaScore.toFixed(1)}/100`, { fontSize: 10 });
    yPosition += 10;
  }

  // Metrics Section
  addText("Métricas do Perfil", { fontSize: 14, bold: true, color: [0, 102, 204] });
  addText(`Avaliação Média: ${profile.avgRating?.toFixed(1) || "N/A"}/5`, { fontSize: 11 });
  addText(`Total de Avaliações: ${profile.totalReviews || 0}`, { fontSize: 11 });
  addText(`Fotos: ${profile.photoCount || 0}`, { fontSize: 11 });
  addText(`Posts: ${profile.postCount || 0}`, { fontSize: 11 });
  addText(`Verificado: ${profile.isVerified ? "Sim" : "Não"}`, { fontSize: 11 });
  yPosition += 10;

  // Suggestions Section
  if (suggestions.length > 0) {
    addText("Sugestões de Melhoria", { fontSize: 14, bold: true, color: [0, 102, 204] });
    yPosition += 5;

    const highPriority = suggestions.filter((s) => s.priority === "high").slice(0, 5);
    const mediumPriority = suggestions.filter((s) => s.priority === "medium").slice(0, 3);

    if (highPriority.length > 0) {
      addText("Prioridade Alta:", { fontSize: 11, bold: true });
      highPriority.forEach((s, i) => {
        addText(`${i + 1}. ${s.title}`, { fontSize: 10, bold: true });
        addText(s.description, { fontSize: 9 });
        if (s.impact) {
          addText(`Impacto Estimado: ${s.impact.toFixed(0)}%`, { fontSize: 9 });
        }
        yPosition += 2;
      });
    }

    if (mediumPriority.length > 0) {
      addText("Prioridade Média:", { fontSize: 11, bold: true });
      mediumPriority.forEach((s, i) => {
        addText(`${i + 1}. ${s.title}`, { fontSize: 10 });
        addText(s.description, { fontSize: 9 });
        yPosition += 2;
      });
    }

    yPosition += 5;
  }

  // Reviews Summary
  if (reviews.length > 0) {
    addText("Resumo de Avaliações", { fontSize: 14, bold: true, color: [0, 102, 204] });
    addText(`Total de Avaliações: ${reviews.length}`, { fontSize: 11 });

    const avgRating =
      reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
    addText(`Avaliação Média: ${avgRating.toFixed(1)}/5`, { fontSize: 11 });

    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    yPosition += 5;
    addText("Distribuição de Ratings:", { fontSize: 10, bold: true });
    Object.entries(ratingDistribution).forEach(([rating, count]) => {
      addText(`${rating} estrelas: ${count} avaliações`, { fontSize: 9 });
    });

    yPosition += 10;
  }

  // Footer
  yPosition = pageHeight - 20;
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Relatório gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    margin,
    yPosition
  );

  return Buffer.from(doc.output("arraybuffer"));
}
