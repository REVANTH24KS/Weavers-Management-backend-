# Weaver & Loom Ledger — Backend Architecture, Database Schema & API Specification (Node.js + MongoDB)

This document is the complete, single-source-of-truth specification for building the entire backend for the **Weaver & Loom Ledger (Weaver & Stock Manager)** application using **Node.js (Express / Fastify)** and **MongoDB (Mongoose)**.

---

## Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Project Structure & Technology Stack](#2-project-structure--technology-stack)
3. [Environment Configuration](#3-environment-configuration)
4. [MongoDB Data Schemas (Mongoose Models)](#4-mongodb-data-schemas-mongoose-models)
   - 4.1 [User / Auth Model (`users`)](#41-user-auth-model-users)
   - 4.2 [Weaver Master Model (`weavers`)](#42-weaver-master-model-weavers)
   - 4.3 [Product Master Model (`products`)](#43-product-master-model-products)
   - 4.4 [Loom / Pavu Master Model (`looms`)](#44-loom--pavu-master-model-looms)
   - 4.5 [Babin Master Model (`babins`)](#45-babin-master-model-babins)
   - 4.6 [Material Rate Master Model (`material_rates`)](#46-material-rate-master-model-material_rates)
   - 4.7 [Weaver Material Transaction Model (`transactions`)](#47-weaver-material-transaction-model-transactions)
   - 4.8 [Buyer Master Model (`buyers`) & Product Buyer Price (`product_buyer_prices`)](#48-buyer-master-model-buyers--product-buyer-prices)
5. [Core Business Logic & Calculation Engine](#5-core-business-logic--calculation-engine)
   - 5.1 [Material Balance Calculation](#51-material-balance-calculation)
   - 5.2 [Pavu Usage & Remaining Meters Algorithm](#52-pavu-usage--remaining-meters-algorithm)
   - 5.3 [Babin Usage & Remaining Meters Algorithm](#53-babin-usage--remaining-meters-algorithm)
   - 5.4 [Material Rate Versioning](#54-material-rate-versioning)
   - 5.5 [Auto-Increment Code Generators](#55-auto-increment-code-generators)
   - 5.6 [Multi-Loom Dispatch Bundling & Atomicity](#56-multi-loom-dispatch-bundling--atomicity)
6. [API Endpoints Specification](#6-api-endpoints-specification)
   - 6.1 [Authentication (`/api/auth`)](#61-authentication-apiauth)
   - 6.2 [Weavers (`/api/weavers`)](#62-weavers-apiweavers)
   - 6.3 [Products (`/api/products`)](#63-products-apiproducts)
   - 6.4 [Looms / Pavu Register (`/api/looms`)](#64-looms--pavu-register-apilooms)
   - 6.5 [Babin Register (`/api/babins`)](#65-babin-register-apibabins)
   - 6.6 [Material Rates (`/api/rates`)](#66-material-rates-apirates)
   - 6.7 [Material Issue Transactions (`/api/transactions/issue`)](#67-material-issue-transactions-apitransactionsissue)
   - 6.8 [Material Return Transactions (`/api/transactions/return`)](#68-material-return-transactions-apitransactionsreturn)
   - 6.9 [Production Dispatch & Entries (`/api/production-entries`)](#69-production-dispatch--entries-apiproduction-entries)
   - 6.10 [Payment Settlement (`/api/payments`)](#610-payment-settlement-apipayments)
   - 6.11 [Dashboard & Analytics (`/api/dashboard`)](#611-dashboard--analytics-apidashboard)
   - 6.12 [Reports & Stock Overview (`/api/reports`)](#612-reports--stock-overview-apireports)
7. [Standardized Error & Response Format](#7-standardized-error--response-format)
8. [Seed Data & Initialization](#8-seed-data--initialization)

---

## 1. System Overview & Architecture

**Weaver & Loom Ledger** is a specialized ERP and inventory management platform designed for handloom and textile manufacturing enterprises. The system tracks:
- **Raw Material Movements by Weight (Grams / Kilograms)**: Jari, Yarn, and Colour Yarn.
- **Length-Based Materials (Meters)**:
  - **Pavu (Warp Beam)**: Loaded onto looms with specific strand counts (*elai*) and categorized into *Normal Pavu* or *Jari Pavu*.
  - **Babin (Weft / Bobbin)**: Categorized into *Normal*, *Jari*, or *Colour* with specific shade names.
- **Weaver Operations**: Weavers manage 1 to N looms, receive raw materials, weave finished goods (e.g. Silk Sarees, Dhotis, Shawls), return unused material, and receive piece-rate wages.
- **Production Entries (Dispatches)**: Multi-loom dispatches capturing finished pieces produced, automatic Bill-of-Materials (BOM) deduction, custom per-unit adjustments, wage calculations, and remaining warp/weft balance tracking.
- **Financial Ledger**: Tracking unpaid wages, marking dispatches as paid, and generating printable PDF bills.

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT (Frontend)                                |
|  - Dashboard      - Weavers Ledger    - Looms (Pavu) Register   - Babin Register   |
|  - Material Issue - Production Entry  - Product Catalog         - Rates Master     |
+-----------------------------------------+-----------------------------------------+
                                          | JSON REST API / JWT
                                          v
+-----------------------------------------------------------------------------------+
|                             NODE.JS REST API (Express / Fastify)                  |
|  [Auth Middleware] [Validator Middleware] [Calculation Engine] [Error Handler]    |
+-----------------------------------------+-----------------------------------------+
                                          | Mongoose ODM
                                          v
+-----------------------------------------------------------------------------------+
|                                  MONGODB DATABASE                                 |
|  - users              - weavers          - products             - looms           |
|  - babins             - material_rates   - transactions         - buyers          |
+-----------------------------------------------------------------------------------+
```

---

## 2. Project Structure & Technology Stack

### Recommended Stack
- **Runtime**: Node.js (>= v20 LTS)
- **Framework**: Express.js or Fastify
- **Database**: MongoDB (>= v6.0) with Mongoose (>= v8.0)
- **Authentication**: JWT (`jsonwebtoken`) + Password Hashing (`bcryptjs` or `argon2`)
- **Validation**: `zod` or `joi`
- **CORS & Security**: `cors`, `helmet`, `express-rate-limit`

### Directory Layout
```
backend/
├── src/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection setup
│   │   └── env.js                # Environment variable validations
│   ├── constants/
│   │   └── enums.js              # Material types, transaction types, statuses
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── weaverController.js
│   │   ├── productController.js
│   │   ├── loomController.js
│   │   ├── babinController.js
│   │   ├── rateController.js
│   │   ├── transactionController.js
│   │   ├── productionController.js
│   │   ├── paymentController.js
│   │   ├── dashboardController.js
│   │   └── reportController.js
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT verification & role gate
│   │   ├── validateMiddleware.js # Schema validation
│   │   └── errorHandler.js       # Central error catching
│   ├── models/
│   │   ├── User.js
│   │   ├── Weaver.js
│   │   ├── Product.js
│   │   ├── Loom.js
│   │   ├── Babin.js
│   │   ├── MaterialRate.js
│   │   ├── Transaction.js
│   │   ├── Buyer.js
│   │   └── ProductBuyerPrice.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── weaverRoutes.js
│   │   ├── productRoutes.js
│   │   ├── loomRoutes.js
│   │   ├── babinRoutes.js
│   │   ├── rateRoutes.js
│   │   ├── transactionRoutes.js
│   │   ├── productionRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── dashboardRoutes.js
│   │   └── reportRoutes.js
│   ├── services/
│   │   ├── calculationService.js # Pavu / Babin / Stock balances
│   │   └── codeGeneratorService.js # Auto-increment WVR-XXXX, P-XXXX
│   ├── app.js                    # Express app configuration
│   └── server.js                 # HTTP server bootstrap
├── .env.example
├── package.json
└── README.md
```

---

## 3. Environment Configuration

### `.env` Variables
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/weaver_loom_ledger
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
DEMO_EMAIL=demo@weaverstock.app
DEMO_PASSWORD=demo-weaver-2026
```

---

## 4. MongoDB Data Schemas (Mongoose Models)

### Enums Used Across the Database
```javascript
const ENUMS = {
  MATERIAL_TYPES: ["jari", "yarn", "babin", "color_yarn"],
  ISSUABLE_MATERIALS: ["jari", "yarn", "color_yarn"],
  TRANSACTION_TYPES: ["material_issue", "production_consumption", "material_return"],
  WEAVER_STATUS: ["active", "inactive"],
  BUYER_STATUS: ["active", "inactive"],
  PAVU_TYPES: ["jari", "normal"],
  BABIN_TYPES: ["normal", "jari", "color"],
  USER_ROLES: ["admin", "staff"]
};
```

---

### 4.1 User / Auth Model (`users`)
Used for staff and admin access to the ledger system.

```javascript
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // hashed with bcrypt
    role: { type: String, enum: ["admin", "staff"], default: "staff" },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
```

---

### 4.2 Weaver Master Model (`weavers`)
Represents the artisan/weaver who operates looms and receives material.

```javascript
const weaverSchema = new mongoose.Schema(
  {
    weaverId: { type: Number, unique: true, index: true }, // Incremental ID (1, 2, 3...)
    weaverCode: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "WVR-0001"
    weaverName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    bankAccountNo: { type: String, required: true, trim: true },
    bankIfsc: { type: String, required: true, uppercase: true, trim: true },
    bankName: { type: String, default: null, trim: true },
    numberOfLooms: { type: Number, required: true, default: 1, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    
    // Array of Product IDs assigned to this weaver (replaces relational weaver_product_map)
    assignedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
  },
  { timestamps: true }
);

weaverSchema.index({ weaverCode: 1 });
weaverSchema.index({ status: 1 });
weaverSchema.index({ weaverName: "text", mobileNumber: "text" });
```

---

### 4.3 Product Master Model (`products`)
Defines the specifications, standard piece length, piece-rate weaving wage, and Bill-of-Materials (BOM) per piece.

```javascript
const productSchema = new mongoose.Schema(
  {
    productId: { type: Number, unique: true, index: true }, // Incremental ID (1, 2, 3...)
    productNumber: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "P-0001"
    productName: { type: String, required: true, trim: true },
    lengthMeters: { type: Number, required: true, default: 0, min: 0 }, // Saree/cloth length in meters (e.g. 6.25)
    weavingRate: { type: Number, required: true, default: 0, min: 0 }, // Labor wage rate in INR per piece (e.g. 850)
    
    // BOM requirements per piece (grams for yarn/jari/color_yarn; meters for pavu/babin)
    defaultJariPerUnit: { type: Number, default: 0, min: 0 },       // grams per piece
    defaultYarnPerUnit: { type: Number, default: 0, min: 0 },       // grams per piece
    defaultColorYarnPerUnit: { type: Number, default: 0, min: 0 },  // grams per piece
    
    defaultBabinPerUnit: { type: Number, default: 0, min: 0 },      // normal babin meters per piece
    defaultJariBabinPerUnit: { type: Number, default: 0, min: 0 },  // jari babin meters per piece
    defaultColorBabinPerUnit: { type: Number, default: 0, min: 0 }, // color babin meters per piece
    
    defaultPavuPerUnit: { type: Number, default: 0, min: 0 },      // normal pavu warp meters per piece
    defaultJariPavuPerUnit: { type: Number, default: 0, min: 0 },  // jari pavu warp meters per piece
    
    skuCode: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
    imageUrl: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

productSchema.index({ productNumber: 1 });
productSchema.index({ productName: 1 });
```

---

### 4.4 Loom / Pavu Master Model (`looms`)
Tracks warp beams (*Pavu*) loaded onto a specific loom for a weaver.

```javascript
const loomSchema = new mongoose.Schema(
  {
    loomId: { type: Number, unique: true, index: true }, // Incremental ID
    loomNumber: { type: String, required: true, trim: true }, // e.g. "PV-101" / Pavu identifier
    weaver: { type: mongoose.Schema.Types.ObjectId, ref: "Weaver", required: true, index: true },
    weaverId: { type: Number, required: true, index: true }, // Numerical reference
    loomNo: { type: Number, required: true, default: 1, min: 1 }, // Loom sequence # for weaver (1, 2, 3...)
    pavuType: { type: String, enum: ["normal", "jari"], required: true, default: "normal" },
    pavuElai: { type: String, default: null, trim: true }, // e.g. "3600 elai" (warp strands)
    lengthMeters: { type: Number, required: true, min: 0 }, // Total warp length in meters (e.g. 120.00)
    distributorName: { type: String, required: true, trim: true }, // Supplier / Warner
    receivedDate: { type: String, required: true }, // ISO date "YYYY-MM-DD"
    notes: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

loomSchema.index({ weaverId: 1, loomNo: 1, pavuType: 1 });
loomSchema.index({ receivedDate: -1 });
```

---

### 4.5 Babin Master Model (`babins`)
Tracks purchased weft spools/bobbins (*Babin*) measured in meters, allocated to weavers and looms.

```javascript
const babinSchema = new mongoose.Schema(
  {
    babinId: { type: Number, unique: true, index: true }, // Incremental ID
    babinNumber: { type: String, required: true, trim: true }, // e.g. "BBN-202"
    weaver: { type: mongoose.Schema.Types.ObjectId, ref: "Weaver", required: true, index: true },
    weaverId: { type: Number, required: true, index: true },
    loomNo: { type: Number, required: true, default: 1, min: 1 },
    babinType: { type: String, enum: ["normal", "jari", "color"], required: true, default: "normal" },
    colorName: { type: String, default: null, trim: true }, // e.g. "Maroon", "Gold", "Royal Blue"
    lengthMeters: { type: Number, required: true, min: 0 }, // Length in meters (e.g. 500.00)
    distributorName: { type: String, required: true, trim: true },
    purchaseDate: { type: String, required: true }, // ISO date "YYYY-MM-DD"
    notes: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

babinSchema.index({ weaverId: 1, loomNo: 1, babinType: 1 });
babinSchema.index({ purchaseDate: -1 });
```

---

### 4.6 Material Rate Master Model (`material_rates`)
Tracks current and historical prices per unit for valuation. When a new rate is inserted with `effectiveTo: null`, any existing open rate for that material type is closed automatically with `effectiveTo = effectiveFrom`.

```javascript
const materialRateSchema = new mongoose.Schema(
  {
    rateId: { type: Number, unique: true, index: true },
    materialType: { type: String, enum: ["jari", "yarn", "color_yarn", "babin"], required: true },
    ratePerUnit: { type: Number, required: true, min: 0.01 }, // e.g. 4650.00 for Jari, 415.00 for Yarn
    effectiveFrom: { type: String, required: true }, // "YYYY-MM-DD"
    effectiveTo: { type: String, default: null }    // "YYYY-MM-DD" or null if currently active
  },
  { timestamps: true }
);

materialRateSchema.index({ materialType: 1, effectiveTo: 1 });
materialRateSchema.index({ effectiveFrom: -1 });
```

---

### 4.7 Weaver Material Transaction Model (`transactions`)
The central double-entry ledger recording:
1. `material_issue`: Issuing raw material (by weight in grams) to the weaver.
2. `production_consumption`: Finished goods produced; records quantity of pieces, material consumed (grams/meters), calculated labor wage (`amount`), and payment status (`isPaid`).
3. `material_return`: Return of unused raw materials from the weaver.

```javascript
const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: Number, unique: true, index: true }, // Incremental ID
    dispatchGroupId: { type: String, index: true, default: null }, // UUID/Timestamp string grouping multi-material rows of a single dispatch
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
    
    quantity: { type: Number, required: true, min: 0 }, // Weight in grams (jari, yarn, color_yarn) or length in meters (babin)
    
    // Fields specific to production_consumption
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    productId: { type: Number, default: null, index: true },
    quantityProduced: { type: Number, default: null }, // Pieces produced (e.g. 4)
    loomNo: { type: Number, default: null },           // Loom # (1, 2, 3...)
    loomId: { type: Number, default: null },           // Optional Pavu ID reference
    
    rateApplied: { type: Number, default: null },      // Material rate or weaving rate snapshot
    amount: { type: Number, default: null },           // Total INR wage for this production row (recorded on first material line of the loom)
    isPaid: { type: Boolean, default: false, index: true }, // Payment settlement flag
    
    entryDate: { type: String, required: true, index: true }, // ISO date "YYYY-MM-DD"
    notes: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

transactionSchema.index({ weaverId: 1, entryDate: -1 });
transactionSchema.index({ weaverId: 1, transactionType: 1, materialType: 1 });
transactionSchema.index({ isPaid: 1, transactionType: 1 });
```

---

### 4.8 Buyer Master Model (`buyers`) & Product Buyer Price (`product_buyer_prices`)
For wholesale buyer records and catalog selling prices.

```javascript
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

const productBuyerPriceSchema = new mongoose.Schema(
  {
    priceId: { type: Number, unique: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "Buyer", required: true },
    buyerId: { type: Number, required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productId: { type: Number, required: true, index: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: String, required: true },
    effectiveTo: { type: String, default: null }
  },
  { timestamps: true }
);
```

---

## 5. Core Business Logic & Calculation Engine

These calculations MUST be replicated accurately in your backend service layer (`calculationService.js`):

### 5.1 Material Balance Calculation
For weight-based materials (`jari`, `yarn`, `color_yarn`) and babin:

$$\text{Issued} = \sum \text{quantity where } \text{type} = \text{"material\_issue"}$$
$$\text{Consumed} = \sum \text{quantity where } \text{type} = \text{"production\_consumption"}$$
$$\text{Returned} = \sum \text{quantity where } \text{type} = \text{"material\_return"}$$
$$\text{Current Balance} = \text{Issued} - \text{Consumed} - \text{Returned}$$

**Validation Rule**: When recording a `material_return`, the returned quantity must not exceed the weaver's available material balance:
$$\text{Return Quantity} \le \text{Current Balance} + 10^{-9}$$

---

### 5.2 Pavu Usage & Remaining Meters Algorithm
Warp beams (*Pavu*) are issued with a fixed length (e.g. 120m). Production consumption uses warp meters based on:
- Product Normal Pavu Per Unit: `product.defaultPavuPerUnit || product.lengthMeters`
- Product Jari Pavu Per Unit: `product.defaultJariPavuPerUnit || 0`

**FIFO Allocation per Weaver & Loom Number**:
1. Group looms by `weaverId` and `loomNo`.
2. Sum all produced pieces per pavu type (`normal` vs `jari`) for that specific loom.
3. Sort the weaver's pavu records in ascending order of `receivedDate` (FIFO).
4. Deduct consumed meters from each pavu in sequence until its length is exhausted (`remaining = 0, isCompleted = true`).
5. If consumption exceeds all available pavu length, the last pavu reflects negative remaining meters (`isOver = true, isCompleted = true`).

---

### 5.3 Babin Usage & Remaining Meters Algorithm
Similar to Pavu, Babin is tracked in meters.
1. Babins are categorized into `normal`, `jari`, and `color`.
2. Deduct production usage per type in FIFO order of `purchaseDate`.
3. If any type runs out of spools, overflow deducts from unallocated babins for that loom.

---

### 5.4 Material Rate Versioning
When creating a new rate (`POST /api/rates`):
```javascript
async function insertMaterialRate({ materialType, ratePerUnit, effectiveFrom }) {
  // 1. Close out currently open rate for this material type
  await MaterialRate.updateMany(
    { materialType, effectiveTo: null },
    { $set: { effectiveTo: effectiveFrom } }
  );

  // 2. Insert new active rate
  const newRate = await MaterialRate.create({
    materialType,
    ratePerUnit,
    effectiveFrom,
    effectiveTo: null
  });

  return newRate;
}
```

---

### 5.5 Auto-Increment Code Generators
For clean sequential identifiers:
- **Weaver Code**: `WVR-0001`, `WVR-0002`...
  ```javascript
  async function getNextWeaverCode() {
    const last = await Weaver.findOne({}, { weaverCode: 1 }).sort({ weaverId: -1 });
    const num = last ? parseInt(last.weaverCode.replace(/\D/g, ""), 10) + 1 : 1;
    return `WVR-${String(num).padStart(4, "0")}`;
  }
  ```
- **Product Number**: `P-0001`, `P-0002`...
  ```javascript
  async function getNextProductNumber() {
    const last = await Product.findOne({}, { productNumber: 1 }).sort({ productId: -1 });
    const num = last ? parseInt(last.productNumber.replace(/\D/g, ""), 10) + 1 : 1;
    return `P-${String(num).padStart(4, "0")}`;
  }
  ```

---

### 5.6 Multi-Loom Dispatch Bundling & Atomicity
When a weaver brings finished goods for multiple looms in a single visit:
1. Material issue (if given simultaneously) creates `material_issue` rows.
2. For each loom:
   - Calculate material consumption for each required material (`jari`, `yarn`, `color_yarn`, `babin`).
   - The labor amount ($\text{Pieces} \times \text{Weaving Rate}$ or custom override) is assigned to the **first** material row of that loom; subsequent material rows for the same loom carry `amount: 0` to prevent duplicate payment totals.
3. All rows share a common `dispatchGroupId` (or identical `entryDate` + `createdAt` timestamp) so they can be viewed, edited, or deleted as a single atomic unit.

---

## 6. API Endpoints Specification

All protected endpoints require the Authorization header: `Authorization: Bearer <jwt_token>`.

---

### 6.1 Authentication (`/api/auth`)

#### `POST /api/auth/register`
Create a new staff or admin user.
- **Request Body**:
  ```json
  {
    "name": "Rajesh Admin",
    "email": "admin@weaverstock.app",
    "password": "Password123!",
    "role": "admin"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "_id": "66dd8f12a34b...",
        "name": "Rajesh Admin",
        "email": "admin@weaverstock.app",
        "role": "admin"
      },
      "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
  }
  ```

#### `POST /api/auth/login`
User login.
- **Request Body**:
  ```json
  {
    "email": "admin@weaverstock.app",
    "password": "Password123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "_id": "66dd8f12a34b...",
        "name": "Rajesh Admin",
        "email": "admin@weaverstock.app",
        "role": "admin"
      },
      "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
  }
  ```

#### `POST /api/auth/demo-login`
Quick one-click login for demonstration accounts.
- **Request Body**: `{}`
- **Success Response (200 OK)**: Logs in as the pre-configured demo user (`demo@weaverstock.app`).

#### `GET /api/auth/me`
Get current logged-in user profile.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "_id": "66dd8f12a34b...",
        "name": "Rajesh Admin",
        "email": "admin@weaverstock.app",
        "role": "admin"
      }
    }
  }
  ```

---

### 6.2 Weavers (`/api/weavers`)

#### `GET /api/weavers`
List all weavers with their assigned product IDs.
- **Query Parameters**:
  - `status` (optional): `"active"` | `"inactive"`
  - `search` (optional): search by name, code, or mobile
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "66dd9010...",
        "weaver_id": 1,
        "weaver_code": "WVR-0001",
        "weaver_name": "Murugan Subramani",
        "mobile_number": "9842015673",
        "bank_account_no": "30124578901",
        "bank_ifsc": "SBIN0001234",
        "bank_name": "State Bank of India",
        "number_of_looms": 3,
        "status": "active",
        "assigned_product_ids": [1, 3],
        "created_at": "2026-08-13T11:58:57.000Z",
        "updated_at": "2026-08-13T11:58:57.000Z"
      }
    ]
  }
  ```

#### `GET /api/weavers/next-code`
Generate next sequential weaver code (`WVR-XXXX`).
- **Success Response (200 OK)**:
  ```json
  { "success": true, "data": { "nextCode": "WVR-0005" } }
  ```

#### `POST /api/weavers`
Create a new weaver.
- **Request Body**:
  ```json
  {
    "weaver_code": "WVR-0005",
    "weaver_name": "Ganesan P",
    "mobile_number": "9842100000",
    "bank_account_no": "10023456789",
    "bank_ifsc": "HDFC0001234",
    "bank_name": "HDFC Bank",
    "number_of_looms": 2,
    "status": "active",
    "product_ids": [1, 2]
  }
  ```
- **Success Response (201 Created)**: Returns created weaver document.

#### `GET /api/weavers/:id`
Get single weaver details by `weaver_id` or `_id`, along with live material balances and unpaid amount.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "weaver": {
        "weaver_id": 1,
        "weaver_code": "WVR-0001",
        "weaver_name": "Murugan Subramani",
        "mobile_number": "9842015673",
        "bank_account_no": "30124578901",
        "bank_ifsc": "SBIN0001234",
        "bank_name": "State Bank of India",
        "number_of_looms": 3,
        "status": "active",
        "assigned_product_ids": [1, 3]
      },
      "balances": {
        "jari": 2500,
        "yarn": 12000,
        "color_yarn": 0,
        "babin": 450
      },
      "totalUnpaidAmount": 11625.00,
      "daysSinceLastProduction": 12,
      "isAging": false
    }
  }
  ```

#### `PUT /api/weavers/:id`
Update weaver profile and assigned products.
- **Request Body**: Same fields as `POST /api/weavers`.
- **Success Response (200 OK)**: Returns updated weaver.

#### `DELETE /api/weavers/:id`
Delete weaver. (Validation: returns `400 Bad Request` if weaver has associated transactions, pavu, or babin records).

---

### 6.3 Products (`/api/products`)

#### `GET /api/products`
List all products.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "66dd9210...",
        "product_id": 1,
        "product_number": "P-0001",
        "product_name": "Kanchipuram Silk Saree",
        "length_meters": 6.25,
        "weaving_rate": 850.00,
        "default_jari_per_unit": 250,
        "default_yarn_per_unit": 800,
        "default_color_yarn_per_unit": 0,
        "default_babin_per_unit": 35.5,
        "default_jari_babin_per_unit": 12.0,
        "default_color_babin_per_unit": 0,
        "default_pavu_per_unit": 6.25,
        "default_jari_pavu_per_unit": 0,
        "created_at": "2026-08-13T11:58:57.000Z"
      }
    ]
  }
  ```

#### `POST /api/products`
Create a product.
- **Request Body**:
  ```json
  {
    "product_number": "P-0005",
    "product_name": "Bridal Brocade Silk Saree",
    "length_meters": 6.30,
    "weaving_rate": 1200.00,
    "default_jari_per_unit": 350,
    "default_yarn_per_unit": 900,
    "default_color_yarn_per_unit": 50,
    "default_babin_per_unit": 40,
    "default_jari_babin_per_unit": 15,
    "default_color_babin_per_unit": 10,
    "default_pavu_per_unit": 6.30,
    "default_jari_pavu_per_unit": 6.30
  }
  ```
- **Success Response (201 Created)**: Returns created product document.

#### `PUT /api/products/:id`
Update an existing product.
- **Success Response (200 OK)**: Returns updated product document.

#### `DELETE /api/products/:id`
Delete a product. (Fails if referenced in transactions).

---

### 6.4 Looms / Pavu Register (`/api/looms`)

#### `GET /api/looms`
List all pavu warp entries with computed live usage.
- **Query Parameters**:
  - `weaver_id` (optional): Filter by weaver ID
  - `pavu_type` (optional): `"normal"` | `"jari"`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "66dd9300...",
        "loom_id": 1,
        "loom_number": "PV-001",
        "weaver_id": 1,
        "weaver_name": "Murugan Subramani",
        "loom_no": 1,
        "pavu_type": "normal",
        "pavu_elai": "3600",
        "length_meters": 120,
        "distributor_name": "Sri Lakshmi Warping",
        "received_date": "2026-08-01",
        "notes": "Good quality warp",
        "used_meters": 62.5,
        "remaining_meters": 57.5,
        "is_completed": false,
        "is_over": false
      }
    ]
  }
  ```

#### `POST /api/looms`
Record a new Pavu warp entry.
- **Request Body**:
  ```json
  {
    "loom_number": "PV-008",
    "weaver_id": 1,
    "loom_no": 2,
    "pavu_type": "normal",
    "pavu_elai": "3800",
    "length_meters": 125,
    "distributor_name": "Balaji Warpers",
    "received_date": "2026-09-08",
    "notes": "Fine twist"
  }
  ```
- **Success Response (201 Created)**.

#### `PUT /api/looms/:id`
Update pavu entry.

#### `DELETE /api/looms/:id`
Delete pavu entry.

---

### 6.5 Babin Register (`/api/babins`)

#### `GET /api/babins`
List all Babin weft records.
- **Query Parameters**:
  - `weaver_id` (optional)
  - `babin_type` (optional): `"normal"` | `"jari"` | `"color"`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "66dd9400...",
        "babin_id": 1,
        "babin_number": "BBN-001",
        "weaver_id": 1,
        "weaver_name": "Murugan Subramani",
        "loom_no": 1,
        "babin_type": "jari",
        "color_name": null,
        "length_meters": 300,
        "distributor_name": "Meenakshi Yarn",
        "purchase_date": "2026-08-05",
        "notes": null,
        "used_meters": 120,
        "remaining_meters": 180,
        "is_completed": false,
        "is_over": false
      }
    ]
  }
  ```

#### `POST /api/babins`
Record Babin purchase.
- **Request Body**:
  ```json
  {
    "babin_number": "BBN-005",
    "weaver_id": 2,
    "loom_no": 1,
    "babin_type": "color",
    "color_name": "Crimson Red",
    "length_meters": 450,
    "distributor_name": "Surya Bobbins",
    "purchase_date": "2026-09-08",
    "notes": "Batch 4A"
  }
  ```
- **Success Response (201 Created)**.

#### `PUT /api/babins/:id` & `DELETE /api/babins/:id`

---

### 6.6 Material Rates (`/api/rates`)

#### `GET /api/rates`
List all rates (active and historic).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "rate_id": 4,
        "material_type": "jari",
        "rate_per_unit": 4650.00,
        "effective_from": "2026-08-08",
        "effective_to": null
      },
      {
        "rate_id": 3,
        "material_type": "yarn",
        "rate_per_unit": 415.00,
        "effective_from": "2026-08-08",
        "effective_to": null
      }
    ]
  }
  ```

#### `POST /api/rates`
Insert a new rate (auto-closes previous rate).
- **Request Body**:
  ```json
  {
    "material_type": "jari",
    "rate_per_unit": 4800.00,
    "effective_from": "2026-09-08"
  }
  ```
- **Success Response (201 Created)**.

---

### 6.7 Material Issue Transactions (`/api/transactions/issue`)

#### `POST /api/transactions/issue`
Issue raw materials (in Kilograms from frontend, stored as Grams in backend) to a weaver.
- **Request Body**:
  ```json
  {
    "weaver_id": 1,
    "entry_date": "2026-09-08",
    "notes": "Weekly material issue",
    "materials": {
      "jari": 2.5,       // 2.5 kg = 2500 grams
      "yarn": 10.0,      // 10.0 kg = 10000 grams
      "color_yarn": 1.2  // 1.2 kg = 1200 grams
    }
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Material issue recorded successfully",
    "data": {
      "createdCount": 3,
      "transaction_ids": [101, 102, 103]
    }
  }
  ```

#### `PUT /api/transactions/issue/:id`
Update a single material issue entry.
- **Request Body**:
  ```json
  {
    "quantity": 3000,
    "entry_date": "2026-09-08",
    "notes": "Adjusted weight"
  }
  ```

#### `DELETE /api/transactions/issue/:id`
Delete an issue entry.

---

### 6.8 Material Return Transactions (`/api/transactions/return`)

#### `POST /api/transactions/return`
Record material returned from a weaver.
- **Request Body**:
  ```json
  {
    "weaver_id": 1,
    "material_type": "yarn",
    "quantity": 1500, // grams
    "entry_date": "2026-09-08",
    "notes": "Leftover yarn returned"
  }
  ```
- **Validation**: Fails with `400 Bad Request` if `quantity` > available weaver balance for that material.
- **Success Response (201 Created)**.

---

### 6.9 Production Dispatch & Entries (`/api/production-entries`)

#### `POST /api/production-entries`
Atomic entry for a weaver's full dispatch visit (simultaneous material issue + multi-loom production entries).

- **Request Body**:
  ```json
  {
    "weaver_id": 1,
    "entry_date": "2026-09-08",
    "notes": "Dispatched 2 looms",
    
    // Optional material issued in same visit (in kg)
    "material_issues": {
      "jari": 2.0,
      "yarn": 8.0,
      "color_yarn": 0
    },
    
    // Looms dispatched
    "looms": [
      {
        "loom_no": 1,
        "product_id": 1,
        "pieces": 5,
        "weaving_rate": 850.00,
        "custom_amount": 4250.00,
        "per_unit": {
          "jari": 250,       // g/piece
          "yarn": 800,       // g/piece
          "color_yarn": 0,   // g/piece
          "babin": 35.5      // m/piece
        }
      },
      {
        "loom_no": 2,
        "product_id": 2,
        "pieces": 4,
        "weaving_rate": 600.00,
        "custom_amount": 2400.00,
        "per_unit": {
          "jari": 50,
          "yarn": 600,
          "color_yarn": 0,
          "babin": 25.0
        }
      }
    ]
  }
  ```

- **Processing Steps**:
  1. Opens MongoDB transaction session.
  2. Generates unique `dispatchGroupId`.
  3. Inserts `material_issue` rows for any non-zero issued materials.
  4. For each loom:
     - Multiplies `pieces * per_unit[m]` to calculate total material quantity.
     - Inserts `production_consumption` rows for each material used.
     - Sets `amount = custom_amount` on the primary material row, and `amount = 0` on remaining rows for that loom.
     - Sets `is_paid = false`.
  5. Commits transaction.

- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Production dispatch recorded successfully",
    "data": {
      "dispatchGroupId": "disp_66dd95e0_1",
      "totalPieces": 9,
      "totalAmount": 6650.00
    }
  }
  ```

#### `PUT /api/production-entries/dispatch`
Edit an entire dispatch group atomically.
- **Request Body**:
  ```json
  {
    "transaction_ids": [105, 106, 107, 108],
    "weaver_id": 1,
    "entry_date": "2026-09-08",
    "notes": "Updated count",
    "is_paid": false,
    "looms": [ ... ]
  }
  ```
- **Processing**: Deletes the old transaction IDs and re-inserts the recalculated consumption rows within an atomic transaction.

#### `DELETE /api/production-entries/dispatch`
Delete an entire dispatch group.
- **Request Body**:
  ```json
  {
    "transaction_ids": [105, 106, 107, 108]
  }
  ```

---

### 6.10 Payment Settlement (`/api/payments`)

#### `PATCH /api/payments/mark-paid`
Mark one or more production consumption transactions as paid.
- **Request Body**:
  ```json
  {
    "transaction_ids": [105, 106, 107, 108]
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "4 transaction(s) marked as paid"
  }
  ```

---

### 6.11 Dashboard & Analytics (`/api/dashboard`)

#### `GET /api/dashboard/overview?date=YYYY-MM-DD`
Returns full top-level KPI metrics and activity list for the selected date.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "date": "2026-09-08",
      "stats": {
        "activeWeaversCount": 18,
        "totalWeaversCount": 20,
        "totalPayableAmount": 48250.00,
        "agingWeaversCount": 2,
        "lowPavuLoomsCount": 3
      },
      "dayActivity": [
        {
          "weaver_id": 1,
          "weaver_code": "WVR-0001",
          "weaver_name": "Murugan Subramani",
          "pieces_dispatched": 5,
          "issued": { "jari": 2000, "yarn": 8000, "color_yarn": 0 },
          "returned": { "jari": 0, "yarn": 500, "color_yarn": 0 },
          "total_amount": 4250.00,
          "unpaid_amount": 4250.00,
          "transaction_count": 4
        }
      ],
      "absentWeavers": [
        {
          "weaver_id": 4,
          "weaver_code": "WVR-0004",
          "weaver_name": "Kamala Ammal",
          "last_visit_date": "2026-08-20",
          "days_absent": 19
        }
      ]
    }
  }
  ```

---

### 6.12 Reports & Stock Overview (`/api/reports`)

#### `GET /api/reports/stock-overview`
Comprehensive stock holdings across all weavers, consumption distribution by product, and variance review alerts.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "stockByWeaver": [
        {
          "weaver_id": 1,
          "weaver_code": "WVR-0001",
          "weaver_name": "Murugan Subramani",
          "jari_balance_g": 2500,
          "yarn_balance_g": 12000,
          "color_yarn_balance_g": 0,
          "babin_purchased_m": 800,
          "babin_consumed_m": 350,
          "babin_balance_m": 450
        }
      ],
      "consumptionByProduct": [
        {
          "product_name": "Kanchipuram Silk Saree",
          "Jari": 12500,
          "Yarn": 40000,
          "Colour yarn": 0,
          "Babin": 1775
        }
      ],
      "flaggedTransactions": [
        {
          "transaction_id": 88,
          "weaver_name": "Murugan Subramani",
          "product_name": "Kanchipuram Silk Saree",
          "material_type": "jari",
          "actual_quantity": 350,
          "expected_quantity": 250,
          "variance_percent": "+40.0%",
          "entry_date": "2026-09-02"
        }
      ]
    }
  }
  ```

#### `GET /api/reports/bill-data`
Pre-calculated structured data for generating the dispatch bill PDF.
- **Query Parameters**:
  - `weaver_id` (required)
  - `date` (required)
  - `dispatch_group_id` (optional)
- **Success Response (200 OK)**: Returns the exact `BillData` JSON structure compatible with client and server PDF builders.

---

## 7. Standardized Error & Response Format

### Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable success message"
}
```

### Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Return quantity exceeds available balance",
    "details": [
      {
        "field": "quantity",
        "message": "Exceeds available balance (current: 1,500 g)"
      }
    ]
  }
}
```

### HTTP Status Code Conventions
- `200 OK`: Successful read or update.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure or business rule violation.
- `401 Unauthorized`: Missing or invalid JWT token.
- `403 Forbidden`: Insufficient permissions (e.g. non-admin).
- `404 Not Found`: Target entity does not exist.
- `409 Conflict`: Unique constraint violation (e.g. duplicate weaver code or product number).
- `500 Internal Server Error`: Unhandled server exception.

---

## 8. Seed Data & Initialization

When initializing a fresh MongoDB database, run a seed script (`npm run seed`) with:

```javascript
// Initial Material Rates
[
  { rateId: 1, materialType: "jari", ratePerUnit: 4650, effectiveFrom: "2026-08-01", effectiveTo: null },
  { rateId: 2, materialType: "yarn", ratePerUnit: 415, effectiveFrom: "2026-08-01", effectiveTo: null }
];

// Initial Products
[
  {
    productId: 1,
    productNumber: "P-0001",
    productName: "Kanchipuram Silk Saree",
    lengthMeters: 6.25,
    weavingRate: 850,
    defaultJariPerUnit: 250,
    defaultYarnPerUnit: 800,
    defaultBabinPerUnit: 35.5,
    defaultJariBabinPerUnit: 12.0,
    defaultColorYarnPerUnit: 0,
    defaultColorBabinPerUnit: 0,
    defaultPavuPerUnit: 6.25,
    defaultJariPavuPerUnit: 0
  },
  {
    productId: 2,
    productNumber: "P-0002",
    productName: "Cotton Handloom Dhoti",
    lengthMeters: 4.00,
    weavingRate: 450,
    defaultJariPerUnit: 50,
    defaultYarnPerUnit: 600,
    defaultBabinPerUnit: 20.0,
    defaultJariBabinPerUnit: 0,
    defaultColorYarnPerUnit: 0,
    defaultColorBabinPerUnit: 0,
    defaultPavuPerUnit: 4.00,
    defaultJariPavuPerUnit: 0
  }
];

// Initial Demo Admin User
{
  name: "Master Admin",
  email: "demo@weaverstock.app",
  password: "$2a$10$...hashed_demo-weaver-2026...",
  role: "admin",
  isActive: true
}
```

---

## 9. Next Steps for Implementation

1. **Initialize Node.js Project**:
   ```bash
   mkdir backend && cd backend
   npm init -y
   npm install express mongoose dotenv cors helmet jsonwebtoken bcryptjs zod
   npm install -D nodemon
   ```
2. **Setup Mongoose Models** from Section 4.
3. **Implement Services & Calculations** from Section 5.
4. **Implement REST Controllers & Routes** matching all endpoints in Section 6.
5. **Configure Auth Middleware & CORS** to connect your frontend.
