import { adminAuth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,DELETE,PATCH,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
};

export function corsPreflightResponse() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Verifies the Firebase ID token from the Authorization Bearer header.
 * Returns the authenticated user's UID or null if missing/invalid.
 */
export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    console.warn("Invalid Firebase ID token:", error);
    return null;
  }
}
