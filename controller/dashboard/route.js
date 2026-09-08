import express from "express";
import { getDashboardOverview } from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/overview", getDashboardOverview);

export default router;
