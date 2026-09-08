import mongoose from "mongoose";
import { Weaver } from "../../models/WeaverSchema.js";
import { Product } from "../../models/ProductSchema.js";
import { Transaction } from "../../models/TransactionSchema.js";
import { Loom } from "../../models/LoomSchema.js";
import { Babin } from "../../models/BabinSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";
import { getNextWeaverCode } from "../../services/codeGeneratorService.js";
import {
  getWeaverMaterialBalances,
  getWeaverUnpaidAmount,
  getWeaverAgingStatus
} from "../../services/calculationService.js";

// Helper to format weaver document to response
function formatWeaver(w) {
  const assignedProductIds = (w.assignedProducts || []).map((p) => {
    if (typeof p === "object" && p !== null) {
      return p.productId || p._id;
    }
    return p;
  });

  return {
    _id: w._id,
    weaver_id: w.weaverId,
    weaverId: w.weaverId,
    weaver_code: w.weaverCode,
    weaverCode: w.weaverCode,
    weaver_name: w.weaverName,
    weaverName: w.weaverName,
    mobile_number: w.mobileNumber,
    mobileNumber: w.mobileNumber,
    bank_account_no: w.bankAccountNo,
    bankAccountNo: w.bankAccountNo,
    bank_ifsc: w.bankIfsc,
    bankIfsc: w.bankIfsc,
    bank_name: w.bankName,
    bankName: w.bankName,
    number_of_looms: w.numberOfLooms,
    numberOfLooms: w.numberOfLooms,
    status: w.status,
    assigned_product_ids: assignedProductIds,
    assignedProducts: w.assignedProducts,
    created_at: w.createdAt,
    updated_at: w.updatedAt
  };
}

export async function getWeavers(req, res, next) {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { weaverName: regex },
        { weaverCode: regex },
        { mobileNumber: regex }
      ];
    }

    const weavers = await Weaver.find(filter)
      .populate("assignedProducts")
      .sort({ weaverId: 1 })
      .lean();

    const formatted = weavers.map(formatWeaver);

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
}

export async function getNextCode(req, res, next) {
  try {
    const nextCode = await getNextWeaverCode();
    return res.status(200).json({
      success: true,
      data: { nextCode }
    });
  } catch (error) {
    next(error);
  }
}

export async function createWeaver(req, res, next) {
  try {
    const {
      weaver_code, weaverCode,
      weaver_name, weaverName,
      mobile_number, mobileNumber,
      bank_account_no, bankAccountNo,
      bank_ifsc, bankIfsc,
      bank_name, bankName,
      number_of_looms, numberOfLooms,
      status,
      product_ids, assigned_product_ids, assignedProducts
    } = req.body;

    const name = weaver_name || weaverName;
    const mobile = mobile_number || mobileNumber;
    const account = bank_account_no || bankAccountNo;
    const ifsc = bank_ifsc || bankIfsc;
    const bank = bank_name || bankName || null;
    const loomsCount = number_of_looms !== undefined ? number_of_looms : (numberOfLooms !== undefined ? numberOfLooms : 1);
    const weaverStatus = status || "active";

    if (!name || !mobile || !account || !ifsc) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Weaver name, mobile number, bank account number, and IFSC code are required"
        }
      });
    }

    const code = (weaver_code || weaverCode || (await getNextWeaverCode())).toUpperCase().trim();
    const existingCode = await Weaver.findOne({ weaverCode: code });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        error: {
          code: "CONFLICT",
          message: `Weaver code ${code} is already in use`
        }
      });
    }

    // Resolve assigned product ObjectIds
    const rawProdIds = product_ids || assigned_product_ids || assignedProducts || [];
    let productObjectIds = [];
    if (rawProdIds.length > 0) {
      const objectIdStrings = rawProdIds.filter((id) => typeof id === "string" && mongoose.isValidObjectId(id) && id.length === 24);
      const numericIds = rawProdIds.map(Number).filter((n) => !isNaN(n));
      const orConditions = [];
      if (objectIdStrings.length > 0) orConditions.push({ _id: { $in: objectIdStrings } });
      if (numericIds.length > 0) orConditions.push({ productId: { $in: numericIds } });

      if (orConditions.length > 0) {
        const foundProducts = await Product.find({ $or: orConditions });
        productObjectIds = foundProducts.map((p) => p._id);
      }
    }

    const nextWeaverId = await getNextSequence("weaverId");

    const newWeaver = await Weaver.create({
      weaverId: nextWeaverId,
      weaverCode: code,
      weaverName: name.trim(),
      mobileNumber: mobile.trim(),
      bankAccountNo: account.trim(),
      bankIfsc: ifsc.trim().toUpperCase(),
      bankName: bank ? bank.trim() : null,
      numberOfLooms: loomsCount,
      status: weaverStatus,
      assignedProducts: productObjectIds
    });

    const populated = await Weaver.findById(newWeaver._id).populate("assignedProducts").lean();

    return res.status(201).json({
      success: true,
      message: "Weaver created successfully",
      data: formatWeaver(populated)
    });
  } catch (error) {
    next(error);
  }
}

