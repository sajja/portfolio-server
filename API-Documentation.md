# 📊 Candlestick Chart API Documentation

## Base URLs

```
http://localhost:3000/api/v1/portfolio
http://localhost:3000/api/v1/expense
http://localhost:3000/api/v1/companies
```

---

## 📈 Portfolio Equity Endpoints

### 1. Get All Equities

**GET** `/api/v1/portfolio/equity`

- **Description:** Returns all equities with quantity > 0, including last traded price if available.
- **Response:**
  ```json
  {
    "stocks": [
      {
        "symbol": "SLT",
        "qtty": 100,
        "avg_price": 12.5,
        "date": "2025-05-28",
        "comment": "My note",
        "lastTradedPrice": 13.25
      }
    ]
  }
  ```

### 2. Save/Update Comment for an Equity

**POST** `/api/v1/portfolio/equity/:eqtName`

- **Body:**  
  ```json
  { "comment": "This is a note for the equity" }
  ```
- **Response:**  
  ```json
  { "message": "Comment saved successfully", "eqtName": "SLT", "comment": "This is a note for the equity" }
  ```
- **Errors:**  
  - `404` if equity not found  
  - `400` if missing fields

### 3. Buy Equity

**POST** `/api/v1/portfolio/equity/:name/buy`

- **Body:**  
  ```json
  { "qtty": 10, "price": 12.5 }
  ```
- **Response:**  
  ```json
  { "message": "Stock bought successfully", "name": "SLT", "qtty": 110, "avg_price": 12.5 }
  ```
- **Errors:**  
  - `400` if missing fields or invalid values

### 4. Sell Equity

**POST** `/api/v1/portfolio/equity/:name/sell`

- **Body:**  
  ```json
  { "qtty": 5, "price": 15 }
  ```
- **Response:**  
  ```json
  { "message": "Stock sold successfully", "name": "SLT", "qtty": 105, "profit_loss": 12.5 }
  ```
- **Errors:**  
  - `400` if missing fields, invalid values, or stock does not exist

### 5. Get Individual Equity

**GET** `/api/v1/portfolio/equity/:name[?show_transactions=true]`

- **Query Param:**  
  - `show_transactions=true` to include transactions
- **Response:**  
  ```json
  {
    "symbol": "SLT",
    "qtty": 105,
    "avg_price": 12.5,
    "date": "2025-05-28",
    "comment": "My note",
    "transactions": [
      { "type": "buy", "qtty": 10, "price": 12.5, "date": "2025-05-28" }
    ]
  }
  ```
- **Errors:**  
  - `404` if stock not found

### 6. Get Transactions for an Equity

**GET** `/api/v1/portfolio/equity/:name/transactions`

- **Response:**  
  ```json
  {
    "stock": "SLT",
    "transactions": [
      { "type": "sell", "qtty": 5, "price": 15, "date": "2025-05-28", "profit_loss": 12.5 }
    ]
  }
  ```

### 7. Get All Transactions

**GET** `/api/v1/portfolio/equity/transactions[?type=buy|sell]`

- **Query Param:**  
  - `type` - Filter by transaction type
- **Response:**  
  ```json
  {
    "transactions": [
      { 
        "stock": "SLT",
        "type": "sell", 
        "qtty": 5, 
        "price": 15, 
        "date": "2025-05-28", 
        "profit_loss": 12.5 
      }
    ]
  }
  ```

### 8. Portfolio Summary

**GET** `/api/v1/portfolio/summary`

- **Description:** Returns investment and profit % for last 24, 12, and 6 months.
- **Response:**  
  ```json
  {
    "equity": {
      "summary_24_months": { "total_investment": 10000, "profit_percent": 5.5 },
      "summary_12_months": { "total_investment": 8000, "profit_percent": 4.2 },
      "summary_6_months": { "total_investment": 4000, "profit_percent": 2.1 }
    }
  }
  ```

---

## 💰 Expense Endpoints

### 1. Import Expenses

**POST** `/api/v1/expense`

