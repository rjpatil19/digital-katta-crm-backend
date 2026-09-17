import { buildFastifyApp } from './app';
import { env } from './config/env';

async function start() {
  const app = buildFastifyApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST
    });
    console.log(`🚀 Digital कट्टा CRM Backend running at ${address}`);
    console.log(`📡 Health Check: ${address}/api/health`);
    console.log(`🔐 Auth API: ${address}/api/v1/auth/login`);
    console.log(`👥 Leads API: ${address}/api/v1/leads`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start if run directly
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  start();
}

export { buildFastifyApp };
