import { Transaction } from "../models/TransactionSchema.js";
import { Loom } from "../models/LoomSchema.js";
import { Babin } from "../models/BabinSchema.js";
import { Weaver } from "../models/WeaverSchema.js";
import { Product } from "../models/ProductSchema.js";

/**
 * Calculates current material balances for a weaver:
 * jari (g), yarn (g), color_yarn (g), babin (m)
 */
export async function getWeaverMaterialBalances(weaverId) {
  const transactions = await Transaction.find({ weaverId }).lean();

  const totals = {
    jari: { issued: 0, consumed: 0, returned: 0 },
    yarn: { issued: 0, consumed: 0, returned: 0 },
    color_yarn: { issued: 0, consumed: 0, returned: 0 },
    babin: { issued: 0, consumed: 0, returned: 0 }
  };

  for (const t of transactions) {
    const mat = t.materialType;
    if (!totals[mat]) continue;

    const qty = Number(t.quantity) || 0;
    if (t.transactionType === "material_issue") {
      totals[mat].issued += qty;
    } else if (t.transactionType === "production_consumption") {
      totals[mat].consumed += qty;
    } else if (t.transactionType === "material_return") {
      totals[mat].returned += qty;
    }
  }

  // Also include babin total purchase length as "issued" if babin purchases are recorded in Babin model
  const babinRecords = await Babin.find({ weaverId }).lean();
  let totalBabinPurchased = 0;
  for (const b of babinRecords) {
    totalBabinPurchased += Number(b.lengthMeters) || 0;
  }
  // Babin issued is either from transaction or Babin master
  const babinTotalIssued = Math.max(totals.babin.issued, totalBabinPurchased);

  return {
    jari: Number((totals.jari.issued - totals.jari.consumed - totals.jari.returned).toFixed(2)),
    yarn: Number((totals.yarn.issued - totals.yarn.consumed - totals.yarn.returned).toFixed(2)),
    color_yarn: Number((totals.color_yarn.issued - totals.color_yarn.consumed - totals.color_yarn.returned).toFixed(2)),
    babin: Number((babinTotalIssued - totals.babin.consumed - totals.babin.returned).toFixed(2)),
    babinPurchased: babinTotalIssued,
    babinConsumed: totals.babin.consumed
  };
}

/**
 * Calculates total unpaid wage amount for a weaver
 */
export async function getWeaverUnpaidAmount(weaverId) {
  const unpaidTxns = await Transaction.find({
    weaverId,
    transactionType: "production_consumption",
    isPaid: false
  }).lean();

  const total = unpaidTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return Number(total.toFixed(2));
}

/**
 * Calculates days since last production visit and whether weaver is aging
 */
export async function getWeaverAgingStatus(weaverId, referenceDateStr = null) {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();

  const lastTxn = await Transaction.findOne({
    weaverId,
    transactionType: "production_consumption"
  })
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  if (!lastTxn || !lastTxn.entryDate) {
    return {
      daysSinceLastProduction: 0,
      isAging: false,
      lastVisitDate: null
    };
  }

  const lastDate = new Date(lastTxn.entryDate);
  const diffTime = Math.abs(refDate.getTime() - lastDate.getTime());
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return {
    daysSinceLastProduction: days,
    isAging: days >= 15,
    lastVisitDate: lastTxn.entryDate
  };
}

/**
 * Calculates Pavu usage (FIFO) for looms
 */
