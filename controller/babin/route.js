import express from "express";
import {
  getBabins,
  createBabin,
  getBabinById,
  updateBabin,
  deleteBabin
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getBabins);
router.post("/", createBabin);
router.get("/:id", getBabinById);
router.put("/:id", updateBabin);
router.delete("/:id", deleteBabin);

export default router;
