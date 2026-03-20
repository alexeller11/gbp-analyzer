import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link, Plus, Search, Star, MapPin, Phone, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function ImportProfileDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"url" | "name" | "manual">("url");
  const [url, setUrl] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [manual, setManual] = useState({ name: "", category: "", address: "", phone: "", website: "", description: "" });

  const createMutation = trpc.profiles.create.useMutation();
  const extractMutation = trpc.profiles.extractFromUrl.useMutation();
  const syncMutation = trpc.sync.syncFromPlaces.useMutation();

  const handleExtract = async (query: string) => {
    if (!query.trim()) { toast.error("Digite algo para buscar"); return; }
    setLoading(true);
    try {
      const result = await extractMutation.mutateAsync({ url: query.trim() });
      setPreview(result);
    } catch (e: any) {
      toast.error(e.message || "Não foi possível encontrar o negócio");
    } finally {
      setLoading(false);
    }
  };

  const handleImportPreview = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const profile = await createMutation.mutateAsync({
        name: preview.name,
        category: preview.category,
        address: preview.address,
        phone: preview.phone,
        website: preview.website,
        description: preview.description,
        googleAccountId: "places",
        googleLocationId: preview.placeId || `places_${Date.now()}`,
        latitude: preview.lat || 0,
        longitude: preview.lng || 0,
        totalReviews: preview.totalReviews,
        avgRating: preview.rating,
      });

      toast.success("Perfil importado! Sincronizando avaliações...");

      if (preview.placeId) {
        try {
          const syncResult = await syncMutation.mutateAsync({ profileId: profile.id });
          toast.success(`✅ ${syncResult.reviewCount} avaliações sincronizadas!`);
        } catch {
          toast.info("Perfil importado. Sincronize as avaliações manualmente.");
        }
      }

      setOpen(false); setUrl(""); setNameQuery(""); setPreview(null);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = async () => {
    if (!manual.name || !manual.category || !manual.address) {
      toast.error("Nome, categoria e endereço são obrigatórios");
      return;
    }
    setLoading(true);
    try {
      await createMutation.mutateAsync({
        ...manual,
        googleAccountId: "manual",
        googleLocationId: `manual_${Date.now()}`,
        latitude: 0, longitude: 0,
      });
      toast.success("Perfil adicionado!");
      setOpen(false);
      setManual({ name: "", category: "", address: "", phone: "", website: "", description: "" });
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar perfil");
    } finally {
      setLoading(false);
    }
  };

  const resetPreview = () => { setPreview(null); setUrl(""); setNameQuery(""); };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetPreview(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Adicionar Perfil</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Perfil GBP</DialogTitle>
          <DialogDescription>Importe dados reais do Google Maps ou adicione manualmente</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg text-xs">
          {([["url", "🔗 Link"], ["name", "🔍 Nome"], ["manual", "✏️ Manual"]] as const).map(([key, label]) => (
            <button key={key}
              className={`flex-1 py-1.5 px-2 rounded-md font-medium transition ${tab === key ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
              onClick={() => { setTab(key); resetPreview(); }}
            >{label}</button>
          ))}
        </div>

        {/* Preview (shared between URL and Name tabs) */}
        {preview && (
          <div className="space-y-3">
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-lg leading-tight">{preview.name}</p>
                  <p className="text-sm text-gray-500">{preview.category}</p>
                </div>
                {preview.rating && (
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg flex-shrink-0">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-sm">{preview.rating}</span>
                    <span className="text-xs text-gray-500">({preview.totalReviews})</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {preview.address && <p className="flex gap-2"><MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />{preview.address}</p>}
                {preview.phone && <p className="flex gap-2"><Phone className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />{preview.phone}</p>}
                {preview.website && <p className="flex gap-2"><Globe className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" /><span className="truncate text-blue-600">{preview.website}</span></p>}
              </div>
              {preview.reviews?.length > 0 && (
                <p className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  ✅ {preview.reviews.length} avaliações serão importadas automaticamente
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetPreview}>Voltar</Button>
              <Button onClick={handleImportPreview} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Importar este perfil
              </Button>
            </div>
          </div>
        )}

        {/* Tab: URL */}
        {!preview && tab === "url" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">Cole o link do perfil no Google Maps</p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://maps.app.goo.gl/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleExtract(url)}
                />
                <Button onClick={() => handleExtract(url)} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Como obter o link:</p>
              <p>1. Abra o Google Maps e pesquise o negócio</p>
              <p>2. Clique em <b>"Compartilhar"</b> → <b>"Copiar link"</b></p>
              <p>3. Cole o link aqui</p>
            </div>
          </div>
        )}

        {/* Tab: Nome */}
        {!preview && tab === "name" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">Digite o nome e cidade do negócio</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Pizzaria Dom João, São Paulo"
                  value={nameQuery}
                  onChange={e => setNameQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleExtract(nameQuery)}
                />
                <Button onClick={() => handleExtract(nameQuery)} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
              💡 Seja específico: inclua o nome completo e a cidade para melhores resultados.
            </div>
          </div>
        )}

        {/* Tab: Manual */}
        {!preview && tab === "manual" && (
          <div className="space-y-3">
            <Input placeholder="Nome do negócio *" value={manual.name} onChange={e => setManual(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Categoria (ex: Restaurante, Academia) *" value={manual.category} onChange={e => setManual(p => ({ ...p, category: e.target.value }))} />
            <Input placeholder="Endereço completo *" value={manual.address} onChange={e => setManual(p => ({ ...p, address: e.target.value }))} />
            <Input placeholder="Telefone" value={manual.phone} onChange={e => setManual(p => ({ ...p, phone: e.target.value }))} />
            <Input placeholder="Site" value={manual.website} onChange={e => setManual(p => ({ ...p, website: e.target.value }))} />
            <Input placeholder="Descrição do negócio" value={manual.description} onChange={e => setManual(p => ({ ...p, description: e.target.value }))} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleManualImport} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
