import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { dbConnection } from "./db.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routes
import authRouter from "./controller/auth/route.js";
import userRouter from "./controller/user/route.js";
import weaverRouter from "./controller/weaver/route.js";
import productRouter from "./controller/product/route.js";
import loomRouter from "./controller/loom/route.js";
import babinRouter from "./controller/babin/route.js";
import rateRouter from "./controller/rate/route.js";
import transactionRouter from "./controller/transaction/route.js";
import productionRouter from "./controller/production/route.js";
import paymentRouter from "./controller/payment/route.js";
import dashboardRouter from "./controller/dashboard/route.js";
import reportRouter from "./controller/report/route.js";
import buyerRouter from "./controller/buyer/route.js";

// ENV Configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9090;

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN === "*" ? true : (process.env.CORS_ORIGIN || "*"),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
dbConnection().catch((err) => {
  console.error("Initial DB connection failed:", err.message);
});

// Health Checks
app.get("/health-check", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Weaver Ledger Service running fine",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "UP",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/weavers", weaverRouter);
app.use("/api/products", productRouter);
app.use("/api/looms", loomRouter);
app.use("/api/babins", babinRouter);
app.use("/api/rates", rateRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/production-entries", productionRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportRouter);
app.use("/api/buyers", buyerRouter);

// 404 Route Catch
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server if not imported by serverless function
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 Weaver Ledger Service listening on port ${PORT}`);
  });
}

export default app;