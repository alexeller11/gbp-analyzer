import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Google OAuth Callback Page
 * Handles the redirect from Google OAuth and exchanges the code for a token
 */
export default function GoogleOAuthCallback() {
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthCallback = trpc.googleBusiness.handleOAuthCallback.useMutation();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get the authorization code from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const errorParam = params.get("error");

        if (errorParam) {
          setError(`Google OAuth error: ${errorParam}`);
          toast.error(`Erro no OAuth: ${errorParam}`);
          setIsProcessing(false);
          return;
        }

        if (!code) {
          setError("No authorization code received");
          toast.error("Código de autorização não recebido");
          setIsProcessing(false);
          return;
        }

        // Exchange code for token
        const result = await handleOAuthCallback.mutateAsync({
          code,
          state: state || "",
        });

        if (result.error) {
          setError(result.error);
          toast.error(`Erro: ${result.error}`);
          setIsProcessing(false);
          return;
        }

        toast.success("Conectado com sucesso! Redirecionando...");
        
        // Redirect back to import dialog
        setTimeout(() => {
          setLocation("/dashboard?import=true");
        }, 1500);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        toast.error(`Erro ao processar OAuth: ${message}`);
        setIsProcessing(false);
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        {isProcessing && !error ? (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-center mb-2">Conectando...</h1>
            <p className="text-center text-gray-600">
              Processando sua autenticação com Google Business Profile
            </p>
          </>
        ) : error ? (
          <>
            <div className="text-center mb-4">
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-2xl font-bold text-red-600 mb-2">Erro na Autenticação</h1>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => setLocation("/dashboard")}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Voltar ao Dashboard
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-2xl font-bold text-green-600 mb-2">Sucesso!</h1>
              <p className="text-gray-600">Redirecionando...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
