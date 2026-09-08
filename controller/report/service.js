import { getStockOverviewReport, getBillData } from "../../services/calculationService.js";

export async function getStockOverview(req, res, next) {
  try {
    const data = await getStockOverviewReport();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getBillDataReport(req, res, next) {
  try {
    const { weaver_id, weaverId, date, dispatch_group_id, dispatchGroupId } = req.query;
    const targetWeaverId = weaver_id || weaverId;

    if (!targetWeaverId) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "weaver_id is required" }
      });
    }

    const data = await getBillData({
      weaverId: targetWeaverId,
      date: date || null,
      dispatchGroupId: dispatch_group_id || dispatchGroupId || null
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}
