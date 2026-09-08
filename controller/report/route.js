import express from "express";
import { getStockOverview, getBillDataReport } from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/stock-overview", getStockOverview);
router.get("/bill-data", getBillDataReport);

export default router;
