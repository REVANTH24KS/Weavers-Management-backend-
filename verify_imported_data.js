import dotenv from "dotenv";
import { dbConnection } from "./db.js";
import { Weaver } from "./models/WeaverSchema.js";
import { Product } from "./models/ProductSchema.js";
import { Loom } from "./models/LoomSchema.js";
import { Babin } from "./models/BabinSchema.js";
import { Transaction } from "./models/TransactionSchema.js";
import { getStockOverviewReport } from "./services/calculationService.js";

dotenv.config();

async function verify() {
  await dbConnection();

  const [weaverCount, productCount, loomCount, babinCount, txnCount] = await Promise.all([
    Weaver.countDocuments(),
    Product.countDocuments(),
    Loom.countDocuments(),
    Babin.countDocuments(),
    Transaction.countDocuments()
  ]);

  console.log("\n================ DATABASE SUMMARY ================");
  console.log(`Weavers:      ${weaverCount}`);
  console.log(`Products:     ${productCount}`);
  console.log(`Looms (Pavu): ${loomCount}`);
  console.log(`Babins:       ${babinCount}`);
  console.log(`Transactions: ${txnCount}`);

  const weavers = await Weaver.find().populate("assignedProducts").lean();
  console.log("\n================ WEAVERS & ASSIGNED PRODUCTS ================");
  for (const w of weavers) {
    const prodNames = (w.assignedProducts || []).map((p) => p.productName).join(", ");
    console.log(`[${w.weaverCode}] ${w.weaverName} (Looms: ${w.numberOfLooms}) -> [${prodNames}]`);
  }

  const stockReport = await getStockOverviewReport();
  console.log("\n================ STOCK OVERVIEW REPORT ================");
  console.table(stockReport.stockByWeaver);

  console.log("\n================ SAMPLE CONSUMPTION BY PRODUCT ================");
  console.table(stockReport.consumptionByProduct.slice(0, 5));

  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
