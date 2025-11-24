# 📈 Portfolio Equity API Documentation

## Base URL

```
http://localhost:3000/api/v1/portfolio
```

---

## Endpoints

### 1. Get All Equities

**GET** `/api/v1/portfolio/equity`

- **Description:** Returns all equities with quantity > 0.
- **Response:**
  ```json
  {
    "stocks": [
      {
        "name": "SLT",
        "qtty": 100,
        "avg_price": 12.5,
        "date": "2025-05-28",
        "comment": "My note"
      }
    ]
  }
  ```

---

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

---

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
  - `400` if missing fields

---

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
  - `400` if missing fields or stock does not exist

---

### 5. Get Individual Equity (with optional transactions)

**GET** `/api/v1/portfolio/equity/:name[?show_transactions=true]`

- **Query Param:**  
  - `show_transactions=true` to include transactions
- **Response:**  
  ```json
  {
    "name": "SLT",
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

---

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

---

### 7. Portfolio Summary

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

### 8. Create FX Deposit

**PUT** `/api/v1/portfolio/fx`

- **Description:** Creates a new FX (Foreign Exchange) deposit entry
- **Body:**  
  ```json
  {
    "bankName": "ABC Bank",
    "interestRate": 5.5,
    "amount": 50000,
    "currency": "USD"
  }
  ```
- **Response:**  
  ```json
  {
    "message": "FX deposit created successfully",
    "id": 1,
    "bankName": "ABC Bank",
    "interestRate": 5.5,
    "amount": 50000,
    "currency": "USD",
    "date": "2025-09-14"
  }
  ```
- **Errors:**  
  - `400` if missing fields or invalid values

---

### 9. Get FX Deposits

**GET** `/api/v1/portfolio/fx`

- **Description:** Returns all FX deposits ordered by creation date (newest first)
- **Response:**  
  ```json
  {
    "fxDeposits": [
      {
        "id": 1,
        "bankName": "ABC Bank",
        "interestRate": 5.5,
        "amount": 50000,
        "currency": "USD",
        "date": "2025-09-14",
        "createdAt": "2025-09-14T10:30:00.000Z"
      }
    ]
  }
  ```
- **Errors:**  
  - `500` if database error

---

### 10. Remove FX Deposit

**DELETE** `/api/v1/portfolio/fx/:id`

- **Description:** Removes a specific FX (Foreign Exchange) deposit by ID
- **URL Parameters:**
  - `id` (integer, required) - The ID of the FX deposit to remove
- **Response:**  
  ```json
  {
    "message": "FX deposit removed successfully",
    "id": 1,
    "deletedDeposit": {
      "bankName": "ABC Bank",
      "amount": 50000,
      "currency": "USD",
      "interestRate": 5.5,
      "date": "2025-09-14"
    }
  }
  ```
- **Errors:**  
  - `400` if invalid ID parameter
  - `404` if FX deposit not found
  - `500` if database error

**Example Usage:**
```bash
curl -X DELETE http://localhost:3000/api/v1/portfolio/fx/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Error Responses

- `400 Bad Request` – Missing or invalid fields
- `404 Not Found` – Resource not found
- `500 Internal Server Error` – Database or server error

---

## Notes

- All dates are in `YYYY-MM-DD` format.
- All endpoints support CORS.
- All POST requests must use `Content-Type: application/json`.
