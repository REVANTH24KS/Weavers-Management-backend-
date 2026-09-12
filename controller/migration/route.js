import express from "express";
import { importSupabaseData } from "./service.js";

const router = express.Router();

// Route to import / upload Supabase data directly to MongoDB
router.post("/import", importSupabaseData);
router.post("/supabase", importSupabaseData);

export default router;
