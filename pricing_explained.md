# 💰 Pricing System — Complete Explanation

## Overview

Your POS has **two distinct price concepts** for every product:

| Concept | Field | Where stored | Who sets it |
|---|---|---|---|
| **Selling Price** (what customer pays) | `PRICE` | `TBL_MST_PRODUCT` | Backoffice / Product Master |
| **Buying / Cost Price** (what you paid supplier) | `UNIT_COST` | `TBL_MST_PRODUCT` | Auto-calculated on each GRN |

---

## 1. Tables Involved in Pricing

### `TBL_MST_PRODUCT` — The Source of Truth for both prices

```sql
PROD_ID     VARCHAR(20)   -- product identifier
PROD_NAME   VARCHAR(200)
BARCODE     VARCHAR(50)
PRICE       DECIMAL(10,2) -- ✅ SELLING PRICE — manually set by admin
UNIT_COST   DECIMAL(18,2) -- ✅ BUYING PRICE / COST — auto-updated on GRN (weighted average)
STATUS      VARCHAR(1)    -- A=Active
```

> **`PRICE`** = what you charge the customer  
> **`UNIT_COST`** = what you paid to buy it from the supplier

---

### `TBL_TRN_GRN_HDR` + `TBL_TRN_GRN_DTL` — Goods Received Notes (Purchase Records)

```sql
-- Header
GRN_ID       VARCHAR(20)   -- unique GRN number
SUPP_ID      VARCHAR(20)   -- which supplier
WH_ID        VARCHAR(20)   -- which warehouse received into
TOTAL_AMOUNT DECIMAL(18,2) -- total invoice value from supplier
GRN_DATE     DATETIME

-- Detail (one row per product)
GRN_ID       VARCHAR(20)
PROD_ID      VARCHAR(20)
QTY          DECIMAL(18,3) -- how many units received
UNIT_COST    DECIMAL(18,2) -- ✅ what you paid per unit THIS time
LINE_TOTAL   DECIMAL(18,2) -- QTY × UNIT_COST
```

This is where the **buying price is recorded** at the time of purchase.

---

### `TBL_TRN_INVOICE` — Sales Header

```sql
SUB_TOTAL    DECIMAL(12,2) -- sum of all line totals before discount
DISCOUNT     DECIMAL(12,2) -- total invoice-level discount
NET_TOTAL    DECIMAL(12,2) -- what the customer actually pays
PAID_AMOUNT  DECIMAL(12,2) -- how much was tendered
PAYMENT_METHOD VARCHAR(20) -- CASH, CARD, VOUCHER, CREDIT, MIXED
```

---

### `TBL_TRN_INVOICE_ITEM` — Sales Line Items (the most important for profit)

```sql
PROD_ID     VARCHAR(20)
QTY         DECIMAL(10,3)
UNIT_PRICE  DECIMAL(10,2) -- ✅ SELLING PRICE snapshotted at time of sale
UNIT_COST   DECIMAL(18,2) -- ✅ COST PRICE snapshotted at time of sale (from product master)
DISCOUNT    DECIMAL(10,2) -- line-level discount
LINE_TOTAL  DECIMAL(12,2) -- (UNIT_PRICE × QTY) - DISCOUNT
```

> **Both prices are frozen at the moment of sale.** This means even if you change the product's price later, historical invoices remain accurate.

---

## 2. The Buying Price Mechanism (GRN → Weighted Average Cost)

When you receive stock from a supplier via a **GRN**, the backend:

1. Records each item's `UNIT_COST` in `TBL_TRN_GRN_DTL`
2. **Recalculates a Weighted Average Cost** and updates `TBL_MST_PRODUCT.UNIT_COST`

The formula used (from `stock.rs`):

```
New UNIT_COST = (Old UNIT_COST × Current Stock QTY + New UNIT_COST × New QTY)
                ──────────────────────────────────────────────────────────────
                              (Current Stock QTY + New QTY)
```

**Example:**
- You have 50 units of "Coca Cola" in stock at a cost of Rs. 80 each
- You receive 100 more units at Rs. 85 each from supplier
- New weighted average = `(80 × 50 + 85 × 100) / (50 + 100)` = **Rs. 83.33**
- `TBL_MST_PRODUCT.UNIT_COST` is updated to **83.33**

This ensures the cost is always a fair rolling average, not just the last purchase price.

---

## 3. The Selling Price Mechanism

The **selling price (`PRICE`)** is set manually by the Backoffice admin:

- **Set at creation**: when a product is created in the Backoffice Products page, the `price` field is entered
- **Updated manually**: via the Update Product API (`PUT /master/products/:id`) — the admin can change it any time
- **Used at checkout**: when a product is scanned at the Cashier, its `PRICE` from `TBL_MST_PRODUCT` is picked up and sent as `unit_price` in the checkout request

