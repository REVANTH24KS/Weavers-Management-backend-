import express from "express";
import {
  getProductionEntries,
  createProductionDispatch,
  updateProductionDispatch,
  deleteProductionDispatch
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getProductionEntries);
router.post("/", createProductionDispatch);
router.put("/dispatch", updateProductionDispatch);
router.delete("/dispatch", deleteProductionDispatch);

export default router;
