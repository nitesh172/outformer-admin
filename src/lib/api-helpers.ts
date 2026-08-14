import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Firebase admin initialization error:", message);
  }
}

// In-Memory Rate Limiter Store
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const limiters = new Map<string, RateLimitBucket>();

function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = limiters.get(ip) || { tokens: limit, lastRefill: now };

  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = (timePassed / windowMs) * limit;
  bucket.tokens = Math.min(limit, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    limiters.set(ip, bucket);
    return true;
  }
  
  limiters.set(ip, bucket);
  return false;
}

export function rateLimit(request: Request, limit = 60, windowMs = 60000) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "127.0.0.1";
  if (!checkRateLimit(ip, limit, windowMs)) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }
}

// Authorization check helper
export async function authenticateRequest(request: Request, requireAdmin = false) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED: Missing or invalid token");
  }
  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  
  if (requireAdmin) {
    if (!decodedToken.admin) {
      throw new Error("FORBIDDEN: Admin privileges required");
    }
  } else {
    if (!decodedToken.admin && !decodedToken.team_member) {
      throw new Error("FORBIDDEN: Authorized access required");
    }
  }
  return decodedToken;
}

// Secure error handling utility
export function handleError(error: unknown) {
  const correlationId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  console.error(`[Correlation ID: ${correlationId}] Detailed error:`, error);
  
  let status = 500;
  let message = "An internal server error occurred.";
  
  const errMessage = error instanceof Error ? error.message : String(error);
  
  if (errMessage.includes("UNAUTHORIZED")) {
    status = 401;
    message = "Unauthorized. Missing or invalid authentication token.";
  } else if (errMessage.includes("FORBIDDEN")) {
    status = 403;
    message = "Forbidden. You do not have permission to access this resource.";
  } else if (errMessage === "RATE_LIMIT_EXCEEDED") {
    status = 429;
    message = "Too many requests. Please try again later.";
  }
  
  return NextResponse.json({ error: message, correlationId }, { status });
}
