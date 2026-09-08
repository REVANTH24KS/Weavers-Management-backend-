import mongoose from "mongoose";
import { Transaction } from "../../models/TransactionSchema.js";
import { Weaver } from "../../models/WeaverSchema.js";
import { getWeaverUnpaidAmount } from "../../services/calculationService.js";

export async function markPaid(req, res, next) {
  try {
    const { transaction_ids, transactionIds } = req.body;
    const ids = transaction_ids || transactionIds;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "transaction_ids array is required"
        }
      });
    }

    const objectIdStrings = ids.filter((id) => typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id));
    const numericIds = ids.map(Number).filter((n) => !isNaN(n));
    const orConditions = [];
    if (objectIdStrings.length > 0) orConditions.push({ _id: { $in: objectIdStrings } });
    if (numericIds.length > 0) orConditions.push({ transactionId: { $in: numericIds } });

    const filter = orConditions.length > 1 ? { $or: orConditions } : (orConditions[0] || {});

    const updateResult = await Transaction.updateMany(
      filter,
      { $set: { isPaid: true } }
    );

    return res.status(200).json({
      success: true,
      message: `${updateResult.modifiedCount} transaction(s) marked as paid`
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnpaidPayments(req, res, next) {
  try {
    const { weaver_id, weaverId } = req.query;
    const filter = {
      transactionType: "production_consumption",
      isPaid: false,
      amount: { $gt: 0 }
    };

    if (weaver_id || weaverId) {
      filter.weaverId = Number(weaver_id || weaverId);
    }

    const unpaidTxns = await Transaction.find(filter)
      .populate("weaver", "weaverName weaverCode mobileNumber")
      .populate("product", "productName")
      .sort({ entryDate: -1 })
      .lean();

    const totalUnpaid = unpaidTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        totalUnpaidAmount: Number(totalUnpaid.toFixed(2)),
        count: unpaidTxns.length,
        transactions: unpaidTxns
      }
    });
  } catch (error) {
    next(error);
  }
}
