import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../../models/UserSchema.js";

function generateToken(user) {
  const secret = process.env.JWT_SECRET || "default_jwt_secret_key_2026";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn }
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Name, email, and password are required"
        }
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: "CONFLICT",
          message: "A user with this email already exists"
        }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role === "admin" ? "admin" : "staff",
      isActive: true
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required"
        }
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        }
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        }
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function demoLogin(req, res, next) {
  try {
    const demoEmail = process.env.DEMO_EMAIL || "demo@weaverstock.app";
    const demoPassword = process.env.DEMO_PASSWORD || "demo-weaver-2026";

    let user = await User.findOne({ email: demoEmail }).select("+password");
    if (!user) {
      const hashedPassword = await bcrypt.hash(demoPassword, 10);
      user = await User.create({
        name: "Demo Admin",
        email: demoEmail,
        password: hashedPassword,
        role: "admin",
        isActive: true
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Logged in as demo user",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
}
