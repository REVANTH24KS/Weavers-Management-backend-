import mongoose from "mongoose";
import { Transaction } from "../../models/TransactionSchema.js";
import { Weaver } from "../../models/WeaverSchema.js";
import { Product } from "../../models/ProductSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";

function formatTxn(t) {
  return {
    _id: t._id,
    transaction_id: t.transactionId,
    transactionId: t.transactionId,
    dispatch_group_id: t.dispatchGroupId,
    dispatchGroupId: t.dispatchGroupId,
    weaver_id: t.weaverId,
    weaverId: t.weaverId,
    weaver_name: t.weaver?.weaverName,
    weaver_code: t.weaver?.weaverCode,
    transaction_type: t.transactionType,
    material_type: t.materialType,
    quantity: t.quantity,
    product_id: t.productId,
    productId: t.productId,
    product_name: t.product?.productName,
    quantity_produced: t.quantityProduced,
    quantityProduced: t.quantityProduced,
    loom_no: t.loomNo,
    loomNo: t.loomNo,
    rate_applied: t.rateApplied,
    rateApplied: t.rateApplied,
    amount: t.amount,
    is_paid: t.isPaid,
    isPaid: t.isPaid,
    entry_date: t.entryDate,
    entryDate: t.entryDate,
    notes: t.notes
  };
}

export async function getProductionEntries(req, res, next) {
  try {
    const { weaver_id, weaverId, entry_date, entryDate, dispatch_group_id, dispatchGroupId } = req.query;
    const filter = { transactionType: "production_consumption" };
    if (weaver_id || weaverId) filter.weaverId = Number(weaver_id || weaverId);
    if (entry_date || entryDate) filter.entryDate = entry_date || entryDate;
    if (dispatch_group_id || dispatchGroupId) filter.dispatchGroupId = dispatch_group_id || dispatchGroupId;

    const txns = await Transaction.find(filter)
      .populate("weaver", "weaverName weaverCode")
      .populate("product", "productName productNumber")
      .sort({ entryDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: txns.map(formatTxn)
    });
  } catch (error) {
    next(error);
  }
}

