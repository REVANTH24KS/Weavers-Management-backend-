import mongoose from "mongoose";
import { Transaction } from "../../models/TransactionSchema.js";
import { Weaver } from "../../models/WeaverSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";
import { getWeaverMaterialBalances } from "../../services/calculationService.js";

function formatTransaction(t) {
  return {
    _id: t._id,
    transaction_id: t.transactionId,
    transactionId: t.transactionId,
    dispatch_group_id: t.dispatchGroupId,
    dispatchGroupId: t.dispatchGroupId,
    weaver_id: t.weaverId,
    weaverId: t.weaverId,
    weaver_name: t.weaver?.weaverName || undefined,
    weaver_code: t.weaver?.weaverCode || undefined,
    transaction_type: t.transactionType,
    transactionType: t.transactionType,
    material_type: t.materialType,
    materialType: t.materialType,
    quantity: t.quantity,
    product_id: t.productId,
    productId: t.productId,
    product_name: t.product?.productName || undefined,
    quantity_produced: t.quantityProduced,
    quantityProduced: t.quantityProduced,
    loom_no: t.loomNo,
    loomNo: t.loomNo,
    loom_id: t.loomId,
    loomId: t.loomId,
    rate_applied: t.rateApplied,
    rateApplied: t.rateApplied,
    amount: t.amount,
    is_paid: t.isPaid,
    isPaid: t.isPaid,
    entry_date: t.entryDate,
    entryDate: t.entryDate,
    notes: t.notes,
    created_at: t.createdAt,
    updated_at: t.updatedAt
  };
}

export async function getTransactions(req, res, next) {
  try {
    const {
      weaver_id, weaverId,
      transaction_type, transactionType,
      material_type, materialType,
      entry_date, entryDate,
      is_paid, isPaid,
      dispatch_group_id, dispatchGroupId
    } = req.query;

    const filter = {};
    if (weaver_id || weaverId) filter.weaverId = Number(weaver_id || weaverId);
    if (transaction_type || transactionType) filter.transactionType = transaction_type || transactionType;
    if (material_type || materialType) filter.materialType = material_type || materialType;
    if (entry_date || entryDate) filter.entryDate = entry_date || entryDate;
    if (dispatch_group_id || dispatchGroupId) filter.dispatchGroupId = dispatch_group_id || dispatchGroupId;
    if (is_paid !== undefined || isPaid !== undefined) {
      const p = is_paid !== undefined ? is_paid : isPaid;
      filter.isPaid = p === "true" || p === true;
    }

    const txns = await Transaction.find(filter)
      .populate("weaver", "weaverName weaverCode")
      .populate("product", "productName productNumber")
      .sort({ entryDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: txns.map(formatTransaction)
    });
  } catch (error) {
    next(error);
  }
}

export async function issueMaterial(req, res, next) {
  try {
    const {
      weaver_id, weaverId,
      entry_date, entryDate,
      notes,
      materials
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

    if (!materials || typeof materials !== "object") {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "materials object is required" }
      });
    }

    const materialKeys = ["jari", "yarn", "color_yarn", "babin"];
    const createdTxns = [];
    const transactionIds = [];

    for (const key of materialKeys) {
      let rawVal = materials[key] || materials[key.replace("_", "")];
      if (rawVal !== undefined && Number(rawVal) > 0) {
        // Materials in kg from frontend are converted to grams (except babin which is in meters)
        const quantity = key === "babin" ? Number(rawVal) : Number((Number(rawVal) * 1000).toFixed(2));
        const nextTxId = await getNextSequence("transactionId");

        const txn = await Transaction.create({
          transactionId: nextTxId,
          weaver: weaver._id,
          weaverId: targetWeaverId,
          transactionType: "material_issue",
          materialType: key,
          quantity,
          entryDate: date,
          notes: notes || null
        });

        createdTxns.push(txn);
        transactionIds.push(nextTxId);
      }
    }

    if (createdTxns.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "No non-zero material quantities provided to issue"
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: "Material issue recorded successfully",
      data: {
        createdCount: createdTxns.length,
        transaction_ids: transactionIds,
        transactions: createdTxns.map(formatTransaction)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function returnMaterial(req, res, next) {
  try {
    const {
      weaver_id, weaverId,
      material_type, materialType,
      quantity,
      entry_date, entryDate,
      notes
    } = req.body;

    const targetWeaverId = Number(weaver_id || weaverId);
    const mat = material_type || materialType;
    const qty = Number(quantity);
    const date = entry_date || entryDate || new Date().toISOString().split("T")[0];

    if (!targetWeaverId || !mat || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "weaver_id, material_type, and quantity (> 0) are required"
        }
      });
    }

    const weaver = await Weaver.findOne({ weaverId: targetWeaverId });
    if (!weaver) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: `Weaver #${targetWeaverId} not found` }
      });
    }

    // Material Balance Validation: Return Quantity <= Current Balance
    const balances = await getWeaverMaterialBalances(targetWeaverId);
    const available = Number(balances[mat] || 0);

    if (qty > available + 0.0001) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Return quantity exceeds available balance",
          details: [
            {
              field: "quantity",
              message: `Exceeds available balance (current: ${available.toLocaleString()} ${mat === "babin" ? "m" : "g"})`
            }
          ]
        }
      });
    }

    const nextTxId = await getNextSequence("transactionId");

    const txn = await Transaction.create({
      transactionId: nextTxId,
      weaver: weaver._id,
      weaverId: targetWeaverId,
      transactionType: "material_return",
      materialType: mat,
      quantity: qty,
      entryDate: date,
      notes: notes || null
    });

    return res.status(201).json({
      success: true,
      message: "Material return recorded successfully",
      data: formatTransaction(txn)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.transactionId = Number(id);
    }

    const txn = await Transaction.findOne(query);
    if (!txn) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Transaction not found" }
      });
    }

    const body = req.body;
    if (body.quantity !== undefined) txn.quantity = Number(body.quantity);
    if (body.entry_date || body.entryDate) txn.entryDate = body.entry_date || body.entryDate;
    if (body.notes !== undefined) txn.notes = body.notes || null;
    if (body.amount !== undefined) txn.amount = Number(body.amount);
    if (body.is_paid !== undefined || body.isPaid !== undefined) {
      const p = body.is_paid !== undefined ? body.is_paid : body.isPaid;
      txn.isPaid = p === true || p === "true";
    }

    await txn.save();

    return res.status(200).json({
      success: true,
      message: "Transaction updated successfully",
      data: formatTransaction(txn)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTransaction(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.transactionId = Number(id);
    }

    const txn = await Transaction.findOne(query);
    if (!txn) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Transaction not found" }
      });
    }

    await Transaction.deleteOne({ _id: txn._id });

    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}
