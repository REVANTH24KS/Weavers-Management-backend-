import mongoose from "mongoose";
import { MaterialRate } from "../../models/MaterialRateSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";

function formatRate(r) {
  return {
    _id: r._id,
    rate_id: r.rateId,
    rateId: r.rateId,
    material_type: r.materialType,
    materialType: r.materialType,
    rate_per_unit: r.ratePerUnit,
    ratePerUnit: r.ratePerUnit,
    effective_from: r.effectiveFrom,
    effectiveFrom: r.effectiveFrom,
    effective_to: r.effectiveTo,
    effectiveTo: r.effectiveTo,
    created_at: r.createdAt,
    updated_at: r.updatedAt
  };
}

export async function getRates(req, res, next) {
  try {
    const { material_type, materialType } = req.query;
    const filter = {};
    if (material_type || materialType) filter.materialType = material_type || materialType;

    const rates = await MaterialRate.find(filter).sort({ effectiveFrom: -1, createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: rates.map(formatRate)
    });
  } catch (error) {
    next(error);
  }
}

export async function createRate(req, res, next) {
  try {
    const {
      material_type, materialType,
      rate_per_unit, ratePerUnit,
      effective_from, effectiveFrom
    } = req.body;

    const mat = material_type || materialType;
    const rate = Number(rate_per_unit !== undefined ? rate_per_unit : ratePerUnit);
    const fromDate = effective_from || effectiveFrom;

    if (!mat || isNaN(rate) || rate <= 0 || !fromDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "material_type, rate_per_unit (> 0), and effective_from date are required"
        }
      });
    }

    // 1. Close out any currently open rate for this material type
    await MaterialRate.updateMany(
      { materialType: mat, effectiveTo: null },
      { $set: { effectiveTo: fromDate } }
    );

    const nextRateId = await getNextSequence("rateId");

    // 2. Insert new active rate
    const newRate = await MaterialRate.create({
      rateId: nextRateId,
      materialType: mat,
      ratePerUnit: rate,
      effectiveFrom: fromDate,
      effectiveTo: null
    });

    return res.status(201).json({
      success: true,
      message: "Material rate created successfully",
      data: formatRate(newRate)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRate(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.rateId = Number(id);
    }

    const rate = await MaterialRate.findOne(query);
    if (!rate) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Material rate record not found" }
      });
    }

    const body = req.body;
    if (body.material_type || body.materialType) rate.materialType = body.material_type || body.materialType;
    if (body.rate_per_unit !== undefined || body.ratePerUnit !== undefined) {
      rate.ratePerUnit = Number(body.rate_per_unit !== undefined ? body.rate_per_unit : body.ratePerUnit);
    }
    if (body.effective_from || body.effectiveFrom) rate.effectiveFrom = body.effective_from || body.effectiveFrom;
    if (body.effective_to !== undefined || body.effectiveTo !== undefined) {
      rate.effectiveTo = body.effective_to || body.effectiveTo || null;
    }

    await rate.save();

    return res.status(200).json({
      success: true,
      message: "Material rate updated successfully",
      data: formatRate(rate)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteRate(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.rateId = Number(id);
    }

    const rate = await MaterialRate.findOne(query);
    if (!rate) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Material rate not found" }
      });
    }

    await MaterialRate.deleteOne({ _id: rate._id });

    return res.status(200).json({
      success: true,
      message: "Material rate deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}
