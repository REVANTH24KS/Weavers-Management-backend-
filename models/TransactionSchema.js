import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transactionId: { type: Number, unique: true, index: true },
    dispatchGroupId: { type: String, index: true, default: null },
    weaver: { type: mongoose.Schema.Types.ObjectId, ref: "Weaver", required: true, index: true },
    weaverId: { type: Number, required: true, index: true },
    
    transactionType: {
      type: String,
      enum: ["material_issue", "production_consumption", "material_return"],
      required: true,
      index: true
    },
    materialType: {
      type: String,
      enum: ["jari", "yarn", "babin", "color_yarn"],
      required: true,
      index: true
    },
    
    quantity: { type: Number, required: true, min: 0 },
    
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    productId: { type: Number, default: null, index: true },
    quantityProduced: { type: Number, default: null },
    loomNo: { type: Number, default: null },
    loomId: { type: Number, default: null },
    
    rateApplied: { type: Number, default: null },
    amount: { type: Number, default: null },
    isPaid: { type: Boolean, default: false, index: true },
    
    entryDate: { type: String, required: true, index: true },
    notes: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

transactionSchema.index({ weaverId: 1, entryDate: -1 });
transactionSchema.index({ weaverId: 1, transactionType: 1, materialType: 1 });
transactionSchema.index({ isPaid: 1, transactionType: 1 });

const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);

export { Transaction };
