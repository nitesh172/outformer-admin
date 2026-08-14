const REQUIRED_SERVER_ENV = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "WORKER_PROXY_URL",
  "API_SECRET",
] as const;

const REQUIRED_CLIENT_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
] as const;

export function validateEnv() {
  const missingServer = REQUIRED_SERVER_ENV.filter((key) => !process.env[key]);
  const missingClient = REQUIRED_CLIENT_ENV.filter((key) => !process.env[key]);

  if (missingServer.length > 0 || missingClient.length > 0) {
    const errorMsg = `Critical environment variables missing! Server: [${missingServer.join(
      ", "
    )}], Client: [${missingClient.join(", ")}]`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}
