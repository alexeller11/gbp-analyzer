# GBP Analyzer - TODO

## Autenticação e Usuários
- [x] Configurar OAuth com Google
- [x] Página de login (integrada com Home)
- [x] Sistema de logout
- [x] Proteção de rotas autenticadas

## Gerenciamento de Perfis
- [ ] Importar perfis do Google Business
- [x] Listar perfis do usuário
- [x] Visualizar detalhes de perfil
- [ ] Editar informações de perfil
- [ ] Deletar perfil
- [ ] Sincronizar dados com Google

## Dashboard Principal
- [x] Layout do dashboard com sidebar
- [x] Listagem de perfis com cards
- [x] Botão de importação de perfis (dialog pronto)
- [x] Filtros e busca de perfis
- [x] Indicadores de status

## Análise de Perfil
- [x] Página de análise detalhada
- [x] Cálculo de score 0-100 (5 dimensões)
  - [x] Completeness
  - [x] Review Score
  - [x] Engagement
  - [x] Consistency
  - [x] Media Score
- [x] Visualização de métricas
- [ ] Gráficos de performance

## Análise de Reviews
- [ ] Importar reviews do Google
- [x] Análise de sentimento (NLP) - estrutura pronta
- [x] Filtros por rating - UI pronta
- [x] Taxa de resposta - UI pronta
- [x] Palavras-chave mais frequentes - UI pronta
- [x] Tendências de sentimento - estrutura pronta

## Concorrentes
- [ ] Busca de concorrentes via Places API
- [x] Listagem de concorrentes próximos (raio 2km) - UI pronta
- [x] Comparação de ratings - UI pronta
- [ ] Análise de reviews dos concorrentes

## Sugestões de Melhoria
- [ ] Gerador automático de sugestões
- [x] Priorização de sugestões - UI pronta
- [ ] Toggle de conclusão - estrutura pronta
- [x] Impacto estimado de cada sugestão - UI pronta

## IA Consultora
- [x] Chat com Groq API (Llama 2) - integrado
- [x] Contexto de perfil no chat - implementado
- [x] Histórico de conversa - salvo no banco
- [x] Sugestões baseadas em IA - via Groq

## Integração com APIs
- [x] Google My Business API - helper criado, rota tRPC pronta
- [x] Google OAuth - helper criado com fluxo de autenticação
- [x] Groq API (Llama 2) - integrada

## Autenticação com Google OAuth
- [x] Helper google-oauth.ts com funções de autenticação
- [x] Geração de URL de autorização
- [x] Troca de código por token de acesso
- [x] Refresh de tokens
- [x] Obtenção de informações do usuário Google

## Dashboard de Comparação com Concorrentes
- [x] Página CompetitorComparison.tsx
- [x] Gráfico de comparação de métricas (Bar Chart)
- [x] Gráfico Radar para análise detalhada
- [x] Lista de concorrentes identificados
- [x] Seção de oportunidades de melhoria
- [x] Rota adicionada ao App.tsx
- [x] Botão de acesso na página de análise

## Exportação de Relatórios em PDF
- [x] Helper pdf-report.ts com geração de PDF
- [x] Integração com jsPDF
- [x] Rota tRPC reports.generatePDF
- [x] Relatório com informações do perfil, scores, sugestões e reviews
- [x] Botão de exportação na página de análise

## Gráficos de Performance
- [x] Página de gráficos com Recharts
- [x] Gráfico de distribuição de score (Pie Chart)
- [x] Gráfico de visualizações e buscas (Line Chart)
- [x] Gráfico de interações (Bar Chart)
- [x] Gráfico de visualizações de fotos
- [x] Rota adicionada ao App.tsx
- [x] Botão de acesso na página de análise

## Gerador Automático de Sugestões
- [x] Rota tRPC generateSuggestions.generateForProfile
- [x] Integração com Groq API
- [x] Parsing e salva de sugestões no banco de dados
- [x] Sugestões com categoria, título, descrição e impacto estimado

## Testes
- [x] Testes unitários das funções de cálculo (15 testes passando)
- [x] Testes de API routes (Groq, Profiles, Auth)
- [x] Todos os 15 testes passando com sucesso

## Deploy
- [ ] Configuração de variáveis de ambiente
- [ ] Build otimizado
- [ ] Deploy na Manus

## Bug Fixes
- [x] Corrigir ImportProfileDialog para listar perfis do Google Business
- [x] Implementar sincronização de perfis após seleção
- [x] Adicionar feedback visual durante importação
- [x] Fluxo de 3 passos: Conectar -> Selecionar -> Importar

## Integração Google My Business API (Real)
- [x] Implementar rota tRPC para obter perfis do Google My Business
- [x] Integrar Google OAuth para obter access token
- [x] Atualizar ImportProfileDialog para chamar API real
- [x] Testar integração com Google My Business API
- [x] Helper google-mybusiness-api.ts com funções da API
- [x] Rota tRPC googleBusiness.getProfiles

## OAuth Google (Automático)
- [x] Implementar rota tRPC para callback OAuth do Google
- [x] Criar página de redirecionamento OAuth (GoogleOAuthCallback.tsx)
- [x] Atualizar ImportProfileDialog com fluxo OAuth automático
- [x] Helper google-oauth-tokens.ts para gerenciar tokens
- [x] Rotas tRPC: handleOAuthCallback e getOAuthUrl
- [x] Fluxo completo de OAuth: redirect -> callback -> token exchange -> perfis


## Bug Fixes - Fluxo OAuth
- [x] Debugar erro no fluxo OAuth end-to-end
- [x] Corrigir ImportProfileDialog para funcionar com OAuth real
- [x] Validar callback OAuth e redirecionamento
- [x] Corrigir require() em ESM para import ESM
- [x] Adicionar origin parameter ao getOAuthUrl
- [x] Alterar getOAuthUrl de query para mutation
- [x] Adicionar rotas getLatest e create ao router de scores

## Sincronização Automática de Reviews (Tempo Real)
- [ ] Implementar sincronização em tempo real
- [ ] Adicionar webhooks do Google Business Profile
- [ ] Notificações para novos reviews
- [ ] Atualizar sentimento e análise automaticamente

## Bug Fix - Erro 403 Forbidden no OAuth
- [x] Corrigir redirect URI para incluir /api no caminho
- [x] Validar que redirect URI corresponde ao registrado no Google Cloud Console
- [x] Testar fluxo OAuth com redirect URI correto
- [x] Configurar domínio customizado permanente (gbpanalyzer-avvqsmql.manus.space)
- [x] Registrar domínio no Google Cloud Console
- [x] Adicionar rota específica para Google OAuth callback (/api/oauth/google/callback)
- [x] Implementar tratamento de state e redirecionamento após callback

## Bug Fix - Remover Mock Data e Usar API Real do Google Business Profile
- [ ] Remover dados fictícios da rota googleBusiness.getProfiles
- [ ] Implementar chamada real para Google Business Profile API v1
- [ ] Armazenar token OAuth após login para uso posterior
- [ ] Usar token OAuth para autenticar chamadas à API do Google
- [ ] Filtrar apenas perfis com type: 'BUSINESS'
- [ ] Testar com perfis reais (VPS Turismo, Ideale, Objetiva, etc)
- [ ] Validar que perfis aparecem corretamente no dashboard
