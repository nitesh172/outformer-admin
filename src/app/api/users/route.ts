import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { validateEnv } from "@/lib/env";
import { rateLimit, authenticateRequest, handleError } from "@/lib/api-helpers";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error: any) {
    console.error("Firebase admin initialization error:", error?.message || "Unknown error");
  }
}

export async function POST(request: Request) {
  try {
    // 1. Validate Environment Variables
    validateEnv();

    // 2. Rate Limiting (default: 60 req/min per IP)
    rateLimit(request);

    // 3. Authenticate request (must be admin or team member)
    await authenticateRequest(request, false);

    const { uid, disabled } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: "User ID (uid) is required" }, { status: 400 });
    }

    if (typeof disabled !== "boolean") {
      return NextResponse.json({ error: "disabled must be a boolean" }, { status: 400 });
    }

    await admin.auth().updateUser(uid, { disabled });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}
