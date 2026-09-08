import mongoose from "mongoose";
import { Buyer } from "../../models/BuyerSchema.js";
import { ProductBuyerPrice } from "../../models/ProductBuyerPriceSchema.js";
import { Product } from "../../models/ProductSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";

function formatBuyer(b) {
  return {
    _id: b._id,
    buyer_id: b.buyerId,
    buyerId: b.buyerId,
    buyer_name: b.buyerName,
    buyerName: b.buyerName,
    contact_person: b.contactPerson,
    contactPerson: b.contactPerson,
    mobile_number: b.mobileNumber,
    mobileNumber: b.mobileNumber,
    address: b.address,
    status: b.status,
    created_at: b.createdAt,
    updated_at: b.updatedAt
  };
}

export async function getBuyers(req, res, next) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const buyers = await Buyer.find(filter).sort({ buyerId: 1 }).lean();
    return res.status(200).json({
      success: true,
      data: buyers.map(formatBuyer)
    });
  } catch (error) {
    next(error);
  }
}

export async function createBuyer(req, res, next) {
  try {
    const {
      buyer_name, buyerName,
      contact_person, contactPerson,
      mobile_number, mobileNumber,
      address,
      status
    } = req.body;

    const name = buyer_name || buyerName;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "buyer_name is required" }
      });
    }

    const nextBuyerId = await getNextSequence("buyerId");

    const buyer = await Buyer.create({
      buyerId: nextBuyerId,
      buyerName: name.trim(),
      contactPerson: contact_person || contactPerson || null,
      mobileNumber: mobile_number || mobileNumber || null,
      address: address || null,
      status: status || "active"
    });

    return res.status(201).json({
      success: true,
      message: "Buyer created successfully",
      data: formatBuyer(buyer)
    });
  } catch (error) {
    next(error);
  }
}

export async function getBuyerById(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.buyerId = Number(id);
    }

    const buyer = await Buyer.findOne(query).lean();
    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Buyer not found" }
      });
    }

    return res.status(200).json({
      success: true,
      data: formatBuyer(buyer)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBuyer(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.buyerId = Number(id);
    }

    const buyer = await Buyer.findOne(query);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Buyer not found" }
      });
    }

    const body = req.body;
    if (body.buyer_name || body.buyerName) buyer.buyerName = (body.buyer_name || body.buyerName).trim();
    if (body.contact_person !== undefined || body.contactPerson !== undefined) {
      buyer.contactPerson = body.contact_person || body.contactPerson || null;
    }
    if (body.mobile_number !== undefined || body.mobileNumber !== undefined) {
      buyer.mobileNumber = body.mobile_number || body.mobileNumber || null;
    }
    if (body.address !== undefined) buyer.address = body.address || null;
    if (body.status) buyer.status = body.status;

    await buyer.save();

    return res.status(200).json({
      success: true,
      message: "Buyer updated successfully",
      data: formatBuyer(buyer)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteBuyer(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.buyerId = Number(id);
    }

    const buyer = await Buyer.findOne(query);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Buyer not found" }
      });
    }

    await Buyer.deleteOne({ _id: buyer._id });

    return res.status(200).json({
      success: true,
      message: "Buyer deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}

export async function getBuyerPrices(req, res, next) {
  try {
    const { id } = req.params;
    let buyer = null;
    if (typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id)) {
      buyer = await Buyer.findById(id);
    } else if (!isNaN(Number(id))) {
      buyer = await Buyer.findOne({ buyerId: Number(id) });
    }

    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Buyer not found" }
      });
    }

    const prices = await ProductBuyerPrice.find({ buyerId: buyer.buyerId })
      .populate("product")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: prices
    });
  } catch (error) {
    next(error);
  }
}

export async function setBuyerPrice(req, res, next) {
  try {
    const { id } = req.params;
    let buyer = null;
    if (typeof id === "string" && id.length === 24 && mongoose.isValidObjectId(id)) {
      buyer = await Buyer.findById(id);
    } else if (!isNaN(Number(id))) {
      buyer = await Buyer.findOne({ buyerId: Number(id) });
    }

    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Buyer not found" }
      });
    }

    const { product_id, productId, selling_price, sellingPrice, effective_from, effectiveFrom } = req.body;
    const pId = product_id !== undefined ? product_id : productId;
    const price = Number(selling_price !== undefined ? selling_price : sellingPrice);
    const fromDate = effective_from || effectiveFrom || new Date().toISOString().split("T")[0];

    let product = null;
    if (typeof pId === "string" && pId.length === 24 && mongoose.isValidObjectId(pId)) {
      product = await Product.findById(pId);
    } else if (!isNaN(Number(pId))) {
      product = await Product.findOne({ productId: Number(pId) });
    }

    if (!product || isNaN(price) || price < 0) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Valid product and selling_price (>= 0) are required" }
      });
    }

    // Close any previous open price for this buyer and product
    await ProductBuyerPrice.updateMany(
      { buyerId: buyer.buyerId, productId: product.productId, effectiveTo: null },
      { $set: { effectiveTo: fromDate } }
    );

    const nextPriceId = await getNextSequence("priceId");

    const newPrice = await ProductBuyerPrice.create({
      priceId: nextPriceId,
      buyer: buyer._id,
      buyerId: buyer.buyerId,
      product: product._id,
      productId: product.productId,
      sellingPrice: price,
      effectiveFrom: fromDate,
      effectiveTo: null
    });

    return res.status(201).json({
      success: true,
      message: "Buyer product price recorded successfully",
      data: newPrice
    });
  } catch (error) {
    next(error);
  }
}
