# 💰 Expense Management API Documentation

## Base URL

```
http://localhost:3000/api/v1/expense
```

---

## Overview

The Expense Management API provides comprehensive expense tracking capabilities with support for categories, subcategories, date filtering, and aggregated reporting. This API does not require authentication and supports full CRUD operations.

---

## Endpoints

### 1. Record New Expense

**POST** `/api/v1/expense`

- **Description:** Creates a new expense record with category and subcategory tracking
- **Authentication:** Not required ❌
- **Body:**
  ```json
  {
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2025-11-27",
    "category": "Food & Dining",
    "subcategory": "Restaurants",
    "amount": 45.75,
    "description": "Dinner at Italian restaurant"
  }
  ```

- **Response (201):**
  ```json
  {
    "message": "Expense recorded successfully",
    "id": 156,
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2025-11-27",
    "category": "Food & Dining",
    "subcategory": "Restaurants",
    "amount": 45.75,
    "description": "Dinner at Italian restaurant",
    "createdAt": "2025-11-27T14:30:00.000Z"
  }
  ```

- **Field Requirements:**
  - `uuid`: Required, valid UUID format (36 characters with hyphens)
  - `date`: Required, YYYY-MM-DD format
  - `category`: Required, non-empty string
  - `subcategory`: Required, non-empty string
  - `amount`: Required, positive number
  - `description`: Optional, string

- **Errors:**
  - `400` if missing or invalid fields
  - `409` if UUID already exists
  - `500` if database error

**Example Usage:**
```bash
curl -X POST http://localhost:3000/api/v1/expense \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2025-11-27",
    "category": "Technology",
    "subcategory": "Software",
    "amount": 29.99,
    "description": "Monthly productivity app subscription"
  }'
```

---

### 2. Get All Expenses

**GET** `/api/v1/expense`

- **Description:** Retrieves all expenses with optional date filtering and pagination
- **Query Parameters:**
  - `startDate` (optional) - Filter from date (YYYY-MM-DD)
  - `endDate` (optional) - Filter to date (YYYY-MM-DD)
  - `category` (optional) - Filter by category name
  - `subcategory` (optional) - Filter by subcategory name
  - `limit` (optional) - Number of records to return
  - `offset` (optional) - Number of records to skip

- **Response (200):**
  ```json
  {
    "expenses": [
      {
        "id": 156,
        "uuid": "123e4567-e89b-12d3-a456-426614174000",
        "date": "2025-11-27",
        "category": "Food & Dining",
        "subcategory": "Restaurants",
        "amount": 45.75,
        "description": "Dinner at Italian restaurant",
        "createdAt": "2025-11-27T14:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 1247,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    },
    "filters": {
      "startDate": "2025-11-01",
      "endDate": "2025-11-30",
      "category": null,
      "subcategory": null
    }
  }
  ```

**Example Usage:**
```bash
# Get all expenses
curl http://localhost:3000/api/v1/expense

# Get expenses for specific date range
curl 'http://localhost:3000/api/v1/expense?startDate=2025-11-01&endDate=2025-11-30'

# Get expenses by category
curl 'http://localhost:3000/api/v1/expense?category=Food%20%26%20Dining'

# Get with pagination
curl 'http://localhost:3000/api/v1/expense?limit=20&offset=40'
```

---

### 3. Get Expense Categories

**GET** `/api/v1/expense/categories`

- **Description:** Returns all unique categories and their subcategories
- **Response (200):**
  ```json
  {
    "categories": {
      "Technology": ["Software", "Hardware", "Internet", "Mobile"],
      "Household": ["Utilities", "Groceries", "Cleaning"],
      "Transportation": ["Fuel", "Public Transit", "Maintenance", "Parking"],
      "Food & Dining": ["Restaurants", "Fast Food", "Coffee & Tea"],
      "Entertainment": ["Movies", "Streaming", "Games", "Books"]
    },
    "totalCategories": 5,
    "totalSubcategories": 18
  }
  ```

