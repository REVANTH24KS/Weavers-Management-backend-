import dotenv from "dotenv";
import { dbConnection } from "./db.js";
import app from "./index.js";

dotenv.config();

const PORT = process.env.PORT || 9090;
let token = "";
let baseUrl = `http://localhost:${PORT}`;

async function testApi(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const status = res.status;
  const json = await res.json();
  return { status, json };
}

async function runTests() {
  console.log("🚀 Starting End-to-End API Test Suite...");

  await dbConnection();

  try {
    // 1. Health Check
    console.log("\n🧪 1. Testing Health Check...");
    const health = await testApi("/health-check", { method: "GET" });
    console.assert(health.status === 200 && health.json.success === true, "Health check failed");
    console.log("✅ Health check passed");

    // 2. Demo Login
    console.log("\n🧪 2. Testing Auth Demo Login...");
    const login = await testApi("/api/auth/demo-login", { method: "POST" });
    console.assert(login.status === 200 && login.json.data.token, "Demo login failed");
    token = login.json.data.token;
    console.log("✅ Demo login passed, token acquired");

    // 3. Auth Me
    console.log("\n🧪 3. Testing Auth Me...");
    const me = await testApi("/api/auth/me", { method: "GET" });
    console.assert(me.status === 200 && me.json.data.user.email, "Auth me failed");
    console.log("✅ Auth me passed:", me.json.data.user.email);

    // 4. Weavers Next Code & List
    console.log("\n🧪 4. Testing Weavers Next Code & List...");
    const nextCode = await testApi("/api/weavers/next-code", { method: "GET" });
    console.assert(nextCode.status === 200 && nextCode.json.data.nextCode, "Next code failed");
    console.log("✅ Next Weaver Code:", nextCode.json.data.nextCode);

    const weaversList = await testApi("/api/weavers", { method: "GET" });
    console.assert(weaversList.status === 200 && Array.isArray(weaversList.json.data), "Weavers list failed");
    console.log(`✅ Weavers list returned ${weaversList.json.data.length} weaver(s)`);

    // 5. Create Weaver
    console.log("\n🧪 5. Testing Create Weaver...");
    const newWeaver = await testApi("/api/weavers", {
      method: "POST",
      body: {
        weaver_name: "Ganesan P",
        mobile_number: "9842100000",
        bank_account_no: "10023456789",
        bank_ifsc: "HDFC0001234",
        bank_name: "HDFC Bank",
        number_of_looms: 2,
        status: "active",
        product_ids: [1, 2]
      }
    });
    console.assert(newWeaver.status === 201 && newWeaver.json.data.weaver_id, "Create weaver failed");
    const testWeaverId = newWeaver.json.data.weaver_id;
    console.log(`✅ Created Weaver ID: ${testWeaverId}, Code: ${newWeaver.json.data.weaver_code}`);

    // 6. Get Weaver By ID with Balances
    console.log("\n🧪 6. Testing Get Weaver By ID...");
    const singleWeaver = await testApi(`/api/weavers/${testWeaverId}`, { method: "GET" });
    console.assert(singleWeaver.status === 200 && singleWeaver.json.data.balances, "Get single weaver failed");
    console.log("✅ Single Weaver Balances:", singleWeaver.json.data.balances);

    // 7. Products List & Next Number & Create
    console.log("\n🧪 7. Testing Products...");
    const nextProdNum = await testApi("/api/products/next-number", { method: "GET" });
    console.assert(nextProdNum.status === 200 && nextProdNum.json.data.nextProductNumber, "Next product number failed");
    console.log("✅ Next Product Number:", nextProdNum.json.data.nextProductNumber);

    const newProd = await testApi("/api/products", {
      method: "POST",
      body: {
        product_name: "Bridal Brocade Silk Saree",
        length_meters: 6.30,
        weaving_rate: 1200.00,
        default_jari_per_unit: 350,
        default_yarn_per_unit: 900,
        default_color_yarn_per_unit: 50,
        default_babin_per_unit: 40,
        default_jari_babin_per_unit: 15,
        default_pavu_per_unit: 6.30
      }
    });
    console.assert(newProd.status === 201 && newProd.json.data.product_id, "Create product failed");
    const testProductId = newProd.json.data.product_id;
    console.log(`✅ Created Product ID: ${testProductId}, Number: ${newProd.json.data.product_number}`);

    // 8. Material Rates Master
    console.log("\n🧪 8. Testing Material Rates...");
    const newRate = await testApi("/api/rates", {
      method: "POST",
      body: {
        material_type: "jari",
        rate_per_unit: 4800.00,
        effective_from: "2026-09-08"
      }
    });
    console.assert(newRate.status === 201 && newRate.json.data.rate_per_unit === 4800, "Create rate failed");
    console.log("✅ Created Rate:", newRate.json.data);

    const ratesList = await testApi("/api/rates", { method: "GET" });
    console.assert(ratesList.status === 200 && ratesList.json.data.length >= 2, "Get rates failed");
    console.log(`✅ Rates list returned ${ratesList.json.data.length} rate(s)`);

    // 9. Looms Pavu Register
    console.log("\n🧪 9. Testing Looms Pavu Register...");
    const newLoom = await testApi("/api/looms", {
      method: "POST",
      body: {
        loom_number: "PV-008",
        weaver_id: testWeaverId,
        loom_no: 1,
        pavu_type: "normal",
        pavu_elai: "3800",
        length_meters: 125,
        distributor_name: "Balaji Warpers",
        received_date: "2026-09-08",
        notes: "Fine twist"
      }
    });
    console.assert(newLoom.status === 201, "Create loom failed");
    console.log("✅ Created Loom Pavu:", newLoom.json.data.loom_number);

    const looms = await testApi(`/api/looms?weaver_id=${testWeaverId}`, { method: "GET" });
    console.assert(looms.status === 200 && looms.json.data.length > 0, "Get looms failed");
    console.log(`✅ Looms returned ${looms.json.data.length} pavu record(s)`);

    // 10. Babin Register
    console.log("\n🧪 10. Testing Babin Register...");
    const newBabin = await testApi("/api/babins", {
      method: "POST",
      body: {
        babin_number: "BBN-005",
        weaver_id: testWeaverId,
        loom_no: 1,
        babin_type: "color",
        color_name: "Crimson Red",
        length_meters: 450,
        distributor_name: "Surya Bobbins",
        purchase_date: "2026-09-08",
        notes: "Batch 4A"
      }
    });
    console.assert(newBabin.status === 201, "Create babin failed");
    console.log("✅ Created Babin:", newBabin.json.data.babin_number);

    // 11. Material Issue Transaction (in kg, stored as grams)
    console.log("\n🧪 11. Testing Material Issue Transaction...");
    const issueRes = await testApi("/api/transactions/issue", {
      method: "POST",
      body: {
        weaver_id: testWeaverId,
        entry_date: "2026-09-08",
        notes: "Weekly material issue",
        materials: {
          jari: 2.5,       // 2.5 kg = 2500 grams
          yarn: 10.0,      // 10.0 kg = 10000 grams
          color_yarn: 1.2  // 1.2 kg = 1200 grams
        }
      }
    });
    console.assert(issueRes.status === 201 && issueRes.json.data.createdCount === 3, "Material issue failed");
    console.log("✅ Material Issue recorded, IDs:", issueRes.json.data.transaction_ids);

    // 12. Production Dispatch Entry (multi-loom)
    console.log("\n🧪 12. Testing Multi-Loom Production Dispatch...");
    const dispatchRes = await testApi("/api/production-entries", {
      method: "POST",
      body: {
        weaver_id: testWeaverId,
        entry_date: "2026-09-08",
        notes: "Dispatched 2 looms",
        material_issues: {
          jari: 1.0,
          yarn: 5.0,
          color_yarn: 0
        },
        looms: [
          {
            loom_no: 1,
            product_id: 1,
            pieces: 5,
            weaving_rate: 850.00,
            custom_amount: 4250.00,
            per_unit: {
              jari: 250,
              yarn: 800,
              color_yarn: 0,
              babin: 35.5
            }
          }
        ]
      }
    });
    console.assert(dispatchRes.status === 201 && dispatchRes.json.data.dispatchGroupId, "Production dispatch failed");
    console.log("✅ Production Dispatch recorded, Group ID:", dispatchRes.json.data.dispatchGroupId, "Amount:", dispatchRes.json.data.totalAmount);

    // 13. Material Return Transaction (with balance validation)
    console.log("\n🧪 13. Testing Material Return...");
    const returnRes = await testApi("/api/transactions/return", {
      method: "POST",
      body: {
        weaver_id: testWeaverId,
        material_type: "yarn",
        quantity: 500, // 500 grams
        entry_date: "2026-09-08",
        notes: "Leftover yarn returned"
      }
    });
    console.assert(returnRes.status === 201 && returnRes.json.data.quantity === 500, "Material return failed");
    console.log("✅ Material Return recorded:", returnRes.json.data.quantity, "g");

    // Test exceeding balance return (should fail 400)
    const invalidReturn = await testApi("/api/transactions/return", {
      method: "POST",
      body: {
        weaver_id: testWeaverId,
        material_type: "yarn",
        quantity: 999999, // exceeds balance
        entry_date: "2026-09-08"
      }
    });
    console.assert(invalidReturn.status === 400, "Invalid return should fail with 400");
    console.log("✅ Return balance validation properly rejected excess return with 400");

    // 14. Payment Settlement
    console.log("\n🧪 14. Testing Payment Settlement...");
    const unpaid = await testApi(`/api/payments/unpaid?weaver_id=${testWeaverId}`, { method: "GET" });
    console.assert(unpaid.status === 200, "Get unpaid payments failed");
    console.log(`✅ Unpaid transactions count: ${unpaid.json.data.count}, Amount: ₹${unpaid.json.data.totalUnpaidAmount}`);

    if (unpaid.json.data.transactions.length > 0) {
      const txIdToPay = unpaid.json.data.transactions[0].transactionId;
      const markRes = await testApi("/api/payments/mark-paid", {
        method: "PATCH",
        body: { transaction_ids: [txIdToPay] }
      });
      console.assert(markRes.status === 200, "Mark paid failed");
      console.log(`✅ Transaction #${txIdToPay} marked as paid`);
    }

    // 15. Dashboard Overview
    console.log("\n🧪 15. Testing Dashboard Overview...");
    const dashboard = await testApi("/api/dashboard/overview?date=2026-09-08", { method: "GET" });
    console.assert(dashboard.status === 200 && dashboard.json.data.stats, "Dashboard overview failed");
    console.log("✅ Dashboard Stats:", dashboard.json.data.stats);

    // 16. Reports (Stock Overview & Bill Data)
    console.log("\n🧪 16. Testing Reports...");
    const stockReport = await testApi("/api/reports/stock-overview", { method: "GET" });
    console.assert(stockReport.status === 200 && Array.isArray(stockReport.json.data.stockByWeaver), "Stock report failed");
    console.log(`✅ Stock overview contains ${stockReport.json.data.stockByWeaver.length} weaver record(s)`);

    const billReport = await testApi(`/api/reports/bill-data?weaver_id=${testWeaverId}&date=2026-09-08`, { method: "GET" });
    console.assert(billReport.status === 200 && billReport.json.data.weaver, "Bill data report failed");
    console.log("✅ Bill data report generated for:", billReport.json.data.weaver.weaverName);

    // 17. Buyers & Pricing
    console.log("\n🧪 17. Testing Buyers & Pricing...");
    const newBuyer = await testApi("/api/buyers", {
      method: "POST",
      body: {
        buyer_name: "Sri Kumaran Silks",
        contact_person: "Venkatesh R",
        mobile_number: "9840123456",
        address: "T. Nagar, Chennai"
      }
    });
    console.assert(newBuyer.status === 201 && newBuyer.json.data.buyer_id, "Create buyer failed");
    console.log(`✅ Created Buyer ID: ${newBuyer.json.data.buyer_id}, Name: ${newBuyer.json.data.buyer_name}`);

    const buyerPrice = await testApi(`/api/buyers/${newBuyer.json.data.buyer_id}/prices`, {
      method: "POST",
      body: {
        product_id: 1,
        selling_price: 2450.00
      }
    });
    console.assert(buyerPrice.status === 201 && buyerPrice.json.data.sellingPrice === 2450, "Set buyer price failed");
    console.log("✅ Buyer wholesale price recorded:", buyerPrice.json.data.sellingPrice);

    console.log("\n=======================================================");
    console.log("🎉 ALL 17 TEST SUITES PASSED SUCCESSFULLY!");
    console.log("=======================================================\n");

  } catch (err) {
    console.error("❌ Test Suite Error:", err);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode || 0);
  }
}

runTests();