export async function getWeaverById(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.weaverId = Number(id);
    } else {
      query.weaverCode = id.toUpperCase();
    }

    const weaver = await Weaver.findOne(query).populate("assignedProducts").lean();
    if (!weaver) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Weaver not found" }
      });
    }

    const balances = await getWeaverMaterialBalances(weaver.weaverId);
    const totalUnpaidAmount = await getWeaverUnpaidAmount(weaver.weaverId);
    const aging = await getWeaverAgingStatus(weaver.weaverId);

    return res.status(200).json({
      success: true,
      data: {
        weaver: formatWeaver(weaver),
        balances: {
          jari: balances.jari,
          yarn: balances.yarn,
          color_yarn: balances.color_yarn,
          babin: balances.babin
        },
        totalUnpaidAmount,
        daysSinceLastProduction: aging.daysSinceLastProduction,
        isAging: aging.isAging
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateWeaver(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.weaverId = Number(id);
    } else {
      query.weaverCode = id.toUpperCase();
    }

    const weaver = await Weaver.findOne(query);
    if (!weaver) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Weaver not found" }
      });
    }

    const {
      weaver_code, weaverCode,
      weaver_name, weaverName,
      mobile_number, mobileNumber,
      bank_account_no, bankAccountNo,
      bank_ifsc, bankIfsc,
      bank_name, bankName,
      number_of_looms, numberOfLooms,
      status,
      product_ids, assigned_product_ids, assignedProducts
    } = req.body;

    if (weaver_name || weaverName) weaver.weaverName = (weaver_name || weaverName).trim();
    if (weaver_code || weaverCode) weaver.weaverCode = (weaver_code || weaverCode).trim().toUpperCase();
    if (mobile_number || mobileNumber) weaver.mobileNumber = (mobile_number || mobileNumber).trim();
    if (bank_account_no || bankAccountNo) weaver.bankAccountNo = (bank_account_no || bankAccountNo).trim();
    if (bank_ifsc || bankIfsc) weaver.bankIfsc = (bank_ifsc || bankIfsc).trim().toUpperCase();
    if (bank_name !== undefined || bankName !== undefined) weaver.bankName = bank_name || bankName || null;
    if (number_of_looms !== undefined) weaver.numberOfLooms = number_of_looms;
    if (numberOfLooms !== undefined) weaver.numberOfLooms = numberOfLooms;
    if (status) weaver.status = status;

    const rawProdIds = product_ids || assigned_product_ids || assignedProducts;
    if (rawProdIds !== undefined) {
      const objectIdStrings = rawProdIds.filter((id) => typeof id === "string" && mongoose.isValidObjectId(id) && id.length === 24);
      const numericIds = rawProdIds.map(Number).filter((n) => !isNaN(n));
      const orConditions = [];
      if (objectIdStrings.length > 0) orConditions.push({ _id: { $in: objectIdStrings } });
      if (numericIds.length > 0) orConditions.push({ productId: { $in: numericIds } });

      if (orConditions.length > 0) {
        const foundProducts = await Product.find({ $or: orConditions });
        weaver.assignedProducts = foundProducts.map((p) => p._id);
      } else {
        weaver.assignedProducts = [];
      }
    }

    await weaver.save();
    const updated = await Weaver.findById(weaver._id).populate("assignedProducts").lean();

    return res.status(200).json({
      success: true,
      message: "Weaver updated successfully",
      data: formatWeaver(updated)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteWeaver(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.weaverId = Number(id);
    } else {
      query.weaverCode = id.toUpperCase();
    }

    const weaver = await Weaver.findOne(query);
    if (!weaver) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Weaver not found" }
      });
    }

    // Check if weaver has transactions, pavu (looms), or babin records
    const [txCount, loomCount, babinCount] = await Promise.all([
      Transaction.countDocuments({ weaverId: weaver.weaverId }),
      Loom.countDocuments({ weaverId: weaver.weaverId }),
      Babin.countDocuments({ weaverId: weaver.weaverId })
    ]);

    if (txCount > 0 || loomCount > 0 || babinCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CANNOT_DELETE_ACTIVE_WEAVER",
          message: `Cannot delete weaver '${weaver.weaverName}' with existing ${txCount} transaction(s), ${loomCount} loom(s), or ${babinCount} babin record(s). Mark the weaver as inactive instead.`
        }
      });
    }

    await Weaver.deleteOne({ _id: weaver._id });

    return res.status(200).json({
      success: true,
      message: "Weaver deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}