export async function calculatePavuUsage(filter = {}) {
  const query = {};
  if (filter.weaverId) query.weaverId = Number(filter.weaverId);
  if (filter.pavuType) query.pavuType = filter.pavuType;

  const looms = await Loom.find(query)
    .populate("weaver", "weaverName weaverCode")
    .sort({ receivedDate: 1, createdAt: 1 })
    .lean();

  // Find all production transactions
  const txQuery = { transactionType: "production_consumption" };
  if (filter.weaverId) txQuery.weaverId = Number(filter.weaverId);

  const prodTransactions = await Transaction.find(txQuery)
    .populate("product")
    .lean();

  // Group looms by weaverId + loomNo + pavuType
  const loomGroups = {};
  for (const l of looms) {
    const key = `${l.weaverId}_${l.loomNo}_${l.pavuType}`;
    if (!loomGroups[key]) loomGroups[key] = [];
    loomGroups[key].push(l);
  }

  // Calculate consumption per group
  const consumptionMap = {};
  for (const t of prodTransactions) {
    if (!t.loomNo || !t.quantityProduced) continue;
    const pieces = Number(t.quantityProduced) || 0;
    const prod = t.product;
    if (!prod) continue;

    // Normal pavu usage
    const normalWarpPerPiece = Number(prod.defaultPavuPerUnit) || Number(prod.lengthMeters) || 0;
    const normalKey = `${t.weaverId}_${t.loomNo}_normal`;
    consumptionMap[normalKey] = (consumptionMap[normalKey] || 0) + pieces * normalWarpPerPiece;

    // Jari pavu usage
    const jariWarpPerPiece = Number(prod.defaultJariPavuPerUnit) || 0;
    if (jariWarpPerPiece > 0) {
      const jariKey = `${t.weaverId}_${t.loomNo}_jari`;
      consumptionMap[jariKey] = (consumptionMap[jariKey] || 0) + pieces * jariWarpPerPiece;
    }
  }

  const results = [];

  for (const [key, pavuList] of Object.entries(loomGroups)) {
    let totalConsumed = consumptionMap[key] || 0;
    let accumulatedConsumed = 0;

    for (let i = 0; i < pavuList.length; i++) {
      const pavu = pavuList[i];
      const length = Number(pavu.lengthMeters) || 0;
      const isLast = i === pavuList.length - 1;

      let used = 0;
      let remaining = length;
      let isCompleted = false;
      let isOver = false;

      const neededSoFar = totalConsumed - accumulatedConsumed;

      if (neededSoFar <= 0) {
        used = 0;
        remaining = length;
        isCompleted = false;
        isOver = false;
      } else if (neededSoFar < length) {
        used = Number(neededSoFar.toFixed(2));
        remaining = Number((length - used).toFixed(2));
        isCompleted = false;
        isOver = false;
        accumulatedConsumed += used;
      } else {
        // neededSoFar >= length
        if (isLast && neededSoFar > length) {
          used = Number(neededSoFar.toFixed(2));
          remaining = Number((length - used).toFixed(2)); // will be negative
          isCompleted = true;
          isOver = true;
          accumulatedConsumed += used;
        } else {
          used = length;
          remaining = 0;
          isCompleted = true;
          isOver = false;
          accumulatedConsumed += length;
        }
      }

      results.push({
        _id: pavu._id,
        loom_id: pavu.loomId,
        loom_number: pavu.loomNumber,
        weaver_id: pavu.weaverId,
        weaver_name: pavu.weaver?.weaverName || `Weaver #${pavu.weaverId}`,
        weaver_code: pavu.weaver?.weaverCode || "",
        loom_no: pavu.loomNo,
        pavu_type: pavu.pavuType,
        pavu_elai: pavu.pavuElai,
        length_meters: length,
        distributor_name: pavu.distributorName,
        received_date: pavu.receivedDate,
        notes: pavu.notes,
        used_meters: Number(used.toFixed(2)),
        remaining_meters: Number(remaining.toFixed(2)),
        is_completed: isCompleted,
        is_over: isOver
      });
    }
  }

  return results;
}

/**
 * Calculates Babin usage (FIFO)
 */
