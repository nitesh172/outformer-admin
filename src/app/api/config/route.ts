import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env";
import { rateLimit, authenticateRequest, handleError } from "@/lib/api-helpers";

const API_URL = process.env.WORKER_PROXY_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(request: Request) {
  try {
    validateEnv();
    rateLimit(request);
    await authenticateRequest(request, false); // team members and admins can view configuration

    if (!API_SECRET) {
      throw new Error("API_SECRET is missing");
    }

    const response = await fetch(`${API_URL}/config/interview`, {
      method: "GET",
      headers: {
        "x-outerformer-api-key": API_SECRET,
      },
      cache: "no-store",
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Backend status ${response.status}: ${responseText}`);
    }

    return NextResponse.json(JSON.parse(responseText));
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    validateEnv();
    rateLimit(request);
    await authenticateRequest(request, false); // Admins and team members can update configuration

    if (!API_SECRET) {
      throw new Error("API_SECRET is missing");
    }

    const body = await request.json();
    const response = await fetch(`${API_URL}/config/interview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-outerformer-api-key": API_SECRET,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Backend status ${response.status}: ${responseText}`);
    }

    return NextResponse.json(JSON.parse(responseText));
  } catch (error: any) {
    return handleError(error);
  }
}
