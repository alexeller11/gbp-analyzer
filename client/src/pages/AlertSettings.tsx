import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Bell, MessageSquare, CheckCircle2, Send } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AlertSettings() {
  const [, setLocation] = useLocation();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [alertOnNegative, setAlertOnNegative] = useState(true);
  const [alertOnNewReview, setAlertOnNewReview] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = trpc.alerts.getSettings.useQuery();
  const saveMutation = trpc.alerts.saveSettings.useMutation();
  const testMutation = trpc.alerts.testWebhook.useMutation();

  useEffect(() => {
    if (settings) {
      setWebhookUrl(settings.webhookUrl || "");
      setAlertOnNegative(settings.alertOnNegative ?? true);
      setAlertOnNewReview(settings.alertOnNewReview ?? false);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMutation.mutateAsync({ webhookUrl: webhookUrl || undefined, alertOnNegative, alertOnNewReview });
      toast.success("Configurações salvas!");
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!webhookUrl) { toast.error("Insira uma URL de webhook primeiro"); return; }
    setTesting(true);
    try {
      await testMutation.mutateAsync({ webhookUrl });
      toast.success("✅ Mensagem de teste enviada!");
    } catch (e: any) { toast.error(e.message); }
    setTesting(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6" /> Configurar Alertas
            </h1>
            <p className="text-sm text-muted-foreground">Receba notificações via WhatsApp ou Slack</p>
          </div>
        </div>

        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-blue-800">
              Configure um webhook para receber alertas quando uma avaliação negativa chegar.
              Funciona com <strong>WhatsApp (Z-API, UltraMsg)</strong>, <strong>Slack</strong>, <strong>Discord</strong> e qualquer serviço que aceite POST JSON.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Webhook URL</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="https://api.z-api.io/instances/.../send-text"
                value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !webhookUrl} className="flex-shrink-0 gap-1.5">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Testar
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">Exemplos de serviços:</p>
              {[
                { name: "Z-API (WhatsApp)", url: "https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-text" },
                { name: "Slack Webhook", url: "https://hooks.slack.com/services/..." },
                { name: "Discord Webhook", url: "https://discord.com/api/webhooks/..." },
              ].map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 w-32 flex-shrink-0">{s.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate font-mono">{s.url}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4" /> Quando alertar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "negative", label: "⭐ Avaliação negativa (1-2 estrelas)", desc: "Receba alerta imediato para responder rápido", val: alertOnNegative, set: setAlertOnNegative },
              { key: "newreview", label: "💬 Qualquer nova avaliação", desc: "Alerta para toda avaliação recebida", val: alertOnNewReview, set: setAlertOnNewReview },
            ].map(opt => (
              <div key={opt.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${opt.val ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
                onClick={() => opt.set(!opt.val)}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${opt.val ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                  {opt.val && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
