import express from "express";
import {
  getRates,
  createRate,
  updateRate,
  deleteRate
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getRates);
router.post("/", createRate);
router.put("/:id", updateRate);
router.delete("/:id", deleteRate);

export default router;
