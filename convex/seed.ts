"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashPassword } from "./_utils/auth";

/**
 * Run this once after deploying to seed the default admin account.
 * Call from Convex dashboard: Functions → internal.seed.createDefaultAdmin → Run
 */
export const createDefaultAdmin = internalAction({
  args: {},
  handler: async (ctx) => {
    const adminEmail = "kirranvijay@gmail.com";
    const adminPassword = "kirran14";

    const existing = await ctx.runQuery(internal.users.findByEmail, { email: adminEmail });
    const passwordHash = await hashPassword(adminPassword);

    if (existing) {
      // Update password and ensure role is admin
      await ctx.runMutation(internal.users.updatePassword, { id: existing._id, passwordHash });
      await ctx.runMutation(internal.users.setRole, { id: existing._id, role: "admin" });
      console.log("Primary admin credentials updated.");
    } else {
      await ctx.runMutation(internal.users.create, {
        name: "Super Admin",
        email: adminEmail,
        passwordHash,
        role: "admin",
      });
      console.log("Primary admin created successfully.");
    }
  },
});
