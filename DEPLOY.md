# GBP Analyzer — Deploy no Railway

## Variáveis de Ambiente obrigatórias

Configure estas variáveis no painel do Railway (Settings → Variables):

| Variável | Valor |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | `141533490282-bvdni42f8pk841d6pqj4o1439rqdt9j5.apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `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` |
| `DATABASE_URL` | Connection string do PlanetScale |
| `APP_URL` | URL gerada pelo Railway (ex: `https://gbp-analyzer-production.up.railway.app`) |
| `JWT_SECRET` | Qualquer string longa e aleatória |
| `NODE_ENV` | `production` |

## Redirect URI no Google Cloud Console

Após obter a URL do Railway, adicione em Authorized redirect URIs:
```
https://SUA-URL.up.railway.app/api/oauth/google/callback
```

## Passos de deploy

1. Suba este ZIP no Railway via GitHub ou upload direto
2. Configure as variáveis acima
3. Após o primeiro deploy, copie a URL gerada e preencha APP_URL
4. Adicione a URL como Redirect URI no Google Cloud Console
5. Faça redeploy — pronto!
