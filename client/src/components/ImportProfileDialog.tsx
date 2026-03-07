import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface GoogleProfile {
  id: string; name: string; category: string; address: string;
  phone?: string; website?: string; googleLocationId: string; googleAccountId: string;
}

export function ImportProfileDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const profilesQuery = trpc.googleBusiness.getProfiles.useQuery(undefined, {
    enabled: open,
    retry: false,
  });
  const createMutation = trpc.profiles.create.useMutation();

  const profiles: GoogleProfile[] = profilesQuery.data?.profiles ?? [];
  const apiError = profilesQuery.data?.error;

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => setSelected(new Set(profiles.map(p => p.id)));
  const clearAll  = () => setSelected(new Set());

  const handleImport = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos um perfil"); return; }
    setImporting(true);
    let count = 0;
    for (const p of profiles.filter(p => selected.has(p.id))) {
      try {
        await createMutation.mutateAsync({
          name: p.name, category: p.category, address: p.address,
          phone: p.phone, website: p.website,
          googleAccountId: p.googleAccountId, googleLocationId: p.googleLocationId,
          latitude: 0, longitude: 0,
        });
        count++;
      } catch (e: any) {
        // Ignorar duplicatas (já importados)
        if (!e?.message?.includes("Duplicate")) {
          toast.error(`Erro ao importar "${p.name}"`);
        }
      }
    }
    toast.success(`${count} perfil(is) importado(s) com sucesso!`);
    setOpen(false); setSelected(new Set());
    onSuccess?.();
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>🔄 Importar do Google</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Perfis do Google Business</DialogTitle>
          <DialogDescription>
            Seus perfis do Google Meu Negócio vinculados à sua conta
          </DialogDescription>
        </DialogHeader>

        {/* Carregando */}
        {profilesQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Buscando seus perfis no Google Business...</p>
          </div>
        )}

        {/* Erro de token — não conectado */}
        {!profilesQuery.isLoading && apiError && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Conta Google não conectada</p>
                <p>Você precisa fazer login com sua conta Google Business para importar perfis.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => { window.location.href = "/api/auth/google-login"; }}>
                🔐 Conectar conta Google
              </Button>
            </div>
          </div>
        )}

        {/* Sem perfis */}
        {!profilesQuery.isLoading && !apiError && profiles.length === 0 && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-gray-600 font-medium">Nenhum perfil encontrado</p>
            <p className="text-sm text-gray-400 mt-1">Sua conta não tem perfis no Google Business Profile.</p>
            <Button variant="outline" className="mt-4" onClick={() => profilesQuery.refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
            </Button>
          </div>
        )}

        {/* Lista de perfis */}
        {!profilesQuery.isLoading && !apiError && profiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{profiles.length} perfil(is) encontrado(s)</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>Selecionar todos</Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>Limpar</Button>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {profiles.map(p => (
                <div key={p.id}
                  className="border rounded-lg p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggle(p.id)}>
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category}</p>
                    <p className="text-xs text-gray-400 truncate">{p.address}</p>
                    {p.phone && <p className="text-xs text-gray-400">📞 {p.phone}</p>}
                    {p.website && <p className="text-xs text-blue-500 truncate">🌐 {p.website}</p>}
                  </div>
                  {selected.has(p.id) && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-gray-500">{selected.size} selecionado(s)</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>Cancelar</Button>
                <Button onClick={handleImport} disabled={importing || selected.size === 0}>
                  {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importar {selected.size > 0 && `(${selected.size})`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
