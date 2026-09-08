import mongoose from "mongoose";

const babinSchema = new mongoose.Schema(
  {
    babinId: { type: Number, unique: true, index: true },
    babinNumber: { type: String, required: true, trim: true },
    weaver: { type: mongoose.Schema.Types.ObjectId, ref: "Weaver", required: true, index: true },
    weaverId: { type: Number, required: true, index: true },
    loomNo: { type: Number, required: true, default: 1, min: 1 },
    babinType: { type: String, enum: ["normal", "jari", "color"], required: true, default: "normal" },
    colorName: { type: String, default: null, trim: true },
    lengthMeters: { type: Number, required: true, min: 0 },
    distributorName: { type: String, required: true, trim: true },
    purchaseDate: { type: String, required: true },
    notes: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

babinSchema.index({ weaverId: 1, loomNo: 1, babinType: 1 });
babinSchema.index({ purchaseDate: -1 });

const Babin = mongoose.models.Babin || mongoose.model("Babin", babinSchema);

export { Babin };
