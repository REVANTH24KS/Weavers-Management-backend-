import { Weaver } from "../../models/WeaverSchema.js";
import { Transaction } from "../../models/TransactionSchema.js";
import {
  calculatePavuUsage,
  getWeaverAgingStatus,
  getWeaverUnpaidAmount
} from "../../services/calculationService.js";

export async function getDashboardOverview(req, res, next) {
  try {
    const selectedDate = req.query.date || new Date().toISOString().split("T")[0];

    const [allWeavers, activeWeaversCount, totalWeaversCount, pavuUsageList] = await Promise.all([
      Weaver.find().lean(),
      Weaver.countDocuments({ status: "active" }),
      Weaver.countDocuments(),
      calculatePavuUsage()
    ]);

    // Low Pavu Looms Count: Looms where remaining meters < 20 meters and not completed or is_over
    const lowPavuLoomsCount = pavuUsageList.filter(
      (p) => (p.remaining_meters < 20 && !p.is_completed) || p.is_over
    ).length;

    // Total Payable Amount across all weavers
    const allUnpaidTxns = await Transaction.find({
      transactionType: "production_consumption",
      isPaid: false
    }).lean();
    const totalPayableAmount = allUnpaidTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Aging weavers count and absent weavers list
    let agingWeaversCount = 0;
    const absentWeavers = [];

    for (const w of allWeavers) {
      const aging = await getWeaverAgingStatus(w.weaverId, selectedDate);
      if (aging.isAging) {
        agingWeaversCount++;
        absentWeavers.push({
          weaver_id: w.weaverId,
          weaver_code: w.weaverCode,
          weaver_name: w.weaverName,
          last_visit_date: aging.lastVisitDate,
          days_absent: aging.daysSinceLastProduction
        });
      }
    }

    // Sort absent weavers by most days absent
    absentWeavers.sort((a, b) => b.days_absent - a.days_absent);

    // Day Activity for selectedDate
    const dayTransactions = await Transaction.find({ entryDate: selectedDate })
      .populate("weaver")
      .lean();

    const activityByWeaver = {};
    for (const t of dayTransactions) {
      const wId = t.weaverId;
      if (!activityByWeaver[wId]) {
        activityByWeaver[wId] = {
          weaver_id: wId,
          weaver_code: t.weaver?.weaverCode || "",
          weaver_name: t.weaver?.weaverName || `Weaver #${wId}`,
          pieces_dispatched: 0,
          issued: { jari: 0, yarn: 0, color_yarn: 0 },
          returned: { jari: 0, yarn: 0, color_yarn: 0 },
          total_amount: 0,
          unpaid_amount: 0,
          transaction_count: 0
        };
      }

      const item = activityByWeaver[wId];
      item.transaction_count++;

      const qty = Number(t.quantity) || 0;

      if (t.transactionType === "material_issue") {
        if (item.issued[t.materialType] !== undefined) {
          item.issued[t.materialType] += qty;
        }
      } else if (t.transactionType === "material_return") {
        if (item.returned[t.materialType] !== undefined) {
          item.returned[t.materialType] += qty;
        }
      } else if (t.transactionType === "production_consumption") {
        item.pieces_dispatched += Number(t.quantityProduced) || 0;
        const rowAmt = Number(t.amount) || 0;
        item.total_amount += rowAmt;
        if (!t.isPaid) {
          item.unpaid_amount += rowAmt;
        }
      }
    }

    const dayActivity = Object.values(activityByWeaver);

    return res.status(200).json({
      success: true,
      data: {
        date: selectedDate,
        stats: {
          activeWeaversCount,
          totalWeaversCount,
          totalPayableAmount: Number(totalPayableAmount.toFixed(2)),
          agingWeaversCount,
          lowPavuLoomsCount
        },
        dayActivity,
        absentWeavers
      }
    });
  } catch (error) {
    next(error);
  }
}
