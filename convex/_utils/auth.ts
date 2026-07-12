// V8-compatible auth utilities using jose and bcryptjs
import * as jose from "jose";
import bcrypt from "bcryptjs";

// TextEncoder is globally available in V8 runtime
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "supersecret123");

export async function signToken(userId: string): Promise<string> {
  return await new jose.SignJWT({ id: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ id: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as { id: string };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
