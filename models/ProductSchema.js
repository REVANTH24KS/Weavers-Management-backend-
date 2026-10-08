import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Number, unique: true, index: true },
    productNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    productName: { type: String, required: true, trim: true },
    lengthMeters: { type: Number, required: true, default: 0, min: 0 },
    weavingRate: { type: Number, required: true, default: 0, min: 0 },
    defaultJariPerUnit: { type: Number, default: 0, min: 0 },
    defaultYarnPerUnit: { type: Number, default: 0, min: 0 },
    defaultColorYarnPerUnit: { type: Number, default: 0, min: 0 },
    defaultBabinPerUnit: { type: Number, default: 0, min: 0 },
    defaultJariBabinPerUnit: { type: Number, default: 0, min: 0 },
    defaultColorBabinPerUnit: { type: Number, default: 0, min: 0 },
    defaultPavuPerUnit: { type: Number, default: 0, min: 0 },
    defaultJariPavuPerUnit: { type: Number, default: 0, min: 0 },
    skuCode: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
    imageUrl: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

productSchema.index({ productName: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

export { Product };
