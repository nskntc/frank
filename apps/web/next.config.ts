import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// O .env fica na raiz do monorepo; o Next so le o da propria pasta.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // sem .env na raiz (CI ou primeira execucao): valem as variaveis do ambiente
}

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
