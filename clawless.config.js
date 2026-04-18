/**
 * ClawLess Integration — gbp-analyzer
 * Runtime serverless para agentes de IA no browser via WebContainers
 * https://github.com/open-gitagent/clawless
 *
 * Instalação:
 *   npm install clawcontainer
 */

const clawlessConfig = {
  template: 'gitclaw',

  env: {
    AI_PROVIDER: 'google',
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || '',
    OPENAI_API_KEY:    process.env.OPENAI_API_KEY    || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    CLAWLESS_MODEL: 'gemini-2.0-flash',
    PROJECT: 'gbp-analyzer',
    GBP_API_KEY:        process.env.GBP_API_KEY        || '',
    GOOGLE_CLIENT_ID:   process.env.GOOGLE_CLIENT_ID   || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  policy: {
    allowedProcesses: ['node', 'npm', 'npx'],
    fileAccess: {
      read:  ['**/*.js', '**/*.json', '**/*.md'],
      write: ['output/**', 'reports/**'],
      deny:  ['.env', '**/*.key', '**/*.pem'],
    },
    network: {
      allowedHosts: [
        'mybusinessbusinessinformation.googleapis.com',
        'mybusiness.googleapis.com',
        'generativelanguage.googleapis.com',
        'api.openai.com',
        'api.anthropic.com',
      ],
    },
    limits: {
      maxFileSize:  '10mb',
      maxProcesses: 5,
      maxTurns:     20,
      timeout:      '5m',
    },
  },
};

/**
 * Inicializa o ClawContainer para análise de GBP no browser
 *
 * @param {string} selector - seletor CSS do elemento container
 * @returns {Promise<ClawContainer>}
 */
export async function initClawless(selector = '#clawless-panel') {
  const { ClawContainer } = await import('https://esm.sh/clawcontainer@latest');

  const cc = new ClawContainer(selector, clawlessConfig);
  await cc.start();

  cc.on('ready', () => {
    console.log('[ClawLess] Container pronto — agente GBP Analyzer iniciado');
  });

  cc.on('message', (msg) => {
    console.log('[ClawLess] Agente:', msg);
  });

  cc.on('error', (err) => {
    console.error('[ClawLess] Erro no container:', err);
  });

  return cc;
}

export default clawlessConfig;