export async function createProductionDispatch(req, res, next) {
  try {
    const {
      weaver_id, weaverId,
      entry_date, entryDate,
      notes,
      material_issues, materialIssues,
      looms
    } = req.body;

    const targetWeaverId = Number(weaver_id || weaverId);
    const date = entry_date || entryDate || new Date().toISOString().split("T")[0];

    if (!targetWeaverId) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "weaver_id is required" }
      });
    }

    const weaver = await Weaver.findOne({ weaverId: targetWeaverId });
    if (!weaver) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: `Weaver #${targetWeaverId} not found` }
      });
    }

    if (!Array.isArray(looms) || looms.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "looms array with at least one loom entry is required" }
      });
    }

    const dispatchGroupId = `disp_${Date.now()}_${targetWeaverId}`;
    const createdTransactions = [];
    let totalPieces = 0;
    let totalAmount = 0;

    // 1. Process Material Issues if provided in the same dispatch visit
    const issuesObj = material_issues || materialIssues;
    if (issuesObj && typeof issuesObj === "object") {
      const issueKeys = ["jari", "yarn", "color_yarn", "babin"];
      for (const key of issueKeys) {
        const val = issuesObj[key];
        if (val !== undefined && Number(val) > 0) {
          const qty = key === "babin" ? Number(val) : Number((Number(val) * 1000).toFixed(2));
          const nextTxId = await getNextSequence("transactionId");
          const issueTxn = await Transaction.create({
            transactionId: nextTxId,
            dispatchGroupId,
            weaver: weaver._id,
            weaverId: targetWeaverId,
            transactionType: "material_issue",
            materialType: key,
            quantity: qty,
            entryDate: date,
            notes: notes ? `Dispatch visit issue: ${notes}` : "Dispatch visit issue"
          });
          createdTransactions.push(issueTxn);
        }
      }
    }

    // 2. Process Looms & Production Consumption
    for (const item of looms) {
      const loomNo = Number(item.loom_no || item.loomNo || 1);
      const pieces = Number(item.pieces || item.quantity_produced || item.quantityProduced || 0);
      if (pieces <= 0) continue;

      totalPieces += pieces;

      // Find product
      let product = null;
      const pId = item.product_id !== undefined ? item.product_id : item.productId;
      if (pId !== undefined && pId !== null) {
        if (typeof pId === "string" && pId.length === 24 && mongoose.isValidObjectId(pId)) {
          product = await Product.findById(pId);
        } else if (!isNaN(Number(pId))) {
          product = await Product.findOne({ productId: Number(pId) });
        }
      }

      const weavingRate = Number(
        item.weaving_rate !== undefined ? item.weaving_rate : (item.weavingRate !== undefined ? item.weavingRate : (product?.weavingRate || 0))
      );

      const loomLaborWage = Number(
        item.custom_amount !== undefined ? item.custom_amount : (item.customAmount !== undefined ? item.customAmount : pieces * weavingRate)
      );

      totalAmount += loomLaborWage;

      // Per unit consumption defaults from product or custom override
      const perUnit = item.per_unit || item.perUnit || {};
      const jariPerUnit = perUnit.jari !== undefined ? Number(perUnit.jari) : (product?.defaultJariPerUnit || 0);
      const yarnPerUnit = perUnit.yarn !== undefined ? Number(perUnit.yarn) : (product?.defaultYarnPerUnit || 0);
      const colorYarnPerUnit = perUnit.color_yarn !== undefined ? Number(perUnit.color_yarn) : (perUnit.colorYarn !== undefined ? Number(perUnit.colorYarn) : (product?.defaultColorYarnPerUnit || 0));
      const babinPerUnit = perUnit.babin !== undefined ? Number(perUnit.babin) : (product?.defaultBabinPerUnit || 0);

      const materialsToRecord = [
        { type: "jari", qty: pieces * jariPerUnit },
        { type: "yarn", qty: pieces * yarnPerUnit },
        { type: "color_yarn", qty: pieces * colorYarnPerUnit },
        { type: "babin", qty: pieces * babinPerUnit }
      ].filter((m) => m.qty > 0);

      // If no material quantities are recorded, still create one row for the piece wage
      if (materialsToRecord.length === 0) {
        materialsToRecord.push({ type: "yarn", qty: 0 });
      }

      let isFirstRowForLoom = true;

      for (const m of materialsToRecord) {
        const nextTxId = await getNextSequence("transactionId");
        const rowAmount = isFirstRowForLoom ? loomLaborWage : 0;

        const prodTxn = await Transaction.create({
          transactionId: nextTxId,
          dispatchGroupId,
          weaver: weaver._id,
          weaverId: targetWeaverId,
          transactionType: "production_consumption",
          materialType: m.type,
          quantity: Number(m.qty.toFixed(2)),
          product: product ? product._id : null,
          productId: product ? product.productId : null,
          quantityProduced: pieces,
          loomNo,
          rateApplied: weavingRate,
          amount: rowAmount,
          isPaid: false,
          entryDate: date,
          notes: notes || null
        });

        createdTransactions.push(prodTxn);
        isFirstRowForLoom = false;
      }
    }

    return res.status(201).json({
      success: true,
      message: "Production dispatch recorded successfully",
      data: {
        dispatchGroupId,
        totalPieces,
        totalAmount: Number(totalAmount.toFixed(2)),
        createdTransactionsCount: createdTransactions.length
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProductionDispatch(req, res, next) {
  try {
    const {
      transaction_ids, transactionIds,
      dispatch_group_id, dispatchGroupId,
      weaver_id, weaverId,
      entry_date, entryDate,
      notes,
      looms,
      is_paid, isPaid
    } = req.body;

    const txIds = transaction_ids || transactionIds;
    const groupId = dispatch_group_id || dispatchGroupId;

    let deleteFilter = {};
    if (groupId) {
      deleteFilter.dispatchGroupId = groupId;
    } else if (Array.isArray(txIds) && txIds.length > 0) {
      const objectIdStrings = txIds.filter((id) => typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id));
      const numericIds = txIds.map(Number).filter((n) => !isNaN(n));
      const orConditions = [];
      if (objectIdStrings.length > 0) orConditions.push({ _id: { $in: objectIdStrings } });
      if (numericIds.length > 0) orConditions.push({ transactionId: { $in: numericIds } });
      deleteFilter = orConditions.length > 1 ? { $or: orConditions } : (orConditions[0] || {});
    } else {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "dispatch_group_id or transaction_ids array is required" }
      });
    }

    // Delete existing records for this dispatch
    await Transaction.deleteMany(deleteFilter);

    // If looms provided, re-create the dispatch
    if (Array.isArray(looms) && looms.length > 0) {
      req.body.entry_date = entry_date || entryDate;
      req.body.weaver_id = weaver_id || weaverId;
      req.body.notes = notes;
      req.body.looms = looms;
      return createProductionDispatch(req, res, next);
    }

    return res.status(200).json({
      success: true,
      message: "Production dispatch records updated successfully"
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProductionDispatch(req, res, next) {
  try {
    const {
      transaction_ids, transactionIds,
      dispatch_group_id, dispatchGroupId
    } = req.body;

    const groupId = dispatch_group_id || dispatchGroupId || req.query.dispatch_group_id || req.query.dispatchGroupId;
    const txIds = transaction_ids || transactionIds;

    let deleteFilter = {};
    if (groupId) {
      deleteFilter.dispatchGroupId = groupId;
    } else if (Array.isArray(txIds) && txIds.length > 0) {
      const objectIdStrings = txIds.filter((id) => typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id));
      const numericIds = txIds.map(Number).filter((n) => !isNaN(n));
      const orConditions = [];
      if (objectIdStrings.length > 0) orConditions.push({ _id: { $in: objectIdStrings } });
      if (numericIds.length > 0) orConditions.push({ transactionId: { $in: numericIds } });
      deleteFilter = orConditions.length > 1 ? { $or: orConditions } : (orConditions[0] || {});
    } else {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "dispatch_group_id or transaction_ids array is required" }
      });
    }

    const result = await Transaction.deleteMany(deleteFilter);

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} dispatch transaction(s)`
    });
  } catch (error) {
    next(error);
  }
}
