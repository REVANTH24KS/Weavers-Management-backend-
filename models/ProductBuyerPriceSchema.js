import mongoose from "mongoose";

const productBuyerPriceSchema = new mongoose.Schema(
  {
    priceId: { type: Number, unique: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "Buyer", required: true },
    buyerId: { type: Number, required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productId: { type: Number, required: true, index: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: String, required: true },
    effectiveTo: { type: String, default: null }
  },
  { timestamps: true }
);

const ProductBuyerPrice = mongoose.models.ProductBuyerPrice || mongoose.model("ProductBuyerPrice", productBuyerPriceSchema);

export { ProductBuyerPrice };
