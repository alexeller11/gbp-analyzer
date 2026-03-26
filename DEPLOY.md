# GBP Analyzer — Deploy no Railway

## Variáveis de Ambiente obrigatórias

Configure estas variáveis no painel do Railway em Settings → Variables.

| Variável | Valor |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Seu client ID do Google Cloud |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Seu client secret do Google Cloud |
| `DATABASE_URL` | Connection string do banco de dados |
| `APP_URL` | URL gerada pelo Railway, por exemplo `https://gbp-analyzer-production.up.railway.app` |
| `JWT_SECRET` | Uma string longa, aleatória e segura |
| `NODE_ENV` | `production` |

## Redirect URI no Google Cloud Console

Após obter a URL do Railway, adicione em Authorized redirect URIs:

```txt
https://SUA-URL.up.railway.app/api/oauth/google/callback
