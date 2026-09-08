import express from "express";
import {
  getTransactions,
  issueMaterial,
  returnMaterial,
  updateTransaction,
  deleteTransaction
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getTransactions);
router.post("/issue", issueMaterial);
router.put("/issue/:id", updateTransaction);
router.delete("/issue/:id", deleteTransaction);
router.post("/return", returnMaterial);
router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

export default router;
