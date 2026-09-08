import { Weaver } from "../models/WeaverSchema.js";
import { Product } from "../models/ProductSchema.js";
import { getNextSequence } from "../models/CounterSchema.js";

export async function getNextWeaverCode() {
  const weavers = await Weaver.find({}, { weaverCode: 1, weaverId: 1 }).lean();
  let maxNum = 0;
  for (const w of weavers) {
    if (w.weaverCode) {
      const match = w.weaverCode.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    if (w.weaverId && w.weaverId > maxNum) {
      maxNum = w.weaverId;
    }
  }
  const nextNum = maxNum + 1;
  return `WVR-${String(nextNum).padStart(4, "0")}`;
}

export async function getNextProductNumber() {
  const products = await Product.find({}, { productNumber: 1, productId: 1 }).lean();
  let maxNum = 0;
  for (const p of products) {
    if (p.productNumber) {
      const match = p.productNumber.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    if (p.productId && p.productId > maxNum) {
      maxNum = p.productId;
    }
  }
  const nextNum = maxNum + 1;
  return `P-${String(nextNum).padStart(4, "0")}`;
}

export { getNextSequence };
