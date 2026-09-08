import express from "express";
import { getUsers, getUserById, updateUser } from "./service.js";
import { authMiddleware, adminOnly } from "../../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);
router.get("/", adminOnly, getUsers);
router.get("/:id", getUserById);
router.put("/:id", adminOnly, updateUser);

export default router;
