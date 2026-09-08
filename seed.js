import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { dbConnection } from "./db.js";
import { User } from "./models/UserSchema.js";
import { Product } from "./models/ProductSchema.js";
import { MaterialRate } from "./models/MaterialRateSchema.js";
import { Weaver } from "./models/WeaverSchema.js";
import { Loom } from "./models/LoomSchema.js";
import { Babin } from "./models/BabinSchema.js";
import { Counter } from "./models/CounterSchema.js";

dotenv.config();

async function seed() {
  console.log("🌱 Starting Database Seed...");
  await dbConnection();

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
    console.log(`✅ Demo admin user created (${demoEmail})`);
  } else {
    console.log(`ℹ️ Demo user (${demoEmail}) already exists`);
  }

  // 2. Seed Initial Products
  const productsData = [
    {
      productId: 1,
      productNumber: "P-0001",
      productName: "Kanchipuram Silk Saree",
      lengthMeters: 6.25,
      weavingRate: 850,
      defaultJariPerUnit: 250,
      defaultYarnPerUnit: 800,
      defaultBabinPerUnit: 35.5,
      defaultJariBabinPerUnit: 12.0,
      defaultColorYarnPerUnit: 0,
      defaultColorBabinPerUnit: 0,
      defaultPavuPerUnit: 6.25,
      defaultJariPavuPerUnit: 0
    },
    {
      productId: 2,
      productNumber: "P-0002",
      productName: "Cotton Handloom Dhoti",
      lengthMeters: 4.00,
      weavingRate: 450,
      defaultJariPerUnit: 50,
      defaultYarnPerUnit: 600,
      defaultBabinPerUnit: 20.0,
      defaultJariBabinPerUnit: 0,
      defaultColorYarnPerUnit: 0,
      defaultColorBabinPerUnit: 0,
      defaultPavuPerUnit: 4.00,
      defaultJariPavuPerUnit: 0
    }
  ];

  for (const p of productsData) {
    const exists = await Product.findOne({ productNumber: p.productNumber });
    if (!exists) {
      await Product.create(p);
      console.log(`✅ Product created: ${p.productNumber} (${p.productName})`);
    }
  }

  // 3. Seed Initial Material Rates
  const ratesData = [
    { rateId: 1, materialType: "jari", ratePerUnit: 4650, effectiveFrom: "2026-08-01", effectiveTo: null },
    { rateId: 2, materialType: "yarn", ratePerUnit: 415, effectiveFrom: "2026-08-01", effectiveTo: null }
  ];

  for (const r of ratesData) {
    const exists = await MaterialRate.findOne({ materialType: r.materialType, ratePerUnit: r.ratePerUnit });
    if (!exists) {
      await MaterialRate.create(r);
      console.log(`✅ Rate created: ${r.materialType} @ ₹${r.ratePerUnit}`);
    }
  }

  // 4. Seed Initial Weaver if none exists
  const weaverCount = await Weaver.countDocuments();
  if (weaverCount === 0) {
    const prod1 = await Product.findOne({ productId: 1 });
    const prod2 = await Product.findOne({ productId: 2 });
    const assigned = [prod1?._id, prod2?._id].filter(Boolean);

    const weaver = await Weaver.create({
      weaverId: 1,
      weaverCode: "WVR-0001",
      weaverName: "Murugan Subramani",
      mobileNumber: "9842015673",
      bankAccountNo: "30124578901",
      bankIfsc: "SBIN0001234",
      bankName: "State Bank of India",
      numberOfLooms: 3,
      status: "active",
      assignedProducts: assigned
    });
    console.log(`✅ Sample weaver created: ${weaver.weaverCode} (${weaver.weaverName})`);

    // Seed sample pavu
    await Loom.create({
      loomId: 1,
      loomNumber: "PV-001",
      weaver: weaver._id,
      weaverId: 1,
      loomNo: 1,
      pavuType: "normal",
      pavuElai: "3600",
      lengthMeters: 120,
      distributorName: "Sri Lakshmi Warping",
      receivedDate: "2026-08-01",
      notes: "Good quality warp"
    });

    // Seed sample babin
    await Babin.create({
      babinId: 1,
      babinNumber: "BBN-001",
      weaver: weaver._id,
      weaverId: 1,
      loomNo: 1,
      babinType: "jari",
      lengthMeters: 300,
      distributorName: "Meenakshi Yarn",
      purchaseDate: "2026-08-05",
      notes: "Initial spool"
    });
    console.log("✅ Sample Loom & Babin records created");
  }

  // Sync counters
  await Counter.findByIdAndUpdate("weaverId", { $max: { seq: 1 } }, { upsert: true });
  await Counter.findByIdAndUpdate("productId", { $max: { seq: 2 } }, { upsert: true });
  await Counter.findByIdAndUpdate("rateId", { $max: { seq: 2 } }, { upsert: true });
  await Counter.findByIdAndUpdate("loomId", { $max: { seq: 1 } }, { upsert: true });
  await Counter.findByIdAndUpdate("babinId", { $max: { seq: 1 } }, { upsert: true });

  console.log("🎉 Database Seed Completed Successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