> **The cashier does NOT recalculate the price** — the frontend reads `PRICE` from the product and sends it as-is to the server. The server trusts the `unit_price` sent by the client.

---

## 4. The Checkout Flow — Step by Step

```
Customer picks products
        ↓
Cashier scans (reads PRICE from TBL_MST_PRODUCT)
        ↓
Cashier applies line discount (optional)
        ↓
POST /pos/checkout  {
  items: [{ prod_id, qty, unit_price, discount, line_total }],
  sub_total, discount, net_total,
  payments: [{ method, amount }]
}
        ↓
Backend validates:
  - total_paid >= net_total
  - stock QTY >= requested QTY  (from TBL_MST_STOCKS)
  - credit limit not exceeded (if CREDIT payment)
        ↓
Backend reads UNIT_COST from TBL_MST_PRODUCT  ← cost frozen at this moment
        ↓
Inserts into TBL_TRN_INVOICE        (totals, payment method)
Inserts into TBL_TRN_INVOICE_ITEM   (UNIT_PRICE + UNIT_COST both stored)
Inserts into TBL_TRN_INVOICE_PAYMENT (each payment leg)
Deducts QTY from TBL_MST_STOCKS
```

---

## 5. How Profit Is Calculated

Profit is **not stored** as a field — it is **derived on-demand** from invoice items:

### Per Line Item:
```
Line Profit = LINE_TOTAL - (UNIT_COST × QTY)
            = (UNIT_PRICE × QTY - DISCOUNT) - (UNIT_COST × QTY)
```

### Per Invoice:
```
Invoice Profit = NET_TOTAL - SUM(UNIT_COST × QTY)  for all items
```

### Example:
| Product | QTY | Unit Price | Unit Cost | Discount | Line Total | Line Profit |
|---|---|---|---|---|---|---|
| Coca Cola 500ml | 2 | Rs. 120 | Rs. 83.33 | Rs. 0 | Rs. 240 | Rs. 73.34 |
| Lay's Chips | 1 | Rs. 200 | Rs. 150 | Rs. 10 | Rs. 190 | Rs. 40.00 |
| **Invoice Total** | | | | | **Rs. 430** | **Rs. 113.34** |

### Profit Margin %:
```
Margin % = (Line Profit / Line Total) × 100
         = (113.34 / 430) × 100 = 26.4%
```

---

## 6. The Reports Handler

The `reports.rs` handler currently exposes sales data. A **profit report** can be queried like this:

```sql
SELECT 
    i.INV_DATE,
    ii.PROD_ID,
    p.PROD_NAME,
    SUM(ii.QTY) as TOTAL_QTY,
    SUM(ii.LINE_TOTAL) as TOTAL_REVENUE,
    SUM(ii.UNIT_COST * ii.QTY) as TOTAL_COST,
    SUM(ii.LINE_TOTAL - (ii.UNIT_COST * ii.QTY)) as GROSS_PROFIT
FROM tbl_trn_invoice_item ii
JOIN tbl_trn_invoice i ON i.INV_ID = ii.INV_ID
JOIN tbl_mst_product p ON p.PROD_ID = ii.PROD_ID
WHERE i.STATUS = 'C'
GROUP BY ii.PROD_ID, p.PROD_NAME, DATE(i.INV_DATE)
```

---

## 7. Summary Diagram

```
SUPPLIER ──[pays Rs. X per unit]──► TBL_TRN_GRN_DTL.UNIT_COST
                                              │
                                    Weighted Average Calculation
                                              │
                                              ▼
                                 TBL_MST_PRODUCT.UNIT_COST  ◄── "Buying Price"
                                 TBL_MST_PRODUCT.PRICE      ◄── "Selling Price" (set manually)
                                              │
                               At checkout, BOTH values are snapshotted
                                              │
                                              ▼
                              TBL_TRN_INVOICE_ITEM.UNIT_PRICE  (selling)
                              TBL_TRN_INVOICE_ITEM.UNIT_COST   (buying)
                                              │
                                    PROFIT = UNIT_PRICE - UNIT_COST
                                           (per unit, before discount)
```

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| Weighted average cost | Smooths out price fluctuations across multiple GRNs |
| Both prices snapshotted on invoice_item | Profit reports remain accurate even after price changes |
| Selling price manually set | Gives admin full control over margin |
| No discount table yet | The Pricing module (`/pricing/discount-master` etc.) exists in the Backoffice UI but is not yet wired to the backend — discounts are currently applied directly at the cashier |
| Loyalty points accrual = paid_amount / 100 | 1 point per Rs. 100 spent (non-loyalty payments only) |