export async function calculateBabinUsage(filter = {}) {
  const query = {};
  if (filter.weaverId) query.weaverId = Number(filter.weaverId);
  if (filter.babinType) query.babinType = filter.babinType;

  const babins = await Babin.find(query)
    .populate("weaver", "weaverName weaverCode")
    .sort({ purchaseDate: 1, createdAt: 1 })
    .lean();

  const txQuery = { transactionType: "production_consumption", materialType: "babin" };
  if (filter.weaverId) txQuery.weaverId = Number(filter.weaverId);

  const babinTxns = await Transaction.find(txQuery).lean();

  const consumptionMap = {};
  for (const t of babinTxns) {
    const key = `${t.weaverId}_${t.loomNo || 1}`;
    consumptionMap[key] = (consumptionMap[key] || 0) + (Number(t.quantity) || 0);
  }

  const babinGroups = {};
  for (const b of babins) {
    const key = `${b.weaverId}_${b.loomNo || 1}`;
    if (!babinGroups[key]) babinGroups[key] = [];
    babinGroups[key].push(b);
  }

  const results = [];

  for (const [key, babinList] of Object.entries(babinGroups)) {
    let totalConsumed = consumptionMap[key] || 0;
    let accumulatedConsumed = 0;

    for (let i = 0; i < babinList.length; i++) {
      const babin = babinList[i];
      const length = Number(babin.lengthMeters) || 0;
      const isLast = i === babinList.length - 1;

      let used = 0;
      let remaining = length;
      let isCompleted = false;
      let isOver = false;

      const neededSoFar = totalConsumed - accumulatedConsumed;

      if (neededSoFar <= 0) {
        used = 0;
        remaining = length;
      } else if (neededSoFar < length) {
        used = Number(neededSoFar.toFixed(2));
        remaining = Number((length - used).toFixed(2));
        accumulatedConsumed += used;
      } else {
        if (isLast && neededSoFar > length) {
          used = Number(neededSoFar.toFixed(2));
          remaining = Number((length - used).toFixed(2));
          isCompleted = true;
          isOver = true;
          accumulatedConsumed += used;
        } else {
          used = length;
          remaining = 0;
          isCompleted = true;
          accumulatedConsumed += length;
        }
      }

      results.push({
        _id: babin._id,
        babin_id: babin.babinId,
        babin_number: babin.babinNumber,
        weaver_id: babin.weaverId,
        weaver_name: babin.weaver?.weaverName || `Weaver #${babin.weaverId}`,
        loom_no: babin.loomNo,
        babin_type: babin.babinType,
        color_name: babin.colorName,
        length_meters: length,
        distributor_name: babin.distributorName,
        purchase_date: babin.purchaseDate,
        notes: babin.notes,
        used_meters: Number(used.toFixed(2)),
        remaining_meters: Number(remaining.toFixed(2)),
        is_completed: isCompleted,
        is_over: isOver
      });
    }
  }

  return results;
}

/**
 * Generates structured report data for Stock Overview
 */
export async function getStockOverviewReport() {
  const weavers = await Weaver.find().sort({ weaverId: 1 }).lean();

  const stockByWeaver = [];
  for (const w of weavers) {
    const balances = await getWeaverMaterialBalances(w.weaverId);
    stockByWeaver.push({
      weaver_id: w.weaverId,
      weaver_code: w.weaverCode,
      weaver_name: w.weaverName,
      jari_balance_g: balances.jari,
      yarn_balance_g: balances.yarn,
      color_yarn_balance_g: balances.color_yarn,
      babin_purchased_m: balances.babinPurchased || 0,
      babin_consumed_m: balances.babinConsumed || 0,
      babin_balance_m: balances.babin
    });
  }

  // Consumption by product
  const prodTxns = await Transaction.find({ transactionType: "production_consumption" })
    .populate("product")
    .lean();

  const prodMap = {};
  for (const t of prodTxns) {
    const prodName = t.product?.productName || `Product #${t.productId || "Unknown"}`;
    if (!prodMap[prodName]) {
      prodMap[prodName] = {
        product_name: prodName,
        Jari: 0,
        Yarn: 0,
        "Colour yarn": 0,
        Babin: 0
      };
    }
    const qty = Number(t.quantity) || 0;
    if (t.materialType === "jari") prodMap[prodName].Jari += qty;
    else if (t.materialType === "yarn") prodMap[prodName].Yarn += qty;
    else if (t.materialType === "color_yarn") prodMap[prodName]["Colour yarn"] += qty;
    else if (t.materialType === "babin") prodMap[prodName].Babin += qty;
  }

  const consumptionByProduct = Object.values(prodMap);

  // Flagged transactions with > 15% variance from default BOM
  const flaggedTransactions = [];
  for (const t of prodTxns) {
    if (!t.product || !t.quantityProduced) continue;
    const pieces = Number(t.quantityProduced) || 0;
    let defaultRate = 0;
    if (t.materialType === "jari") defaultRate = t.product.defaultJariPerUnit || 0;
    else if (t.materialType === "yarn") defaultRate = t.product.defaultYarnPerUnit || 0;
    else if (t.materialType === "color_yarn") defaultRate = t.product.defaultColorYarnPerUnit || 0;
    else if (t.materialType === "babin") defaultRate = t.product.defaultBabinPerUnit || 0;

    const expected = pieces * defaultRate;
    const actual = Number(t.quantity) || 0;

    if (expected > 0 && Math.abs(actual - expected) / expected > 0.15) {
      const diffPercent = (((actual - expected) / expected) * 100).toFixed(1);
      const sign = Number(diffPercent) > 0 ? "+" : "";
      
      const weaver = await Weaver.findOne({ weaverId: t.weaverId }).lean();

      flaggedTransactions.push({
        transaction_id: t.transactionId,
        weaver_name: weaver?.weaverName || `Weaver #${t.weaverId}`,
        product_name: t.product.productName,
        material_type: t.materialType,
        actual_quantity: actual,
        expected_quantity: expected,
        variance_percent: `${sign}${diffPercent}%`,
        entry_date: t.entryDate
      });
    }
  }

  return {
    stockByWeaver,
    consumptionByProduct,
    flaggedTransactions
  };
}

