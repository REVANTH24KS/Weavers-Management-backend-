import jwt from "jsonwebtoken";
import { User } from "../models/UserSchema.js";

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization token is missing or malformed"
        }
      });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "default_jwt_secret_key_2026";
    
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Token is invalid or has expired"
        }
      });
    }

    const user = await User.findById(decoded.userId || decoded.id || decoded._id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "User not found or account is deactivated"
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action"
        }
      });
    }
    next();
  };
}

export const adminOnly = requireRole("admin");
