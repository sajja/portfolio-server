#!/bin/bash

# Generate 8 Months of Dummy Expense Data
# March 2025 to November 2025 (8 months)

BASE_URL="http://localhost:3000/api/v1/expense"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📊 Generating 8 Months of Expense Data${NC}"
echo "======================================"
echo -e "${YELLOW}Period: March 2025 to November 2025${NC}"
echo ""

# Function to generate UUID
generate_uuid() {
    cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || echo "$(od -x /dev/urandom | head -1 | awk '{OFS="-"; print $2$3,$4,$5,$6,$7$8$9}')"
}

# Function to create expense
create_expense() {
    local category="$1"
    local subcategory="$2" 
    local amount="$3"
    local description="$4"
    local date="$5"
    
    local uuid=$(generate_uuid)
    
    echo "  $date: $category -> $subcategory (\$$amount)"
    
    curl -s -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"uuid\": \"$uuid\",
            \"date\": \"$date\", 
            \"category\": \"$category\",
            \"subcategory\": \"$subcategory\",
            \"amount\": $amount,
            \"description\": \"$description\"
        }" > /dev/null
}

# Arrays for random variations
TECH_SOFTWARE_DESC=("Cloud storage subscription" "Video editing software" "Productivity app renewal" "Code editor license" "Design software monthly")
TECH_HARDWARE_DESC=("USB cable" "External hard drive" "Computer mouse" "Keyboard replacement" "Monitor stand" "Webcam" "Phone charger")
HOUSEHOLD_GROCERY_DESC=("Weekly grocery shopping" "Fresh produce and meat" "Pantry restocking" "Organic food items" "Bulk grocery purchase")
TRANSPORT_FUEL_DESC=("Gas station fill-up" "Fuel for road trip" "Weekly gas purchase" "Premium gasoline" "Gas for commute")
FOOD_RESTAURANT_DESC=("Dinner at steakhouse" "Italian restaurant lunch" "Sushi dinner" "Mexican food takeout" "Thai restaurant order" "Pizza delivery")
ENTERTAIN_MOVIE_DESC=("Movie tickets for two" "IMAX movie experience" "Weekend movie night" "New release tickets" "Drive-in movie")

# Random amount generators
random_software_amount() { echo "scale=2; 15 + ($RANDOM % 85)" | bc; }
random_hardware_amount() { echo "scale=2; 25 + ($RANDOM % 275)" | bc; }
random_internet_amount() { echo "scale=2; 65 + ($RANDOM % 25)" | bc; }
random_mobile_amount() { echo "scale=2; 35 + ($RANDOM % 25)" | bc; }
random_utilities_amount() { echo "scale=2; 85 + ($RANDOM % 65)" | bc; }
random_grocery_amount() { echo "scale=2; 45 + ($RANDOM % 85)" | bc; }
random_cleaning_amount() { echo "scale=2; 8 + ($RANDOM % 25)" | bc; }
random_fuel_amount() { echo "scale=2; 35 + ($RANDOM % 45)" | bc; }
random_transit_amount() { echo "scale=2; 5 + ($RANDOM % 20)" | bc; }
random_maintenance_amount() { echo "scale=2; 50 + ($RANDOM % 150)" | bc; }
random_parking_amount() { echo "scale=2; 3 + ($RANDOM % 15)" | bc; }
random_restaurant_amount() { echo "scale=2; 15 + ($RANDOM % 65)" | bc; }
random_fastfood_amount() { echo "scale=2; 8 + ($RANDOM % 15)" | bc; }
random_coffee_amount() { echo "scale=2; 3 + ($RANDOM % 8)" | bc; }
random_movie_amount() { echo "scale=2; 12 + ($RANDOM % 20)" | bc; }
random_streaming_amount() { echo "scale=2; 9 + ($RANDOM % 12)" | bc; }
random_games_amount() { echo "scale=2; 20 + ($RANDOM % 60)" | bc; }
random_books_amount() { echo "scale=2; 10 + ($RANDOM % 25)" | bc; }

