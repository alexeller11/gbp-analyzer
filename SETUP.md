# GBP Analyzer — Deploy Railway (5 passos)

## Pré-requisitos
- Conta Railway (railway.app) — grátis
- Conta PlanetScale (planetscale.com) — grátis  
- Repositório GitHub com o código

---

## Passo 1 — Banco de dados (PlanetScale)

1. Acesse planetscale.com → New Database → nome: `gbp-analyzer`
2. Connect → Node.js → copie a **connection string**

---

## Passo 2 — Deploy no Railway

1. railway.app → New Project → Deploy from GitHub repo
2. Conecte seu repositório com o código deste ZIP

---

## Passo 3 — Variáveis de ambiente (Railway → Variables)

| Variável | Valor |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | `141533490282-bvdni42f8pk841d6pqj4o1439rqdt9j5.apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `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` |
| `DATABASE_URL` | Connection string do PlanetScale |
| `ANTHROPIC_API_KEY` | Sua chave da Anthropic (console.anthropic.com) |
| `JWT_SECRET` | Qualquer string longa aleatória |
| `NODE_ENV` | `production` |
| `APP_URL` | **(preencher no Passo 4)** |

---

## Passo 4 — URL do app

Após o 1º deploy, vá em **Settings → Domains → Generate Domain**.

Copie a URL (ex: `https://gbp-analyzer-production.up.railway.app`) e adicione como `APP_URL`.

O Railway vai reiniciar com a nova variável.

---

## Passo 5 — Google Cloud Console

Em [console.cloud.google.com](https://console.cloud.google.com) → Credentials → seu OAuth Client:

**Authorized redirect URIs:**
```
https://SEU-APP.up.railway.app/api/oauth/google/callback
```

**Authorized JavaScript origins:**
```
https://SEU-APP.up.railway.app
```

Salve. Pronto — o app está online com login Google real! 🎉
