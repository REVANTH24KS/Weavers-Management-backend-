import mongoose from "mongoose";

const materialRateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rateId: { type: Number, unique: true, index: true },
    materialType: { type: String, enum: ["jari", "yarn", "color_yarn", "babin"], required: true },
    ratePerUnit: { type: Number, required: true, min: 0.01 },
    effectiveFrom: { type: String, required: true },
    effectiveTo: { type: String, default: null }
  },
  { timestamps: true }
);

materialRateSchema.index({ materialType: 1, effectiveTo: 1 });
materialRateSchema.index({ effectiveFrom: -1 });

const MaterialRate = mongoose.models.MaterialRate || mongoose.model("MaterialRate", materialRateSchema);

export { MaterialRate };