# Generate data for 8 months
for month in {3..11}; do
    # Format month with leading zero
    month_str=$(printf "%02d" $month)
    month_name=""
    
    case $month in
        3) month_name="March" ;;
        4) month_name="April" ;;
        5) month_name="May" ;;
        6) month_name="June" ;;
        7) month_name="July" ;;
        8) month_name="August" ;;
        9) month_name="September" ;;
        10) month_name="October" ;;
        11) month_name="November" ;;
    esac
    
    echo -e "${GREEN}📅 Creating $month_name 2025 expenses...${NC}"
    
    # Technology expenses (4-8 per month)
    expense_count=$((4 + $RANDOM % 5))
    for i in $(seq 1 $expense_count); do
        day=$((1 + $RANDOM % 28))
        day_str=$(printf "%02d" $day)
        date="2025-$month_str-$day_str"
        
        case $((RANDOM % 4)) in
            0)
                desc_idx=$((RANDOM % ${#TECH_SOFTWARE_DESC[@]}))
                create_expense "Technology" "Software" $(random_software_amount) "${TECH_SOFTWARE_DESC[$desc_idx]}" "$date"
                ;;
            1)
                desc_idx=$((RANDOM % ${#TECH_HARDWARE_DESC[@]}))
                create_expense "Technology" "Hardware" $(random_hardware_amount) "${TECH_HARDWARE_DESC[$desc_idx]}" "$date"
                ;;
            2)
                create_expense "Technology" "Internet" $(random_internet_amount) "Monthly internet bill" "$date"
                ;;
            3)
                create_expense "Technology" "Mobile" $(random_mobile_amount) "Phone plan payment" "$date"
                ;;
        esac
    done
    
    # Household expenses (6-12 per month)
    expense_count=$((6 + $RANDOM % 7))
    for i in $(seq 1 $expense_count); do
        day=$((1 + $RANDOM % 28))
        day_str=$(printf "%02d" $day)
        date="2025-$month_str-$day_str"
        
        case $((RANDOM % 3)) in
            0)
                create_expense "Household" "Utilities" $(random_utilities_amount) "Monthly utility bill" "$date"
                ;;
            1)
                desc_idx=$((RANDOM % ${#HOUSEHOLD_GROCERY_DESC[@]}))
                create_expense "Household" "Groceries" $(random_grocery_amount) "${HOUSEHOLD_GROCERY_DESC[$desc_idx]}" "$date"
                ;;
            2)
                create_expense "Household" "Cleaning" $(random_cleaning_amount) "Household cleaning supplies" "$date"
                ;;
        esac
    done
    
    # Transportation expenses (5-10 per month)
    expense_count=$((5 + $RANDOM % 6))
    for i in $(seq 1 $expense_count); do
        day=$((1 + $RANDOM % 28))
        day_str=$(printf "%02d" $day)
        date="2025-$month_str-$day_str"
        
        case $((RANDOM % 4)) in
            0)
                desc_idx=$((RANDOM % ${#TRANSPORT_FUEL_DESC[@]}))
                create_expense "Transportation" "Fuel" $(random_fuel_amount) "${TRANSPORT_FUEL_DESC[$desc_idx]}" "$date"
                ;;
            1)
                create_expense "Transportation" "Public Transit" $(random_transit_amount) "Bus/train fare" "$date"
                ;;
            2)
                create_expense "Transportation" "Maintenance" $(random_maintenance_amount) "Vehicle maintenance" "$date"
                ;;
            3)
                create_expense "Transportation" "Parking" $(random_parking_amount) "Parking fee" "$date"
                ;;
        esac
    done
    
    # Food & Dining expenses (8-15 per month)
    expense_count=$((8 + $RANDOM % 8))
    for i in $(seq 1 $expense_count); do
        day=$((1 + $RANDOM % 28))
        day_str=$(printf "%02d" $day)
        date="2025-$month_str-$day_str"
        
        case $((RANDOM % 3)) in
            0)
                desc_idx=$((RANDOM % ${#FOOD_RESTAURANT_DESC[@]}))
                create_expense "Food & Dining" "Restaurants" $(random_restaurant_amount) "${FOOD_RESTAURANT_DESC[$desc_idx]}" "$date"
                ;;
            1)
                create_expense "Food & Dining" "Fast Food" $(random_fastfood_amount) "Quick meal" "$date"
                ;;
            2)
                create_expense "Food & Dining" "Coffee & Tea" $(random_coffee_amount) "Coffee shop visit" "$date"
                ;;
        esac
    done
    
    # Entertainment expenses (3-7 per month)
    expense_count=$((3 + $RANDOM % 5))
    for i in $(seq 1 $expense_count); do
        day=$((1 + $RANDOM % 28))
        day_str=$(printf "%02d" $day)
        date="2025-$month_str-$day_str"
        
        case $((RANDOM % 4)) in
            0)
                desc_idx=$((RANDOM % ${#ENTERTAIN_MOVIE_DESC[@]}))
                create_expense "Entertainment" "Movies" $(random_movie_amount) "${ENTERTAIN_MOVIE_DESC[$desc_idx]}" "$date"
                ;;
            1)
                create_expense "Entertainment" "Streaming" $(random_streaming_amount) "Streaming service" "$date"
                ;;
            2)
                create_expense "Entertainment" "Games" $(random_games_amount) "Video game purchase" "$date"
                ;;
            3)
                create_expense "Entertainment" "Books" $(random_books_amount) "Book purchase" "$date"
                ;;
        esac
    done
    
    echo ""
done

echo -e "${BLUE}✅ 8-Month Expense Data Generation Complete!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo "• Period: March 2025 to November 2025 (8 months)"
echo "• Categories: 5 main categories"
echo "• Subcategories: 18 total subcategories"
echo "• Estimated entries: ~1,800-2,500 expense records"
echo ""
echo -e "${GREEN}🔍 View results:${NC}"
echo "curl http://localhost:3000/api/v1/expense/categories | jq '.'"
echo "curl http://localhost:3000/api/v1/expense/summary | jq '.'"
echo "curl 'http://localhost:3000/api/v1/expense?startDate=2025-03-01&endDate=2025-11-30' | jq '.'"