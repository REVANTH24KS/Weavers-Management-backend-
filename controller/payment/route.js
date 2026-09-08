import express from "express";
import { markPaid, getUnpaidPayments } from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.patch("/mark-paid", markPaid);
router.get("/unpaid", getUnpaidPayments);

export default router;
