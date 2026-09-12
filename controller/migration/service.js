import fs from "fs";
import path from "path";
import { Product } from "../../models/ProductSchema.js";
import { Weaver } from "../../models/WeaverSchema.js";
import { Loom } from "../../models/LoomSchema.js";
import { Babin } from "../../models/BabinSchema.js";
import { MaterialRate } from "../../models/MaterialRateSchema.js";
import { Transaction } from "../../models/TransactionSchema.js";
import { Counter } from "../../models/CounterSchema.js";

export async function importSupabaseData(req, res, next) {
  try {
    let payload = req.body;

    // If body is empty or doesn't have expected arrays, attempt to read from workspace JSON export file
    const hasData = payload && (
      Array.isArray(payload.product_master) ||
      Array.isArray(payload.weaver_master) ||
      Array.isArray(payload.babin_master) ||
      Array.isArray(payload.loom_master) ||
      Array.isArray(payload.weaver_material_transactions)
    );

    if (!hasData) {
      const candidates = [
        path.resolve("./supabase_data_export (1).json"),
        path.resolve("./supabase_data_export.json"),
        path.resolve("../supabase_data_export (1).json"),
        path.resolve("../supabase_data_export.json")
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          payload = JSON.parse(fs.readFileSync(p, "utf-8"));
          break;
        }
      }
    }

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "No data payload provided in request body and no local export file found."
        }
      });
    }

    const {
      product_master = [],
      weaver_master = [],
      weaver_product_map = [],
      material_rate_master = [],
      loom_master = [],
      babin_master = [],
      weaver_material_transactions = []
    } = payload;

    // Optional clear flag if user specifies ?clear=true or { clear: true }
    const shouldClear = req.query.clear === "true" || payload.clear === true;
    if (shouldClear) {
      await Promise.all([
        Product.deleteMany({}),
        Weaver.deleteMany({}),
        Loom.deleteMany({}),
        Babin.deleteMany({}),
        MaterialRate.deleteMany({}),
        Transaction.deleteMany({})
      ]);
    }

    // ==========================================
    // STEP 1: Process & Upsert Products
    // ==========================================
    const productMap = {}; // productId -> Document
    let maxProductId = 0;

    for (const p of product_master) {
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

    // ==========================================
    // STEP 2: Process & Upsert Weavers + Product Map
    // ==========================================
    const weaverProductMapLookup = {};
    for (const map of weaver_product_map) {
      const wId = Number(map.weaver_id);
      const pId = Number(map.product_id);
      if (!weaverProductMapLookup[wId]) weaverProductMapLookup[wId] = [];
      if (productMap[pId]) {
        weaverProductMapLookup[wId].push(productMap[pId]._id);
      }
    }

    const weaverMap = {}; // weaverId -> Document
    let maxWeaverId = 0;

    for (const w of weaver_master) {
      const wId = Number(w.weaver_id);
      if (wId > maxWeaverId) maxWeaverId = wId;

      const assignedProds = weaverProductMapLookup[wId] || [];

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

    // ==========================================
    // STEP 3: Process & Upsert Material Rates
    // ==========================================
    let maxRateId = 0;
    for (const r of material_rate_master) {
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

    // ==========================================
    // STEP 4: Process & Upsert Looms (Pavu Register)
    // ==========================================
    let maxLoomId = 0;
    for (const l of loom_master) {
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

    // ==========================================
    // STEP 5: Process & Upsert Babins (Weft Register)
    // ==========================================
    let maxBabinId = 0;
    for (const b of babin_master) {
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

    // ==========================================
    // STEP 6: Process & Upsert Transactions
    // ==========================================
    let maxTxnId = 0;
    for (const t of weaver_material_transactions) {
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

    // ==========================================
    // STEP 7: Synchronize Sequential Counters
    // ==========================================
    await Promise.all([
      Counter.findByIdAndUpdate("weaverId", { $max: { seq: maxWeaverId } }, { upsert: true }),
      Counter.findByIdAndUpdate("productId", { $max: { seq: maxProductId } }, { upsert: true }),
      Counter.findByIdAndUpdate("rateId", { $max: { seq: maxRateId } }, { upsert: true }),
      Counter.findByIdAndUpdate("loomId", { $max: { seq: maxLoomId } }, { upsert: true }),
      Counter.findByIdAndUpdate("babinId", { $max: { seq: maxBabinId } }, { upsert: true }),
      Counter.findByIdAndUpdate("transactionId", { $max: { seq: maxTxnId } }, { upsert: true }),
      Counter.findByIdAndUpdate("buyerId", { $max: { seq: 0 } }, { upsert: true }),
      Counter.findByIdAndUpdate("priceId", { $max: { seq: 0 } }, { upsert: true })
    ]);

    return res.status(200).json({
      success: true,
      message: "Supabase data successfully imported to MongoDB in proper order",
      data: {
        productsImported: product_master.length,
        weaversImported: weaver_master.length,
        weaverProductMappings: weaver_product_map.length,
        ratesImported: material_rate_master.length,
        loomsImported: loom_master.length,
        babinsImported: babin_master.length,
        transactionsImported: weaver_material_transactions.length,
        countersSynced: {
          weaverId: maxWeaverId,
          productId: maxProductId,
          rateId: maxRateId,
          loomId: maxLoomId,
          babinId: maxBabinId,
          transactionId: maxTxnId
        }
      }
    });
  } catch (error) {
    next(error);
  }
}