- **Description:** Import expenses for a given year and month
- **Body:**
  ```json
  {
    "Year": 2025,
    "Month": 6,
    "Expenses": [
      {
        "Date": "2025-06-15",
        "Amount": 125.50,
        "Category": "Food",
        "Subcategory": "Groceries",
        "Description": "Weekly shopping"
      }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "Year": 2025,
    "Month": "06",
    "results": [
      {
        "id": 1,
        "Date": "2025-06-15",
        "Amount": 125.50,
        "Category": "Food",
        "Subcategory": "Groceries",
        "Description": "Weekly shopping"
      }
    ]
  }
  ```
- **Errors:**
  - `400` if invalid input format
  - `409` if expenses for the given year/month already exist
  - `500` for database errors

### 2. Get Expenses for Month

**GET** `/api/v1/expense?year=YYYY&month=MM[&page=1&pageSize=20]`

- **Query Parameters:**
  - `year`: Required - The year (YYYY format)
  - `month`: Required - The month (1-12)
  - `page`: Optional - Page number (default: 1)
  - `pageSize`: Optional - Items per page (default: 20)
- **Response:**
  ```json
  {
    "year": "2025",
    "month": "06",
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3,
    "expenses": [
      {
        "id": 1,
        "date": "2025-06-15",
        "amount": 125.50,
        "category": "Food",
        "subcategory": "Groceries",
        "description": "Weekly shopping"
      }
    ]
  }
  ```

### 3. Get Expense Summary

**GET** `/api/v1/expense/summary?months=N`

- **Query Parameters:**
  - `months`: Optional - Number of months to include (default: 6)
- **Response:**
  ```json
  {
    "2025-06": {
      "total": 2500.75,
      "categories": {
        "Food": {
          "total": 450.25,
          "subcategories": {
            "Groceries": 350.75,
            "Dining Out": 99.50
          }
        },
        "Housing": {
          "total": 1200,
          "subcategories": {
            "Rent": 1000,
            "Utilities": 200
          }
        }
      }
    },
    "2025-05": {
      "total": 2350.50,
      "categories": {
        "Food": {
          "total": 425.50,
          "subcategories": {
            "Groceries": 325.50,
            "Dining Out": 100.00
          }
        }
      }
    }
  }
  ```

### 4. Get Admin Expense Summary

**GET** `/api/v1/expense/admin/summary`

- **Description:** Returns a list of months with expense data
- **Response:**
  ```json
  [
    { "year": 2023, "month": 1 },
    { "year": 2023, "month": 2 }
  ]
  ```

---

## 💹 Dividend Endpoints

### 1. Update Dividends

**PUT** `/api/v1/companies/dividend`

- **Description:** Fetches latest dividend information from CSE and updates the database
- **Response:**
  ```json
  {
    "dividends": [
      {
        "symbol": "SLT",
        "xd": "2025-06-15",
        "payment": "2025-06-30",
        "remarks": "Final dividend for FY2024",
        "div_ps": 2.50,
        "own": true
      }
    ]
  }
  ```

### 2. Get Dividends

**GET** `/api/v1/companies/dividend?own=true|false`

- **Query Parameters:**
  - `own`: Optional - When true (default), only returns dividends for owned stocks
- **Response:**
  ```json
  {
    "dividends": [
      {
        "symbol": "SLT",
        "xd_date": "2025-06-15",
        "payment_date": "2025-06-30",
        "remarks": "Final dividend for FY2024",
        "div_ps": 2.50,
        "own": true
      }
    ]
  }
  ```

---

## Error Responses

- `400 Bad Request` – Missing or invalid fields
- `404 Not Found` – Resource not found
- `409 Conflict` – Resource already exists (for operations that should be unique)
- `500 Internal Server Error` – Database or server error

---

## Notes

- All dates are in `YYYY-MM-DD` format.
- All endpoints support CORS.
- All POST/PUT requests must use `Content-Type: application/json`.
- Dividend information is automatically synced every 12 hours.