**Example Usage:**
```bash
curl http://localhost:3000/api/v1/expense/categories
```

---

### 4. Get Expense Summary

**GET** `/api/v1/expense/summary`

- **Description:** Returns aggregated expense data by category and subcategory with monthly breakdown
- **Query Parameters:**
  - `startDate` (optional) - Summary from date (default: 3 months ago)
  - `endDate` (optional) - Summary to date (default: today)

- **Response (200):**
  ```json
  {
    "period": {
      "startDate": "2025-09-01",
      "endDate": "2025-11-30",
      "totalDays": 91
    },
    "totals": {
      "totalAmount": 8547.25,
      "totalTransactions": 287,
      "averagePerDay": 93.93,
      "averagePerTransaction": 29.78
    },
    "categoryTotals": {
      "Food & Dining": {
        "amount": 2150.75,
        "count": 89,
        "percentage": 25.17,
        "subcategories": [
          {
            "name": "Restaurants",
            "amount": 1420.50,
            "count": 45,
            "percentage": 66.05
          },
          {
            "name": "Fast Food", 
            "amount": 485.25,
            "count": 32,
            "percentage": 22.57
          },
          {
            "name": "Coffee & Tea",
            "amount": 245.00,
            "count": 12,
            "percentage": 11.38
          }
        ]
      }
    },
    "monthlyBreakdown": {
      "2025-09": {
        "amount": 2845.75,
        "count": 95,
        "categories": {
          "Food & Dining": {
            "Restaurants": {
              "amount": 485.25,
              "count": 15
            }
          }
        }
      }
    }
  }
  ```

**Example Usage:**
```bash
# Default 3-month summary
curl http://localhost:3000/api/v1/expense/summary

# Custom date range summary
curl 'http://localhost:3000/api/v1/expense/summary?startDate=2025-03-01&endDate=2025-11-30'
```

---

### 5. Get Specific Expense

**GET** `/api/v1/expense/:uuid`

- **Description:** Retrieves a specific expense by UUID
- **URL Parameters:**
  - `uuid` (required) - The UUID of the expense

- **Response (200):**
  ```json
  {
    "expense": {
      "id": 156,
      "uuid": "123e4567-e89b-12d3-a456-426614174000",
      "date": "2025-11-27",
      "category": "Food & Dining",
      "subcategory": "Restaurants",
      "amount": 45.75,
      "description": "Dinner at Italian restaurant",
      "createdAt": "2025-11-27T14:30:00.000Z"
    }
  }
  ```

- **Errors:**
  - `400` if invalid UUID format
  - `404` if expense not found
  - `500` if database error

**Example Usage:**
```bash
curl http://localhost:3000/api/v1/expense/123e4567-e89b-12d3-a456-426614174000
```

---

### 6. Update Expense

**PUT** `/api/v1/expense/:uuid`

- **Description:** Updates an existing expense by UUID
- **URL Parameters:**
  - `uuid` (required) - The UUID of the expense to update

- **Body:**
  ```json
  {
    "date": "2025-11-28",
    "category": "Food & Dining",
    "subcategory": "Fast Food",
    "amount": 15.99,
    "description": "Updated: Quick lunch"
  }
  ```

- **Response (200):**
  ```json
  {
    "message": "Expense updated successfully",
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "updatedFields": {
      "date": "2025-11-28",
      "category": "Food & Dining",
      "subcategory": "Fast Food",
      "amount": 15.99,
      "description": "Updated: Quick lunch"
    }
  }
  ```

**Example Usage:**
```bash
curl -X PUT http://localhost:3000/api/v1/expense/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 35.50,
    "description": "Updated amount for dinner"
  }'
```

---

### 7. Delete Expense

**DELETE** `/api/v1/expense/:uuid`

- **Description:** Deletes an expense by UUID
- **URL Parameters:**
  - `uuid` (required) - The UUID of the expense to delete

