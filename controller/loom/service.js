import mongoose from "mongoose";
import { Loom } from "../../models/LoomSchema.js";
import { Weaver } from "../../models/WeaverSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";
import { calculatePavuUsage } from "../../services/calculationService.js";

export async function getLooms(req, res, next) {
  try {
    const { weaver_id, weaverId, pavu_type, pavuType } = req.query;
    const filter = {};
    if (weaver_id || weaverId) filter.weaverId = Number(weaver_id || weaverId);
    if (pavu_type || pavuType) filter.pavuType = pavu_type || pavuType;

    const data = await calculatePavuUsage(filter);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function createLoom(req, res, next) {
  try {
    const {
      loom_number, loomNumber,
      weaver_id, weaverId,
      loom_no, loomNo,
      pavu_type, pavuType,
      pavu_elai, pavuElai,
      length_meters, lengthMeters,
      distributor_name, distributorName,
      received_date, receivedDate,
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

    const number = loom_number || loomNumber;
    const length = Number(length_meters !== undefined ? length_meters : lengthMeters);
    const distributor = distributor_name || distributorName;
    const date = received_date || receivedDate;

    if (!number || isNaN(length) || length <= 0 || !distributor || !date) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Loom/Pavu number, length in meters (>0), distributor name, and received date are required"
        }
      });
    }

    const nextLoomId = await getNextSequence("loomId");

    const loom = await Loom.create({
      loomId: nextLoomId,
      loomNumber: number.trim(),
      weaver: weaver._id,
      weaverId: targetWeaverId,
      loomNo: Number(loom_no || loomNo || 1),
      pavuType: pavu_type || pavuType || "normal",
      pavuElai: pavu_elai || pavuElai || null,
      lengthMeters: length,
      distributorName: distributor.trim(),
      receivedDate: date,
      notes: notes || null
    });

    const [computed] = await calculatePavuUsage({ weaverId: targetWeaverId });
    const result = (await calculatePavuUsage({ weaverId: targetWeaverId })).find((l) => l._id.toString() === loom._id.toString()) || {
      _id: loom._id,
      loom_id: loom.loomId,
      loom_number: loom.loomNumber,
      weaver_id: loom.weaverId,
      weaver_name: weaver.weaverName,
      loom_no: loom.loomNo,
      pavu_type: loom.pavuType,
      pavu_elai: loom.pavuElai,
      length_meters: loom.lengthMeters,
      distributor_name: loom.distributorName,
      received_date: loom.receivedDate,
      notes: loom.notes,
      used_meters: 0,
      remaining_meters: loom.lengthMeters,
      is_completed: false,
      is_over: false
    };

    return res.status(201).json({
      success: true,
      message: "Loom pavu warp recorded successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getLoomById(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.loomId = Number(id);
    } else {
      query.loomNumber = id;
    }

    const loom = await Loom.findOne(query).lean();
    if (!loom) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Loom pavu record not found" }
      });
    }

    const usageList = await calculatePavuUsage({ weaverId: loom.weaverId });
    const matched = usageList.find((l) => l._id.toString() === loom._id.toString()) || loom;

    return res.status(200).json({
      success: true,
      data: matched
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLoom(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.loomId = Number(id);
    } else {
      query.loomNumber = id;
    }

    const loom = await Loom.findOne(query);
    if (!loom) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Loom record not found" }
      });
    }

    const body = req.body;
    if (body.loom_number || body.loomNumber) loom.loomNumber = (body.loom_number || body.loomNumber).trim();
    if (body.loom_no !== undefined || body.loomNo !== undefined) loom.loomNo = Number(body.loom_no || body.loomNo);
    if (body.pavu_type || body.pavuType) loom.pavuType = body.pavu_type || body.pavuType;
    if (body.pavu_elai !== undefined || body.pavuElai !== undefined) loom.pavuElai = body.pavu_elai || body.pavuElai || null;
    if (body.length_meters !== undefined || body.lengthMeters !== undefined) loom.lengthMeters = Number(body.length_meters || body.lengthMeters);
    if (body.distributor_name || body.distributorName) loom.distributorName = (body.distributor_name || body.distributorName).trim();
    if (body.received_date || body.receivedDate) loom.receivedDate = body.received_date || body.receivedDate;
    if (body.notes !== undefined) loom.notes = body.notes || null;

    if (body.weaver_id || body.weaverId) {
      const wId = Number(body.weaver_id || body.weaverId);
      const w = await Weaver.findOne({ weaverId: wId });
      if (w) {
        loom.weaver = w._id;
        loom.weaverId = w.weaverId;
      }
    }

    await loom.save();

    const usageList = await calculatePavuUsage({ weaverId: loom.weaverId });
    const matched = usageList.find((l) => l._id.toString() === loom._id.toString()) || loom;

    return res.status(200).json({
      success: true,
      message: "Loom pavu record updated successfully",
      data: matched
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLoom(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.loomId = Number(id);
    } else {
      query.loomNumber = id;
    }

    const loom = await Loom.findOne(query);
    if (!loom) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Loom record not found" }
      });
    }

    await Loom.deleteOne({ _id: loom._id });

    return res.status(200).json({
      success: true,
      message: "Loom pavu record deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}
