import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { storage } from "./storage";

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  return secret;
}

function signAdminVerification(timestamp: number): string {
  const payload = `admin-verified:${timestamp}`;
  const hmac = crypto.createHmac("sha256", getSigningSecret());
  hmac.update(payload);
  return `${timestamp}.${hmac.digest("hex")}`;
}

function verifyAdminSignature(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const timestamp = parseInt(parts[0], 10);
    if (isNaN(timestamp)) return false;
    if (Date.now() - timestamp > 5 * 60 * 1000) return false;
    const expected = signAdminVerification(timestamp);
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    if (tokenBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any, role?: "student" | "professor" | "admin", isSuperAdmin?: boolean) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    role: role,
    isSuperAdmin: isSuperAdmin,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    // Don't upsert user here - we'll do it in callback with the correct role
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    const role = req.query.role as string | undefined;
    
    // Check if admin code was verified server-side (within last 5 minutes)
    const adminCodeVerified = (req.session as any).adminCodeVerified === true;
    const verifiedAt = (req.session as any).adminCodeVerifiedAt || 0;
    const isRecentVerification = Date.now() - verifiedAt < 5 * 60 * 1000; // 5 minute window
    const isValidAdminVerification = adminCodeVerified && isRecentVerification;
    
    // Store role in cookie that survives OIDC redirect (session is unreliable across redirects)
    if (role && ["student", "professor", "admin"].includes(role)) {
      // Set pending role cookie (expires in 5 minutes)
      res.cookie("pendingRole", role, {
        httpOnly: true,
        secure: true,
        maxAge: 5 * 60 * 1000, // 5 minutes
        sameSite: "lax",
      });
      
      if (role === "admin" && isValidAdminVerification) {
        const signedToken = signAdminVerification(Date.now());
        res.cookie("adminVerifyToken", signedToken, {
          httpOnly: true,
          secure: true,
          maxAge: 5 * 60 * 1000,
          sameSite: "lax",
        });
      }
    }
    
    // Clear the admin verification flags from session after use
    delete (req.session as any).adminCodeVerified;
    delete (req.session as any).adminCodeVerifiedAt;
    
    console.log(`[Auth] /api/login - role: ${role}, isValidAdminVerification: ${isValidAdminVerification}`);
    
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any, info: any) => {
      if (err || !user) {
        console.log("[Auth] /api/callback - auth failed, redirecting to login");
        return res.redirect("/api/login");
      }
      
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.log("[Auth] /api/callback - login failed, redirecting to login");
          return res.redirect("/api/login");
        }
        
        // Get the pending role from cookie (set in /api/login - survives OIDC redirect)
        const pendingRole = req.cookies?.pendingRole as "student" | "professor" | "admin" | undefined;
        const adminVerifyToken = req.cookies?.adminVerifyToken as string | undefined;
        const isVerifiedAdmin = adminVerifyToken ? verifyAdminSignature(adminVerifyToken) : false;
        
        console.log(`[Auth] /api/callback - pendingRole from cookie: ${pendingRole}, isVerifiedAdmin: ${isVerifiedAdmin}`);
        
        // Create/update user with the correct role
        if (user.claims?.sub) {
          const claims = user.claims;
          let effectiveRole: "student" | "professor" | "admin" = "student";
          let isSuperAdmin = false;
          
          if (pendingRole === "admin" && isVerifiedAdmin) {
            effectiveRole = "admin";
            isSuperAdmin = true;
          } else if (pendingRole === "professor") {
            effectiveRole = "professor";
          } else if (pendingRole === "student") {
            effectiveRole = "student";
          }
          
          console.log(`[Auth] Creating/updating user ${claims.email} with role: ${effectiveRole}, isSuperAdmin: ${isSuperAdmin}`);
          
          await upsertUser(claims, effectiveRole, isSuperAdmin);
          
          if (pendingRole) {
            await storage.upsertUserWithRole(claims["sub"], effectiveRole, isSuperAdmin);
            console.log(`[Auth] Explicitly applied role ${effectiveRole} for user ${claims.email}`);
          }
          
          console.log(`[Auth] User ${claims.email} created/updated successfully`);
          
          res.clearCookie("pendingRole");
          res.clearCookie("adminVerifyToken");
        }
        
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    res.clearCookie("pendingRole");
    res.clearCookie("adminVerifyToken");
    res.clearCookie("connect.sid");
    
    req.logout(() => {
      // Destroy the session completely
      req.session.destroy(() => {
        // Redirect to Replit's end session endpoint to clear their session too
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  });
  
  // Fresh login endpoint - logs out of Replit first, then redirects to login
  // This is for shared computers where users need to switch accounts
  app.get("/api/fresh-login", (req, res) => {
    const role = req.query.role as string | undefined;
    
    // Store the role in a cookie so we can use it after the logout redirect
    if (role && ["student", "professor", "admin"].includes(role)) {
      res.cookie("pendingRole", role, {
        httpOnly: true,
        secure: true,
        maxAge: 5 * 60 * 1000, // 5 minutes
        sameSite: "lax",
      });
    }
    
    res.clearCookie("connect.sid");
    res.clearCookie("adminVerifyToken");
    
    // Build the URL to return to after Replit logout
    const returnUrl = `${req.protocol}://${req.hostname}/api/login${role ? `?role=${role}` : ''}`;
    
    // Log out of local session
    req.logout(() => {
      if (req.session) {
        req.session.destroy(() => {
          // Redirect to Replit's end session endpoint, then back to our login
          res.redirect(
            client.buildEndSessionUrl(config, {
              client_id: process.env.REPL_ID!,
              post_logout_redirect_uri: returnUrl,
            }).href
          );
        });
      } else {
        // No session to destroy, just redirect
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: returnUrl,
          }).href
        );
      }
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
