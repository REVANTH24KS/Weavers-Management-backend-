import express from "express";
import { register, login, demoLogin, getMe } from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/demo-login", demoLogin);
router.get("/me", authMiddleware, getMe);

export default router;
