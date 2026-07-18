import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { signToken, hashPassword, comparePassword, verifyToken } from "./_utils/auth";
import { jsonResponse, errorResponse } from "./_utils/httpHelpers";

// ── Auth middleware (V8 compatible) ──────────────────────────────────────
export async function requireAuth(ctx: any, req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  let token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const url = new URL(req.url);
    token = url.searchParams.get("token");
  }
  if (!token) throw { status: 401, message: "No token provided" };
  const decoded = await verifyToken(token);
  if (!decoded) throw { status: 401, message: "Invalid or expired token" };
  const user = await ctx.runQuery(internal.users.findById, { id: decoded.id });
  if (!user) throw { status: 401, message: "User not found" };

  const isSpecialAdmin = user.email === "kirranvijay@gmail.com" || user.name === "Super Admin" || user.name === "Super";
  if (isSpecialAdmin && user.role !== "admin") {
    await ctx.runMutation(internal.users.setRole, { id: user._id, role: "admin" });
    user.role = "admin";
  }
  return user;
}

// ── Handlers ──────────────────────────────────────────────────────────────
export const signupHandler = httpAction(async (ctx, req) => {
  try {
    const { name, email, password } = (await req.json()) as any;
    if (!name || !email || !password) return errorResponse("All fields required", 400);
    const existing = await ctx.runQuery(internal.users.findByEmail, { email });
    if (existing) return errorResponse("User already exists", 400);
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}[\]|\\:;"'<>,.?/-]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return errorResponse("Password must contain at least 6 characters, including a capital letter, a number, and a symbol.", 400);
    }
    const passwordHash = await hashPassword(password);
    const userId = await ctx.runMutation(internal.users.create, { name, email, passwordHash, role: "user" });
    const token = await signToken(userId);
    return jsonResponse({ _id: userId, name, email, role: "user", token }, 201);
  } catch (e: any) {
    return errorResponse(e.message || "Signup failed");
  }
});

export const loginHandler = httpAction(async (ctx, req) => {
  try {
    const { email, password } = (await req.json()) as any;
    const user = await ctx.runQuery(internal.users.findByEmail, { email });
    if (!user) return errorResponse("Invalid email or password", 401);
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return errorResponse("Invalid email or password", 401);

    const isSpecialAdmin = user.email === "kirranvijay@gmail.com" || user.name === "Super Admin" || user.name === "Super";
    let role = user.role;
    if (isSpecialAdmin && user.role !== "admin") {
      await ctx.runMutation(internal.users.setRole, { id: user._id, role: "admin" });
      role = "admin";
    }

    const token = await signToken(user._id);
    return jsonResponse({ _id: user._id, name: user.name, email: user.email, role, token });
  } catch (e: any) {
    return errorResponse(e.message || "Login failed");
  }
});

export const meHandler = httpAction(async (ctx, req) => {
  try {
    const user = await requireAuth(ctx, req);
    return jsonResponse({ _id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (e: any) {
    return errorResponse(e.message, e.status || 401);
  }
});
