import express from "express";
import {
  getLooms,
  createLoom,
  getLoomById,
  updateLoom,
  deleteLoom
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getLooms);
router.post("/", createLoom);
router.get("/:id", getLoomById);
router.put("/:id", updateLoom);
router.delete("/:id", deleteLoom);

export default router;
