import mongoose from "mongoose";
import { Babin } from "../../models/BabinSchema.js";
import { Weaver } from "../../models/WeaverSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";
import { calculateBabinUsage } from "../../services/calculationService.js";

export async function getBabins(req, res, next) {
  try {
    const { weaver_id, weaverId, babin_type, babinType } = req.query;
    const filter = {};
    if (weaver_id || weaverId) filter.weaverId = Number(weaver_id || weaverId);
    if (babin_type || babinType) filter.babinType = babin_type || babinType;

    const data = await calculateBabinUsage(filter);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function createBabin(req, res, next) {
  try {
    const {
      babin_number, babinNumber,
      weaver_id, weaverId,
      loom_no, loomNo,
      babin_type, babinType,
      color_name, colorName,
      length_meters, lengthMeters,
      distributor_name, distributorName,
      purchase_date, purchaseDate,
      notes
    } = req.body;

    const targetWeaverId = Number(weaver_id || weaverId);
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

    const number = babin_number || babinNumber;
    const length = Number(length_meters !== undefined ? length_meters : lengthMeters);
    const distributor = distributor_name || distributorName;
    const date = purchase_date || purchaseDate;

    if (!number || isNaN(length) || length <= 0 || !distributor || !date) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Babin number, length in meters (>0), distributor name, and purchase date are required"
        }
      });
    }

    const nextBabinId = await getNextSequence("babinId");

    const babin = await Babin.create({
      babinId: nextBabinId,
      babinNumber: number.trim(),
      weaver: weaver._id,
      weaverId: targetWeaverId,
      loomNo: Number(loom_no || loomNo || 1),
      babinType: babin_type || babinType || "normal",
      colorName: color_name || colorName || null,
      lengthMeters: length,
      distributorName: distributor.trim(),
      purchaseDate: date,
      notes: notes || null
    });

    const usageList = await calculateBabinUsage({ weaverId: targetWeaverId });
    const result = usageList.find((b) => b._id.toString() === babin._id.toString()) || {
      _id: babin._id,
      babin_id: babin.babinId,
      babin_number: babin.babinNumber,
      weaver_id: babin.weaverId,
      weaver_name: weaver.weaverName,
      loom_no: babin.loomNo,
      babin_type: babin.babinType,
      color_name: babin.colorName,
      length_meters: babin.lengthMeters,
      distributor_name: babin.distributorName,
      purchase_date: babin.purchaseDate,
      notes: babin.notes,
      used_meters: 0,
      remaining_meters: babin.lengthMeters,
      is_completed: false,
      is_over: false
    };

    return res.status(201).json({
      success: true,
      message: "Babin purchase recorded successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getBabinById(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.babinId = Number(id);
    } else {
      query.babinNumber = id;
    }

    const babin = await Babin.findOne(query).lean();
    if (!babin) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Babin record not found" }
      });
    }

    const usageList = await calculateBabinUsage({ weaverId: babin.weaverId });
    const matched = usageList.find((b) => b._id.toString() === babin._id.toString()) || babin;

    return res.status(200).json({
      success: true,
      data: matched
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBabin(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.babinId = Number(id);
    } else {
      query.babinNumber = id;
    }

    const babin = await Babin.findOne(query);
    if (!babin) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Babin record not found" }
      });
    }

    const body = req.body;
    if (body.babin_number || body.babinNumber) babin.babinNumber = (body.babin_number || body.babinNumber).trim();
    if (body.loom_no !== undefined || body.loomNo !== undefined) babin.loomNo = Number(body.loom_no || body.loomNo);
    if (body.babin_type || body.babinType) babin.babinType = body.babin_type || body.babinType;
    if (body.color_name !== undefined || body.colorName !== undefined) babin.colorName = body.color_name || body.colorName || null;
    if (body.length_meters !== undefined || body.lengthMeters !== undefined) babin.lengthMeters = Number(body.length_meters || body.lengthMeters);
    if (body.distributor_name || body.distributorName) babin.distributorName = (body.distributor_name || body.distributorName).trim();
    if (body.purchase_date || body.purchaseDate) babin.purchaseDate = body.purchase_date || body.purchaseDate;
    if (body.notes !== undefined) babin.notes = body.notes || null;

    if (body.weaver_id || body.weaverId) {
      const wId = Number(body.weaver_id || body.weaverId);
      const w = await Weaver.findOne({ weaverId: wId });
      if (w) {
        babin.weaver = w._id;
        babin.weaverId = w.weaverId;
      }
    }

    await babin.save();

    const usageList = await calculateBabinUsage({ weaverId: babin.weaverId });
    const matched = usageList.find((b) => b._id.toString() === babin._id.toString()) || babin;

    return res.status(200).json({
      success: true,
      message: "Babin record updated successfully",
      data: matched
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteBabin(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.babinId = Number(id);
    } else {
      query.babinNumber = id;
    }

    const babin = await Babin.findOne(query);
    if (!babin) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Babin record not found" }
      });
    }

    await Babin.deleteOne({ _id: babin._id });

    return res.status(200).json({
      success: true,
      message: "Babin record deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}
