import express from "express";
import {
  getWeavers,
  getNextCode,
  createWeaver,
  getWeaverById,
  updateWeaver,
  deleteWeaver
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/next-code", getNextCode);
router.get("/", getWeavers);
router.post("/", createWeaver);
router.get("/:id", getWeaverById);
router.put("/:id", updateWeaver);
router.delete("/:id", deleteWeaver);

export default router;
