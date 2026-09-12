import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { dbConnection } from "./db.js";
import { User } from "./models/UserSchema.js";
import { Product } from "./models/ProductSchema.js";
import { Weaver } from "./models/WeaverSchema.js";
import { Loom } from "./models/LoomSchema.js";
import { Babin } from "./models/BabinSchema.js";
import { MaterialRate } from "./models/MaterialRateSchema.js";
import { Transaction } from "./models/TransactionSchema.js";
import { Buyer } from "./models/BuyerSchema.js";
import { ProductBuyerPrice } from "./models/ProductBuyerPriceSchema.js";
import { Counter } from "./models/CounterSchema.js";

dotenv.config();

async function importData() {
  console.log("🚀 Starting Supabase Data Migration to MongoDB...");
  const conn = await dbConnection();
  console.log(`Connected to Database: [${conn.name}] on host: [${conn.host}]`);

  const filePath = path.resolve("./supabase_data_export (1).json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Export file not found at ${filePath}`);
  }

  const rawData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // 1. Seed Demo Admin User
  const demoEmail = process.env.DEMO_EMAIL || "demo@weaverstock.app";
  const demoPassword = process.env.DEMO_PASSWORD || "demo-weaver-2026";
  const existingUser = await User.findOne({ email: demoEmail });
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(demoPassword, 10);
    await User.create({
      name: "Master Admin",
      email: demoEmail,
      password: hashedPassword,
      role: "admin",
      isActive: true
    });
    console.log(`✅ Admin user seeded: ${demoEmail}`);
  }

  // 2. Import Products
  console.log(`\n📦 Importing ${rawData.product_master?.length || 0} Products...`);
  const productMap = {}; // productId -> Product Doc
  let maxProductId = 0;

  for (const p of rawData.product_master || []) {
    const pId = Number(p.product_id);
    if (pId > maxProductId) maxProductId = pId;

    const prodDoc = await Product.findOneAndUpdate(
      { productId: pId },
      {
        $set: {
          productId: pId,
          productNumber: p.product_number ? String(p.product_number).trim() : `P-${String(pId).padStart(4, "0")}`,
          productName: (p.product_name || `Product #${pId}`).trim(),
          lengthMeters: Number(p.length_meters) || 0,
          weavingRate: Number(p.weaving_rate) || 0,
          defaultJariPerUnit: Number(p.default_jari_per_unit) || 0,
          defaultYarnPerUnit: Number(p.default_yarn_per_unit) || 0,
          defaultColorYarnPerUnit: Number(p.default_color_yarn_per_unit) || 0,
          defaultBabinPerUnit: Number(p.default_babin_per_unit) || 0,
          defaultJariBabinPerUnit: Number(p.default_jari_babin_per_unit) || 0,
          defaultColorBabinPerUnit: Number(p.default_color_babin_per_unit) || 0,
          defaultPavuPerUnit: Number(p.default_pavu_per_unit) || 0,
          defaultJariPavuPerUnit: Number(p.default_jari_pavu_per_unit) || 0,
          skuCode: p.sku_code || null,
          description: p.description || null,
          imageUrl: p.image_url || null,
          createdAt: p.created_at ? new Date(p.created_at) : new Date()
        }
      },
      { upsert: true, new: true }
    );
    productMap[pId] = prodDoc;
  }
  console.log(`✅ Products imported. (Max productId: ${maxProductId})`);

  // 3. Import Weavers & Assign Products
  console.log(`\n👨‍🎨 Importing ${rawData.weaver_master?.length || 0} Weavers...`);
  const weaverMap = {}; // weaverId -> Weaver Doc
  let maxWeaverId = 0;

  // Build weaver product mapping lookup
  const weaverProductMap = {};
  for (const map of rawData.weaver_product_map || []) {
    const wId = Number(map.weaver_id);
    const pId = Number(map.product_id);
    if (!weaverProductMap[wId]) weaverProductMap[wId] = [];
    if (productMap[pId]) {
      weaverProductMap[wId].push(productMap[pId]._id);
    }
  }

  for (const w of rawData.weaver_master || []) {
    const wId = Number(w.weaver_id);
    if (wId > maxWeaverId) maxWeaverId = wId;

    const assignedProds = weaverProductMap[wId] || [];

    const weaverDoc = await Weaver.findOneAndUpdate(
      { weaverId: wId },
      {
        $set: {
          weaverId: wId,
          weaverCode: (w.weaver_code || `WVR-${String(wId).padStart(4, "0")}`).toUpperCase().trim(),
          weaverName: (w.weaver_name || `Weaver #${wId}`).trim(),
          mobileNumber: (w.mobile_number || "").trim(),
          bankAccountNo: (w.bank_account_no || "").trim(),
          bankIfsc: (w.bank_ifsc || "").toUpperCase().trim(),
          bankName: w.bank_name || null,
          numberOfLooms: Number(w.number_of_looms) || 1,
          status: w.status || "active",
          assignedProducts: assignedProds,
          createdAt: w.created_at ? new Date(w.created_at) : new Date(),
          updatedAt: w.updated_at ? new Date(w.updated_at) : new Date()
        }
      },
      { upsert: true, new: true }
    );
    weaverMap[wId] = weaverDoc;
  }
  console.log(`✅ Weavers imported. (Max weaverId: ${maxWeaverId})`);

  // 4. Import Material Rates
  console.log(`\n💰 Importing ${rawData.material_rate_master?.length || 0} Material Rates...`);
  let maxRateId = 0;
  for (const r of rawData.material_rate_master || []) {
    const rId = Number(r.rate_id);
    if (rId > maxRateId) maxRateId = rId;

    await MaterialRate.findOneAndUpdate(
      { rateId: rId },
      {
        $set: {
          rateId: rId,
          materialType: r.material_type,
          ratePerUnit: Number(r.rate_per_unit) || 0,
          effectiveFrom: r.effective_from,
          effectiveTo: r.effective_to || null,
          createdAt: r.created_at ? new Date(r.created_at) : new Date()
        }
      },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Material Rates imported. (Max rateId: ${maxRateId})`);

  // 5. Import Looms (Pavu Register)
  console.log(`\n🧵 Importing ${rawData.loom_master?.length || 0} Looms (Pavu Warp)...`);
  let maxLoomId = 0;
  for (const l of rawData.loom_master || []) {
    const lId = Number(l.loom_id);
    if (lId > maxLoomId) maxLoomId = lId;

    const wId = Number(l.weaver_id);
    const weaverDoc = weaverMap[wId];

    await Loom.findOneAndUpdate(
      { loomId: lId },
      {
        $set: {
          loomId: lId,
          loomNumber: (l.loom_number || `PV-${lId}`).trim(),
          weaver: weaverDoc ? weaverDoc._id : null,
          weaverId: wId,
          loomNo: Number(l.loom_no) || 1,
          pavuType: l.pavu_type || "normal",
          pavuElai: l.pavu_elai || null,
          lengthMeters: Number(l.length_meters) || 0,
          distributorName: (l.distributor_name || "Direct").trim(),
          receivedDate: l.received_date || new Date().toISOString().split("T")[0],
          notes: l.notes || null,
          createdAt: l.created_at ? new Date(l.created_at) : new Date(),
          updatedAt: l.updated_at ? new Date(l.updated_at) : new Date()
        }
      },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Looms imported. (Max loomId: ${maxLoomId})`);

  // 6. Import Babins (Weft Register)
  console.log(`\n🧶 Importing ${rawData.babin_master?.length || 0} Babins (Weft Bobbins)...`);
  let maxBabinId = 0;
  for (const b of rawData.babin_master || []) {
    const bId = Number(b.babin_id);
    if (bId > maxBabinId) maxBabinId = bId;

    const wId = Number(b.weaver_id);
    const weaverDoc = weaverMap[wId];

    await Babin.findOneAndUpdate(
      { babinId: bId },
      {
        $set: {
          babinId: bId,
          babinNumber: (b.babin_number || `BBN-${bId}`).trim(),
          weaver: weaverDoc ? weaverDoc._id : null,
          weaverId: wId,
          loomNo: Number(b.loom_no) || 1,
          babinType: b.babin_type || "normal",
          colorName: b.color_name || null,
          lengthMeters: Number(b.length_meters) || 0,
          distributorName: (b.distributor_name || "Direct").trim(),
          purchaseDate: b.purchase_date || new Date().toISOString().split("T")[0],
          notes: b.notes || null,
          createdAt: b.created_at ? new Date(b.created_at) : new Date(),
          updatedAt: b.updated_at ? new Date(b.updated_at) : new Date()
        }
      },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Babins imported. (Max babinId: ${maxBabinId})`);

  // 7. Import Transactions
  console.log(`\n📑 Importing ${rawData.weaver_material_transactions?.length || 0} Ledger Transactions...`);
  let maxTxnId = 0;
  for (const t of rawData.weaver_material_transactions || []) {
    const tId = Number(t.transaction_id);
    if (tId > maxTxnId) maxTxnId = tId;

    const wId = Number(t.weaver_id);
    const pId = t.product_id ? Number(t.product_id) : null;

    const weaverDoc = weaverMap[wId];
    const prodDoc = pId ? productMap[pId] : null;

    await Transaction.findOneAndUpdate(
      { transactionId: tId },
      {
        $set: {
          transactionId: tId,
          dispatchGroupId: t.dispatch_group_id || null,
          weaver: weaverDoc ? weaverDoc._id : null,
          weaverId: wId,
          transactionType: t.transaction_type,
          materialType: t.material_type,
          quantity: Number(t.quantity) || 0,
          product: prodDoc ? prodDoc._id : null,
          productId: pId,
          quantityProduced: t.quantity_produced !== undefined ? Number(t.quantity_produced) : null,
          loomNo: t.loom_no !== undefined ? Number(t.loom_no) : null,
          loomId: t.loom_id !== undefined ? Number(t.loom_id) : null,
          rateApplied: t.rate_applied !== undefined ? Number(t.rate_applied) : null,
          amount: t.amount !== undefined ? Number(t.amount) : null,
          isPaid: Boolean(t.is_paid),
          entryDate: t.entry_date || new Date().toISOString().split("T")[0],
          notes: t.notes || null,
          createdAt: t.created_at ? new Date(t.created_at) : new Date()
        }
      },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Transactions imported. (Max transactionId: ${maxTxnId})`);

  // 8. Synchronize Auto-Increment Counters
  console.log("\n🔢 Synchronizing Sequential Counters...");
  await Counter.findByIdAndUpdate("weaverId", { $set: { seq: maxWeaverId } }, { upsert: true });
  await Counter.findByIdAndUpdate("productId", { $set: { seq: maxProductId } }, { upsert: true });
  await Counter.findByIdAndUpdate("rateId", { $set: { seq: maxRateId } }, { upsert: true });
  await Counter.findByIdAndUpdate("loomId", { $set: { seq: maxLoomId } }, { upsert: true });
  await Counter.findByIdAndUpdate("babinId", { $set: { seq: maxBabinId } }, { upsert: true });
  await Counter.findByIdAndUpdate("transactionId", { $set: { seq: maxTxnId } }, { upsert: true });
  await Counter.findByIdAndUpdate("buyerId", { $set: { seq: 0 } }, { upsert: true });
  await Counter.findByIdAndUpdate("priceId", { $set: { seq: 0 } }, { upsert: true });

  console.log("\n==================================================================");
  console.log("🎉 ALL SUPABASE DATA MIGRATED TO MONGODB SUCCESSFULLY!");
  console.log(`📊 Products: ${Object.keys(productMap).length}`);
  console.log(`📊 Weavers: ${Object.keys(weaverMap).length}`);
  console.log(`📊 Rates: ${rawData.material_rate_master?.length || 0}`);
  console.log(`📊 Looms (Pavu): ${rawData.loom_master?.length || 0}`);
  console.log(`📊 Babins: ${rawData.babin_master?.length || 0}`);
  console.log(`📊 Transactions: ${rawData.weaver_material_transactions?.length || 0}`);
  console.log("==================================================================\n");

  process.exit(0);
}

importData().catch((err) => {
  console.error("❌ Migration Failed:", err);
  process.exit(1);
});
