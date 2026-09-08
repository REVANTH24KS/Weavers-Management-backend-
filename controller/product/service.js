import mongoose from "mongoose";
import { Product } from "../../models/ProductSchema.js";
import { Transaction } from "../../models/TransactionSchema.js";
import { getNextSequence } from "../../models/CounterSchema.js";
import { getNextProductNumber } from "../../services/codeGeneratorService.js";

function formatProduct(p) {
  return {
    _id: p._id,
    product_id: p.productId,
    productId: p.productId,
    product_number: p.productNumber,
    productNumber: p.productNumber,
    product_name: p.productName,
    productName: p.productName,
    length_meters: p.lengthMeters,
    lengthMeters: p.lengthMeters,
    weaving_rate: p.weavingRate,
    weavingRate: p.weavingRate,
    default_jari_per_unit: p.defaultJariPerUnit,
    defaultJariPerUnit: p.defaultJariPerUnit,
    default_yarn_per_unit: p.defaultYarnPerUnit,
    defaultYarnPerUnit: p.defaultYarnPerUnit,
    default_color_yarn_per_unit: p.defaultColorYarnPerUnit,
    defaultColorYarnPerUnit: p.defaultColorYarnPerUnit,
    default_babin_per_unit: p.defaultBabinPerUnit,
    defaultBabinPerUnit: p.defaultBabinPerUnit,
    default_jari_babin_per_unit: p.defaultJariBabinPerUnit,
    defaultJariBabinPerUnit: p.defaultJariBabinPerUnit,
    default_color_babin_per_unit: p.defaultColorBabinPerUnit,
    defaultColorBabinPerUnit: p.defaultColorBabinPerUnit,
    default_pavu_per_unit: p.defaultPavuPerUnit,
    defaultPavuPerUnit: p.defaultPavuPerUnit,
    default_jari_pavu_per_unit: p.defaultJariPavuPerUnit,
    defaultJariPavuPerUnit: p.defaultJariPavuPerUnit,
    sku_code: p.skuCode,
    skuCode: p.skuCode,
    description: p.description,
    image_url: p.imageUrl,
    imageUrl: p.imageUrl,
    created_at: p.createdAt,
    updated_at: p.updatedAt
  };
}

export async function getProducts(req, res, next) {
  try {
    const products = await Product.find().sort({ productId: 1 }).lean();
    return res.status(200).json({
      success: true,
      data: products.map(formatProduct)
    });
  } catch (error) {
    next(error);
  }
}

