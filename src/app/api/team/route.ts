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

export async function GET(request: Request) {
  try {
    validateEnv();
    rateLimit(request);
    await authenticateRequest(request, false); // admin or team_member is allowed to list

    const listUsersResult = await admin.auth().listUsers(1000);
    const teamMembers = listUsersResult.users
      .filter((user) => user.customClaims && (user.customClaims.admin || user.customClaims.team_member))
      .map((user) => ({
        id: user.uid,
        email: user.email || "",
        displayName: user.displayName || user.email?.split("@")[0] || "Unknown Member",
        role: user.customClaims?.admin ? "admin" : "team",
      }));
    return NextResponse.json(teamMembers);
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    validateEnv();
    rateLimit(request);
    await authenticateRequest(request, true); // Only administrator can manage team claims

    const { email, role, action } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (action === "DELETE") {
      try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, {});
      } catch (err: any) {
        console.warn("User not found in Auth during claims reset", err.message);
      }
      return NextResponse.json({ success: true });
    }

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
    } catch (authError: any) {
      if (authError.code === "auth/user-not-found") {
        return NextResponse.json({ error: "User with this email does not exist. They must register an account first." }, { status: 404 });
      } else {
        throw authError;
      }
    }

    const claims = role === "ADMIN" ? { admin: true } : { team_member: true };
    await admin.auth().setCustomUserClaims(user.uid, claims);

    return NextResponse.json({ success: true, uid: user.uid });
  } catch (error: any) {
    return handleError(error);
  }
}
