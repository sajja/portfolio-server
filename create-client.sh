#!/bin/bash

# Portfolio API - Client Creation Script
# This script creates a new API client with credentials

set -e  # Exit on any error

BASE_URL="http://localhost:3000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Portfolio API - Client Creator${NC}"
echo "=================================="
echo ""

# Function to generate secure client secret
generate_client_secret() {
    # Generate a 32-byte random hex string
    openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

# Function to validate client_id format
validate_client_id() {
    local client_id="$1"
    if [[ ! "$client_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo -e "${RED}❌ Error: Client ID can only contain letters, numbers, hyphens, and underscores${NC}"
        return 1
    fi
    if [[ ${#client_id} -lt 3 ]]; then
        echo -e "${RED}❌ Error: Client ID must be at least 3 characters long${NC}"
        return 1
    fi
    if [[ ${#client_id} -gt 50 ]]; then
        echo -e "${RED}❌ Error: Client ID must be less than 50 characters long${NC}"
        return 1
    fi
    return 0
}

# Check if server is running
check_server() {
    echo -e "${YELLOW}🔍 Checking server connectivity...${NC}"
    if curl -s -f "$BASE_URL/auth/status" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is running${NC}"
        return 0
    else
        echo -e "${RED}❌ Server is not accessible at $BASE_URL${NC}"
        echo "Please start the server with: npm start"
        return 1
    fi
}

# Get client ID from user
get_client_id() {
    while true; do
        echo ""
        echo -e "${YELLOW}📝 Enter Client ID:${NC}"
        read -p "Client ID: " client_id
        
        if [[ -z "$client_id" ]]; then
            echo -e "${RED}❌ Client ID cannot be empty${NC}"
            continue
        fi
        
        if validate_client_id "$client_id"; then
            break
        fi
    done
}

# Get optional client name
get_client_name() {
    echo ""
    echo -e "${YELLOW}📝 Enter Client Name (optional, press Enter to skip):${NC}"
    read -p "Client Name: " client_name
    
    if [[ -z "$client_name" ]]; then
        client_name="$client_id"
    fi
}

# Get optional client description
get_client_description() {
    echo ""
    echo -e "${YELLOW}📝 Enter Client Description (optional, press Enter to skip):${NC}"
    read -p "Description: " client_description
    
    if [[ -z "$client_description" ]]; then
        client_description="API client created via script"
    fi
}

# Create client via API
create_client() {
    local client_id="$1"
    local client_name="$2"
    local client_description="$3"
    local client_secret="$4"
    
    echo ""
    echo -e "${YELLOW}🔨 Creating client...${NC}"
    
    # Create JSON payload
    local json_payload=$(cat <<EOF
{
    "client_id": "$client_id",
    "name": "$client_name",
    "description": "$client_description",
    "client_secret": "$client_secret"
}
EOF
)
    
    # Make API call
    local response=$(curl -s -X POST "$BASE_URL/auth/clients" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    # Check if response contains error
    if echo "$response" | grep -q '"error"'; then
        echo -e "${RED}❌ Failed to create client:${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 1
    else
        echo -e "${GREEN}✅ Client created successfully!${NC}"
        
        # Extract the actual client_id and client_secret from response (in case they were modified)
        ACTUAL_CLIENT_ID=$(echo "$response" | jq -r '.client_id // empty')
        ACTUAL_CLIENT_SECRET=$(echo "$response" | jq -r '.client_secret // empty')
        
        if [[ -n "$ACTUAL_CLIENT_ID" ]]; then
            echo "  Server assigned Client ID: $ACTUAL_CLIENT_ID"
        fi
        
        return 0
    fi
}

# Display client credentials
display_credentials() {
    local client_id="$1"
    local client_secret="$2"
    
    echo ""
    echo -e "${GREEN}🎉 Client Created Successfully!${NC}"
    echo "================================="
    echo -e "${BLUE}Client ID:${NC}     $client_id"
    echo -e "${BLUE}Client Secret:${NC} $client_secret"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Save these credentials securely!${NC}"
    echo "The client secret will not be shown again."
    echo ""
    echo -e "${BLUE}📖 Usage Example:${NC}"
    echo "# Get access token:"
    echo "curl -X POST $BASE_URL/auth/token \\"
    echo "  -H \"Content-Type: application/json\" \\"
    echo "  -d '{"
    echo "    \"client_id\": \"$client_id\","
    echo "    \"client_secret\": \"$client_secret\","
    echo "    \"grant_type\": \"client_credentials\""
    echo "  }'"
    echo ""
    echo "# Use token to access APIs:"
    echo "curl -H \"Authorization: Bearer \$ACCESS_TOKEN\" \\"
    echo "  $BASE_URL/api/v1/portfolio/equity"
    echo ""
}

# Save credentials to file (optional)
save_credentials() {
    local client_id="$1"
    local client_secret="$2"
    
    echo -e "${YELLOW}💾 Save credentials to file? (y/N):${NC}"
    read -p "Save? " save_choice
    
    if [[ "$save_choice" =~ ^[Yy]$ ]]; then
        local filename="client-${client_id}-$(date +%Y%m%d-%H%M%S).env"
        cat > "$filename" <<EOF
# Portfolio API Client Credentials
# Created: $(date)
# Client ID: $client_id

# Use these credentials to authenticate with the Portfolio API
CLIENT_ID=$client_id
CLIENT_SECRET=$client_secret

# Example usage:
# curl -X POST http://localhost:3000/auth/token \\
#   -H "Content-Type: application/json" \\
#   -d '{"client_id":"$client_id","client_secret":"$client_secret","grant_type":"client_credentials"}'
EOF
        echo -e "${GREEN}✅ Credentials saved to: $filename${NC}"
        echo -e "${YELLOW}⚠️  Keep this file secure and do not commit to version control!${NC}"
    fi
}

# Main execution
main() {
    echo "This script will help you create a new API client for the Portfolio API."
    echo ""
    
    # Check server connectivity
    if ! check_server; then
        exit 1
    fi
    
    # Get user inputs
    get_client_id
    get_client_name
    get_client_description
    
    # Generate secure client secret
    client_secret=$(generate_client_secret)
    
    # Confirm creation
    echo ""
    echo -e "${YELLOW}📋 Review Client Details:${NC}"
    echo "Client ID:    $client_id"
    echo "Name:         $client_name"
    echo "Description:  $client_description"
    echo ""
    echo -e "${YELLOW}Create this client? (y/N):${NC}"
    read -p "Confirm: " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Client creation cancelled."
        exit 0
    fi
    
    # Create the client
    if create_client "$client_id" "$client_name" "$client_description" "$client_secret"; then
        # Use actual values returned from API (or fallback to original values)
        final_client_id="${ACTUAL_CLIENT_ID:-$client_id}"
        final_client_secret="${ACTUAL_CLIENT_SECRET:-$client_secret}"
        
        display_credentials "$final_client_id" "$final_client_secret"
        save_credentials "$final_client_id" "$final_client_secret"
    else
        echo -e "${RED}❌ Failed to create client${NC}"
        exit 1
    fi
}

# Run main function
main "$@"