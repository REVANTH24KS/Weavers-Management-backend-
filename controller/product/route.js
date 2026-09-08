import express from "express";
import {
  getProducts,
  getNextNumber,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct
} from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/next-number", getNextNumber);
router.get("/", getProducts);
router.post("/", createProduct);
router.get("/:id", getProductById);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
