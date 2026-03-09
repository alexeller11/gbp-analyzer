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
  const [tab, setTab] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [manual, setManual] = useState({ name: "", category: "", address: "", phone: "", website: "", description: "" });

  const createMutation = trpc.profiles.create.useMutation();
  const extractMutation = trpc.profiles.extractFromUrl.useMutation();
  const syncMutation = trpc.sync.syncFromPlaces.useMutation();

  const handleExtract = async () => {
    if (!url.trim()) { toast.error("Cole o link do Google Maps"); return; }
    setLoading(true);
    try {
      const result = await extractMutation.mutateAsync({ url: url.trim() });
      setPreview(result);
    } catch (e: any) {
      toast.error(e.message || "Não foi possível buscar o negócio");
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

      // Auto-sync reviews from Places API
      if (preview.placeId) {
        try {
          const syncResult = await syncMutation.mutateAsync({ profileId: profile.id });
          toast.success(`✅ ${syncResult.reviewCount} avaliações sincronizadas!`);
        } catch {
          toast.info("Perfil importado. Sincronize as avaliações manualmente.");
        }
      }

      setOpen(false); setUrl(""); setPreview(null);
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

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview(null); setUrl(""); } }}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Adicionar Perfil</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Perfil GBP</DialogTitle>
          <DialogDescription>Importe dados reais do Google Maps ou adicione manualmente</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition ${tab === "url" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
            onClick={() => setTab("url")}
          >
            <Link className="w-3.5 h-3.5 inline mr-1.5" />Link do Google Maps
          </button>
          <button
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition ${tab === "manual" ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
            onClick={() => setTab("manual")}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />Manual
          </button>
        </div>

        {/* URL Tab */}
        {tab === "url" && (
          <div className="space-y-4">
            {!preview ? (
              <>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Cole o link do perfil no Google Maps</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://maps.google.com/..."
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleExtract()}
                    />
                    <Button onClick={handleExtract} disabled={loading}>
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
              </>
            ) : (
              <div className="space-y-3">
                <div className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-lg">{preview.name}</p>
                      <p className="text-sm text-gray-500">{preview.category}</p>
                    </div>
                    {preview.rating && (
                      <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold">{preview.rating}</span>
                        <span className="text-xs text-gray-500">({preview.totalReviews})</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {preview.address && <p className="flex gap-2"><MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />{preview.address}</p>}
                    {preview.phone && <p className="flex gap-2"><Phone className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />{preview.phone}</p>}
                    {preview.website && <p className="flex gap-2"><Globe className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" /><span className="truncate">{preview.website}</span></p>}
                  </div>
                  {preview.reviews?.length > 0 && (
                    <p className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      ✅ {preview.reviews.length} avaliações serão importadas automaticamente
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setPreview(null)}>Voltar</Button>
                  <Button onClick={handleImportPreview} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Importar perfil
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Tab */}
        {tab === "manual" && (
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
