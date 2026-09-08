import mongoose from "mongoose";

const buyerSchema = new mongoose.Schema(
  {
    buyerId: { type: Number, unique: true, index: true },
    buyerName: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: null, trim: true },
    mobileNumber: { type: String, default: null, trim: true },
    address: { type: String, default: null, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

const Buyer = mongoose.models.Buyer || mongoose.model("Buyer", buyerSchema);

export { Buyer };