- **Response (200):**
  ```json
  {
    "message": "Expense deleted successfully",
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "deletedExpense": {
      "date": "2025-11-27",
      "category": "Food & Dining",
      "subcategory": "Restaurants",
      "amount": 45.75,
      "description": "Dinner at Italian restaurant"
    }
  }
  ```

**Example Usage:**
```bash
curl -X DELETE http://localhost:3000/api/v1/expense/123e4567-e89b-12d3-a456-426614174000
```

---

## Common Categories & Subcategories

### 📱 Technology
- **Software** - Subscriptions, licenses, apps
- **Hardware** - Computers, accessories, peripherals
- **Internet** - ISP bills, Wi-Fi charges
- **Mobile** - Phone plans, device payments

### 🏠 Household  
- **Utilities** - Electric, gas, water bills
- **Groceries** - Food shopping, household items
- **Cleaning** - Supplies, services

### 🚗 Transportation
- **Fuel** - Gas, diesel, charging
- **Public Transit** - Bus, train, metro fares
- **Maintenance** - Repairs, oil changes, inspections
- **Parking** - Meters, garage fees

### 🍕 Food & Dining
- **Restaurants** - Sit-down dining experiences
- **Fast Food** - Quick service meals
- **Coffee & Tea** - Coffee shops, beverages

### 🎬 Entertainment
- **Movies** - Theater tickets, rentals
- **Streaming** - Netflix, Spotify, subscriptions
- **Games** - Video games, in-app purchases
- **Books** - Physical books, e-books, audiobooks

---

## Error Responses

### Standard Error Format
```json
{
  "error": "Error type",
  "message": "Human readable error description",
  "details": "Additional technical details (in development mode)"
}
```

### HTTP Status Codes
- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid input data
- **404 Not Found** - Resource not found
- **409 Conflict** - Duplicate UUID
- **500 Internal Server Error** - Database or server error

---

## Data Validation

### UUID Format
- Must be valid UUID v4 format
- Example: `123e4567-e89b-12d3-a456-426614174000`
- 36 characters with hyphens at positions 8, 13, 18, 23

### Date Format
- Must be YYYY-MM-DD format
- Example: `2025-11-27`
- Must be valid calendar date

### Amount Rules
- Must be positive number
- Supports up to 2 decimal places
- Minimum: 0.01
- No maximum limit enforced

### String Fields
- Category and subcategory: 1-100 characters
- Description: 0-500 characters (optional)
- Leading/trailing whitespace automatically trimmed

---

## Usage Examples

### Monthly Budget Tracking
```bash
# Get current month expenses
curl 'http://localhost:3000/api/v1/expense?startDate=2025-11-01&endDate=2025-11-30'

# Get food expenses this month
curl 'http://localhost:3000/api/v1/expense?startDate=2025-11-01&category=Food%20%26%20Dining'
```

### Expense Analysis
```bash
# Get 6-month spending summary
curl 'http://localhost:3000/api/v1/expense/summary?startDate=2025-06-01'

# View all categories for budget planning
curl http://localhost:3000/api/v1/expense/categories
```

### Bulk Data Import
```bash
# Record multiple expenses (run multiple times)
for expense in expense1.json expense2.json expense3.json; do
  curl -X POST http://localhost:3000/api/v1/expense \
    -H "Content-Type: application/json" \
    -d @$expense
done
```

---

## Development & Testing

### Generate Test Data
```bash
# Create sample categories and expenses
./create-dummy-categories.sh

# Generate 8 months of historical data
./generate-8month-data.sh
```

### Health Check
```bash
# Verify API server is running
curl http://localhost:3000/ping
```

---

## Notes

- **No Authentication Required** - All endpoints are publicly accessible
- **CORS Enabled** - Supports cross-origin requests
- **JSON Only** - All requests/responses use `application/json`
- **UTC Timestamps** - All datetime fields in UTC format
- **Case Sensitive** - Category and subcategory names are case-sensitive
- **UUID Uniqueness** - Each expense must have a unique UUID across all records

---

## Database Schema

```sql
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

*Last Updated: November 27, 2025*