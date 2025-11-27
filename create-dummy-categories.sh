#!/bin/bash

# Dummy Expense Categories & Subcategories Data
# This script creates sample expense records to populate categories and subcategories

BASE_URL="http://localhost:3000/api/v1/expense"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗂️  Creating Dummy Expense Categories & Subcategories${NC}"
echo "=================================================="
echo ""

# Function to generate UUID
generate_uuid() {
    cat /proc/sys/kernel/random/uuid
}

# Function to create expense
create_expense() {
    local category="$1"
    local subcategory="$2"
    local amount="$3"
    local description="$4"
    local date="${5:-2025-11-27}"
    
    local uuid=$(generate_uuid)
    
    echo "Creating: $category -> $subcategory ($amount)"
    
    curl -s -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"uuid\": \"$uuid\",
            \"date\": \"$date\",
            \"category\": \"$category\",
            \"subcategory\": \"$subcategory\",
            \"amount\": $amount,
            \"description\": \"$description\"
        }" | jq -r '.message // .error' || echo "Request failed"
}

echo -e "${GREEN}📱 Creating Technology expenses...${NC}"
create_expense "Technology" "Software" 29.99 "Monthly subscription to productivity app" "2025-11-20"
create_expense "Technology" "Hardware" 299.99 "Wireless mouse and keyboard set" "2025-11-21"
create_expense "Technology" "Internet" 79.99 "Monthly internet bill" "2025-11-22"
create_expense "Technology" "Mobile" 45.00 "Phone plan monthly payment" "2025-11-23"

echo ""
echo -e "${GREEN}🏠 Creating Household expenses...${NC}"
create_expense "Household" "Utilities" 125.50 "Electric bill for November" "2025-11-15"
create_expense "Household" "Groceries" 89.25 "Weekly grocery shopping" "2025-11-24"
create_expense "Household" "Cleaning" 15.99 "Bathroom cleaning supplies" "2025-11-25"

echo ""
echo -e "${GREEN}🚗 Creating Transportation expenses...${NC}"
create_expense "Transportation" "Fuel" 65.00 "Gas station fill-up" "2025-11-26"
create_expense "Transportation" "Public Transit" 12.50 "Bus fare for the week" "2025-11-27"
create_expense "Transportation" "Maintenance" 89.99 "Car oil change service" "2025-11-18"
create_expense "Transportation" "Parking" 8.00 "Downtown parking meter" "2025-11-27"

echo ""
echo -e "${GREEN}🍕 Creating Food & Dining expenses...${NC}"
create_expense "Food & Dining" "Restaurants" 35.75 "Lunch at Italian restaurant" "2025-11-27"
create_expense "Food & Dining" "Fast Food" 12.99 "Quick burger and fries" "2025-11-26"
create_expense "Food & Dining" "Coffee & Tea" 4.50 "Morning cappuccino" "2025-11-27"

echo ""
echo -e "${GREEN}🎬 Creating Entertainment expenses...${NC}"
create_expense "Entertainment" "Movies" 24.00 "Movie tickets for weekend show" "2025-11-23"
create_expense "Entertainment" "Streaming" 15.99 "Netflix monthly subscription" "2025-11-01"
create_expense "Entertainment" "Games" 59.99 "New video game purchase" "2025-11-19"
create_expense "Entertainment" "Books" 18.50 "Novel from bookstore" "2025-11-22"

echo ""
echo -e "${BLUE}✅ Dummy categories and subcategories created!${NC}"
echo ""
echo "📋 Categories created:"
echo "  • Technology (Software, Hardware, Internet, Mobile)"
echo "  • Household (Utilities, Groceries, Cleaning)"
echo "  • Transportation (Fuel, Public Transit, Maintenance, Parking)"
echo "  • Food & Dining (Restaurants, Fast Food, Coffee & Tea)"
echo "  • Entertainment (Movies, Streaming, Games, Books)"
echo ""
echo "🔍 View all categories with:"
echo "curl http://localhost:3000/api/v1/expense/categories"
echo ""
echo "📊 View expense summary with:"
echo "curl http://localhost:3000/api/v1/expense/summary"