export async function getNextNumber(req, res, next) {
  try {
    const nextProductNumber = await getNextProductNumber();
    return res.status(200).json({
      success: true,
      data: { nextProductNumber }
    });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    const {
      product_number, productNumber,
      product_name, productName,
      length_meters, lengthMeters,
      weaving_rate, weavingRate,
      default_jari_per_unit, defaultJariPerUnit,
      default_yarn_per_unit, defaultYarnPerUnit,
      default_color_yarn_per_unit, defaultColorYarnPerUnit,
      default_babin_per_unit, defaultBabinPerUnit,
      default_jari_babin_per_unit, defaultJariBabinPerUnit,
      default_color_babin_per_unit, defaultColorBabinPerUnit,
      default_pavu_per_unit, defaultPavuPerUnit,
      default_jari_pavu_per_unit, defaultJariPavuPerUnit,
      sku_code, skuCode,
      description,
      image_url, imageUrl
    } = req.body;

    const name = product_name || productName;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Product name is required"
        }
      });
    }

    const number = (product_number || productNumber || (await getNextProductNumber())).toUpperCase().trim();
    const existing = await Product.findOne({ productNumber: number });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: "CONFLICT",
          message: `Product number ${number} already exists`
        }
      });
    }

    const nextProductId = await getNextSequence("productId");

    const product = await Product.create({
      productId: nextProductId,
      productNumber: number,
      productName: name.trim(),
      lengthMeters: length_meters !== undefined ? Number(length_meters) : (lengthMeters !== undefined ? Number(lengthMeters) : 0),
      weavingRate: weaving_rate !== undefined ? Number(weaving_rate) : (weavingRate !== undefined ? Number(weavingRate) : 0),
      defaultJariPerUnit: default_jari_per_unit !== undefined ? Number(default_jari_per_unit) : (defaultJariPerUnit !== undefined ? Number(defaultJariPerUnit) : 0),
      defaultYarnPerUnit: default_yarn_per_unit !== undefined ? Number(default_yarn_per_unit) : (defaultYarnPerUnit !== undefined ? Number(defaultYarnPerUnit) : 0),
      defaultColorYarnPerUnit: default_color_yarn_per_unit !== undefined ? Number(default_color_yarn_per_unit) : (defaultColorYarnPerUnit !== undefined ? Number(defaultColorYarnPerUnit) : 0),
      defaultBabinPerUnit: default_babin_per_unit !== undefined ? Number(default_babin_per_unit) : (defaultBabinPerUnit !== undefined ? Number(defaultBabinPerUnit) : 0),
      defaultJariBabinPerUnit: default_jari_babin_per_unit !== undefined ? Number(default_jari_babin_per_unit) : (defaultJariBabinPerUnit !== undefined ? Number(defaultJariBabinPerUnit) : 0),
      defaultColorBabinPerUnit: default_color_babin_per_unit !== undefined ? Number(default_color_babin_per_unit) : (defaultColorBabinPerUnit !== undefined ? Number(defaultColorBabinPerUnit) : 0),
      defaultPavuPerUnit: default_pavu_per_unit !== undefined ? Number(default_pavu_per_unit) : (defaultPavuPerUnit !== undefined ? Number(defaultPavuPerUnit) : 0),
      defaultJariPavuPerUnit: default_jari_pavu_per_unit !== undefined ? Number(default_jari_pavu_per_unit) : (defaultJariPavuPerUnit !== undefined ? Number(defaultJariPavuPerUnit) : 0),
      skuCode: sku_code || skuCode || null,
      description: description || null,
      imageUrl: image_url || imageUrl || null
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: formatProduct(product)
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.productId = Number(id);
    } else {
      query.productNumber = id.toUpperCase();
    }

    const product = await Product.findOne(query).lean();
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Product not found" }
      });
    }

    return res.status(200).json({
      success: true,
      data: formatProduct(product)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.productId = Number(id);
    } else {
      query.productNumber = id.toUpperCase();
    }

    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Product not found" }
      });
    }

    const body = req.body;
    if (body.product_name || body.productName) product.productName = (body.product_name || body.productName).trim();
    if (body.product_number || body.productNumber) product.productNumber = (body.product_number || body.productNumber).trim().toUpperCase();
    if (body.length_meters !== undefined) product.lengthMeters = Number(body.length_meters);
    if (body.lengthMeters !== undefined) product.lengthMeters = Number(body.lengthMeters);
    if (body.weaving_rate !== undefined) product.weavingRate = Number(body.weaving_rate);
    if (body.weavingRate !== undefined) product.weavingRate = Number(body.weavingRate);
    if (body.default_jari_per_unit !== undefined) product.defaultJariPerUnit = Number(body.default_jari_per_unit);
    if (body.defaultJariPerUnit !== undefined) product.defaultJariPerUnit = Number(body.defaultJariPerUnit);
    if (body.default_yarn_per_unit !== undefined) product.defaultYarnPerUnit = Number(body.default_yarn_per_unit);
    if (body.defaultYarnPerUnit !== undefined) product.defaultYarnPerUnit = Number(body.defaultYarnPerUnit);
    if (body.default_color_yarn_per_unit !== undefined) product.defaultColorYarnPerUnit = Number(body.default_color_yarn_per_unit);
    if (body.defaultColorYarnPerUnit !== undefined) product.defaultColorYarnPerUnit = Number(body.defaultColorYarnPerUnit);
    if (body.default_babin_per_unit !== undefined) product.defaultBabinPerUnit = Number(body.default_babin_per_unit);
    if (body.defaultBabinPerUnit !== undefined) product.defaultBabinPerUnit = Number(body.defaultBabinPerUnit);
    if (body.default_jari_babin_per_unit !== undefined) product.defaultJariBabinPerUnit = Number(body.default_jari_babin_per_unit);
    if (body.defaultJariBabinPerUnit !== undefined) product.defaultJariBabinPerUnit = Number(body.defaultJariBabinPerUnit);
    if (body.default_color_babin_per_unit !== undefined) product.defaultColorBabinPerUnit = Number(body.default_color_babin_per_unit);
    if (body.defaultColorBabinPerUnit !== undefined) product.defaultColorBabinPerUnit = Number(body.defaultColorBabinPerUnit);
    if (body.default_pavu_per_unit !== undefined) product.defaultPavuPerUnit = Number(body.default_pavu_per_unit);
    if (body.defaultPavuPerUnit !== undefined) product.defaultPavuPerUnit = Number(body.defaultPavuPerUnit);
    if (body.default_jari_pavu_per_unit !== undefined) product.defaultJariPavuPerUnit = Number(body.default_jari_pavu_per_unit);
    if (body.defaultJariPavuPerUnit !== undefined) product.defaultJariPavuPerUnit = Number(body.defaultJariPavuPerUnit);
    if (body.sku_code !== undefined || body.skuCode !== undefined) product.skuCode = body.sku_code || body.skuCode || null;
    if (body.description !== undefined) product.description = body.description || null;
    if (body.image_url !== undefined || body.imageUrl !== undefined) product.imageUrl = body.image_url || body.imageUrl || null;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: formatProduct(product)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else if (!isNaN(Number(id))) {
      query.productId = Number(id);
    } else {
      query.productNumber = id.toUpperCase();
    }

    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Product not found" }
      });
    }

    const txCount = await Transaction.countDocuments({
      $or: [{ product: product._id }, { productId: product.productId }]
    });

    if (txCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CANNOT_DELETE_PRODUCT",
          message: `Cannot delete product '${product.productName}' as it is referenced in ${txCount} transaction(s)`
        }
      });
    }

    await Product.deleteOne({ _id: product._id });

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}
