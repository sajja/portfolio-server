#!/bin/bash

# Test curl commands for Expense API
# Make sure the server is running on localhost:3000

echo "=== Expense API Test Commands ==="
echo ""

# Base URL
BASE_URL="http://localhost:3000/api/v1/expense"

echo "1. Testing POST /api/v1/expense - Record new expenses"
echo "=================================================="

echo ""
echo "• Adding Food expense:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2025-10-26",
    "category": "Food",
    "subcategory": "Restaurants",
    "amount": 25.50,
    "description": "Lunch at downtown cafe"
  }' | jq '.'

echo ""
echo "• Adding Transportation expense:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "223e4567-e89b-12d3-a456-426614174001",
    "date": "2025-10-26",
    "category": "Transportation",
    "subcategory": "Fuel",
    "amount": 45.00,
    "description": "Gas station fill-up"
  }' | jq '.'

echo ""
echo "• Adding Utilities expense:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "323e4567-e89b-12d3-a456-426614174002",
    "date": "2025-10-25",
    "category": "Utilities",
    "subcategory": "Electricity",
    "amount": 120.75
  }' | jq '.'

echo ""
echo "• Adding Entertainment expense:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "423e4567-e89b-12d3-a456-426614174003",
    "date": "2025-10-24",
    "category": "Entertainment",
    "subcategory": "Movies",
    "amount": 18.00,
    "description": "Movie tickets for weekend"
  }' | jq '.'

echo ""
echo "• Adding Healthcare expense:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "523e4567-e89b-12d3-a456-426614174004",
    "date": "2025-10-23",
    "category": "Healthcare",
    "subcategory": "Medication",
    "amount": 35.25,
    "description": "Prescription refill"
  }' | jq '.'

echo ""
echo "=================================================="
echo "2. Testing GET /api/v1/expense - List expenses"
echo "=================================================="

echo ""
echo "• Get all expenses (current month - default):"
curl -X GET "$BASE_URL" | jq '.'

echo ""
echo "• Get expenses with date filter (last 7 days):"
FROM_DATE=$(date -d '7 days ago' +%Y-%m-%d)
TO_DATE=$(date +%Y-%m-%d)
curl -X GET "$BASE_URL?from_date=$FROM_DATE&to_date=$TO_DATE" | jq '.'

echo ""
echo "• Get expenses filtered by category (Food):"
curl -X GET "$BASE_URL?category=Food" | jq '.'

echo ""
echo "• Get expenses filtered by category and subcategory:"
curl -X GET "$BASE_URL?category=Transportation&subcategory=Fuel" | jq '.'

echo ""
echo "• Get expenses for specific date range:"
curl -X GET "$BASE_URL?from_date=2025-10-23&to_date=2025-10-26" | jq '.'

echo ""
echo "=================================================="
echo "3. Testing other GET endpoints"
echo "=================================================="

echo ""
echo "• Get all categories:"
curl -X GET "$BASE_URL/categories" | jq '.'

echo ""
echo "• Get specific expense by UUID:"
curl -X GET "$BASE_URL/123e4567-e89b-12d3-a456-426614174000" | jq '.'

echo ""
echo "=================================================="
echo "4. Testing PUT /api/v1/expense/:uuid - Update expense"
echo "=================================================="

echo ""
echo "• Update expense description and amount:"
curl -X PUT "$BASE_URL/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 28.75,
    "description": "Lunch at downtown cafe - updated amount"
  }' | jq '.'

echo ""
echo "=================================================="
echo "5. Testing error scenarios"
echo "=================================================="

echo ""
echo "• Try to add expense with duplicate UUID (should fail):"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "123e4567-e89b-12d3-a456-426614174000",
    "date": "2025-10-26",
    "category": "Food",
    "subcategory": "Groceries",
    "amount": 50.00
  }' | jq '.'

echo ""
echo "• Try to add expense with invalid UUID format:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "invalid-uuid-format",
    "date": "2025-10-26",
    "category": "Food",
    "subcategory": "Groceries",
    "amount": 50.00
  }' | jq '.'

echo ""
echo "• Try to add expense with invalid date:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "623e4567-e89b-12d3-a456-426614174005",
    "date": "invalid-date",
    "category": "Food",
    "subcategory": "Groceries",
    "amount": 50.00
  }' | jq '.'

echo ""
echo "• Try to add expense with missing required fields:"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "723e4567-e89b-12d3-a456-426614174006",
    "date": "2025-10-26",
    "amount": 50.00
  }' | jq '.'

echo ""
echo "• Try to get non-existent expense:"
curl -X GET "$BASE_URL/999e4567-e89b-12d3-a456-426614174999" | jq '.'

echo ""
echo "=================================================="
echo "6. Testing DELETE /api/v1/expense/:uuid"
echo "=================================================="

echo ""
echo "• Delete an expense:"
curl -X DELETE "$BASE_URL/523e4567-e89b-12d3-a456-426614174004" | jq '.'

echo ""
echo "• Try to delete the same expense again (should fail):"
curl -X DELETE "$BASE_URL/523e4567-e89b-12d3-a456-426614174004" | jq '.'

echo ""
echo "=================================================="
echo "All tests completed!"
echo "=================================================="