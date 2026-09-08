import express from "express";
import {
  getBuyers,
  createBuyer,
  getBuyerById,
  updateBuyer,
  deleteBuyer,
  getBuyerPrices,
  setBuyerPrice
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getBuyers);
router.post("/", createBuyer);
router.get("/:id", getBuyerById);
router.put("/:id", updateBuyer);
router.delete("/:id", deleteBuyer);

router.get("/:id/prices", getBuyerPrices);
router.post("/:id/prices", setBuyerPrice);

export default router;
