import mongoose from "mongoose";

const loomSchema = new mongoose.Schema(
  {
    loomId: { type: Number, unique: true, index: true },
    loomNumber: { type: String, required: true, trim: true },
    weaver: { type: mongoose.Schema.Types.ObjectId, ref: "Weaver", required: true, index: true },
    weaverId: { type: Number, required: true, index: true },
    loomNo: { type: Number, required: true, default: 1, min: 1 },
    pavuType: { type: String, enum: ["normal", "jari"], required: true, default: "normal" },
    pavuElai: { type: String, default: null, trim: true },
    lengthMeters: { type: Number, required: true, min: 0 },
    distributorName: { type: String, required: true, trim: true },
    receivedDate: { type: String, required: true },
    notes: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

loomSchema.index({ weaverId: 1, loomNo: 1, pavuType: 1 });
loomSchema.index({ receivedDate: -1 });

const Loom = mongoose.models.Loom || mongoose.model("Loom", loomSchema);

export { Loom };