/**
 * Returns structured Bill data for PDF generation
 */
export async function getBillData({ weaverId, date, dispatchGroupId }) {
  const weaver = await Weaver.findOne({ weaverId: Number(weaverId) }).lean();
  if (!weaver) {
    throw new Error("Weaver not found");
  }

  const query = { weaverId: Number(weaverId) };
  if (dispatchGroupId) {
    query.dispatchGroupId = dispatchGroupId;
  } else if (date) {
    query.entryDate = date;
  }

  const transactions = await Transaction.find(query).populate("product").lean();

  const issues = [];
  const returns = [];
  const dispatches = [];
  let totalAmount = 0;

  for (const t of transactions) {
    if (t.transactionType === "material_issue") {
      issues.push({
        transactionId: t.transactionId,
        materialType: t.materialType,
        quantityGrams: t.quantity,
        quantityKg: Number((t.quantity / 1000).toFixed(3)),
        entryDate: t.entryDate,
        notes: t.notes
      });
    } else if (t.transactionType === "material_return") {
      returns.push({
        transactionId: t.transactionId,
        materialType: t.materialType,
        quantityGrams: t.quantity,
        quantityKg: Number((t.quantity / 1000).toFixed(3)),
        entryDate: t.entryDate,
        notes: t.notes
      });
    } else if (t.transactionType === "production_consumption") {
      if (t.amount && t.amount > 0) {
        totalAmount += Number(t.amount);
      }
      dispatches.push({
        transactionId: t.transactionId,
        loomNo: t.loomNo,
        productName: t.product?.productName || "Product",
        pieces: t.quantityProduced,
        materialType: t.materialType,
        quantity: t.quantity,
        rateApplied: t.rateApplied,
        amount: t.amount || 0,
        isPaid: t.isPaid,
        entryDate: t.entryDate
      });
    }
  }

  const balances = await getWeaverMaterialBalances(weaver.weaverId);

  return {
    weaver: {
      weaverId: weaver.weaverId,
      weaverCode: weaver.weaverCode,
      weaverName: weaver.weaverName,
      mobileNumber: weaver.mobileNumber,
      bankAccountNo: weaver.bankAccountNo,
      bankIfsc: weaver.bankIfsc,
      bankName: weaver.bankName
    },
    date: date || new Date().toISOString().split("T")[0],
    dispatchGroupId: dispatchGroupId || null,
    issues,
    returns,
    dispatches,
    totalAmount: Number(totalAmount.toFixed(2)),
    currentBalances: balances
  };
}
