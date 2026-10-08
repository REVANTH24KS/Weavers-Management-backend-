import mongoose from "mongoose";

const weaverSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    weaverId: { type: Number, unique: true, index: true },
    weaverCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    weaverName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    bankAccountNo: { type: String, required: true, trim: true },
    bankIfsc: { type: String, required: true, uppercase: true, trim: true },
    bankName: { type: String, default: null, trim: true },
    numberOfLooms: { type: Number, required: true, default: 1, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    assignedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
  },
  { timestamps: true }
);

weaverSchema.index({ status: 1 });
weaverSchema.index({ weaverName: "text", mobileNumber: "text" });

const Weaver = mongoose.models.Weaver || mongoose.model("Weaver", weaverSchema);

export { Weaver };
