#!/bin/bash

# Client Credentials Authentication Test Script
# Tests the authentication endpoints and protected routes

BASE_URL="http://localhost:3000"

echo "🔐 Client Credentials Authentication Test Suite"
echo "============================================="
echo ""

# Test 1: Check if server is running
echo "1. Testing server connectivity..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$response" = "200" ]; then
    echo "✅ Server is running"
else
    echo "❌ Server is not accessible (HTTP $response)"
    echo "Please start the server with: npm start"
    exit 1
fi

# Test 2: Check root endpoint
echo ""
echo "2. Testing root endpoint..."
curl -s "$BASE_URL/" | jq '.' || echo "Response received but not valid JSON"

# Test 3: Test protected endpoint without auth (should fail)
echo ""
echo "3. Testing protected endpoint without authentication..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/portfolio/equity")
if [ "$response" = "401" ]; then
    echo "✅ Protected endpoint correctly requires authentication (HTTP 401)"
else
    echo "❌ Expected HTTP 401, got HTTP $response"
fi

# Test 4: Check authentication endpoints
echo ""
echo "4. Testing authentication endpoints..."

# Info page
echo "  - Auth info page:"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/info")
if [ "$response" = "200" ]; then
    echo "    ✅ Auth info page accessible (HTTP 200)"
else
    echo "    ❌ Auth info page not accessible (HTTP $response)"
fi

# Auth status
echo "  - Auth status:"
curl -s "$BASE_URL/auth/status" | jq '.' || echo "    Response received but not valid JSON"

# Test token endpoint with default credentials
echo "  - Token endpoint with default credentials:"
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "portfolio-api-client",
    "client_secret": "default-client-secret-change-in-production",
    "grant_type": "client_credentials"
  }')

if echo "$TOKEN_RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
    echo "    ✅ Token generation successful"
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
else
    echo "    ❌ Token generation failed"
    echo "    Response: $TOKEN_RESPONSE"
    ACCESS_TOKEN=""
fi

# Test 5: Test with invalid token
echo ""
echo "5. Testing with invalid token..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer invalid-token" \
    "$BASE_URL/api/v1/portfolio/equity")
if [ "$response" = "401" ]; then
    echo "✅ Invalid token correctly rejected (HTTP 401)"
else
    echo "❌ Expected HTTP 401, got HTTP $response"
fi

# Test 7: Test with valid token (if we got one)
if [ -n "$ACCESS_TOKEN" ]; then
    echo ""
    echo "7. Testing API with valid token..."
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$BASE_URL/api/v1/portfolio/equity")
    if [ "$response" = "200" ]; then
        echo "✅ API access with valid token successful (HTTP 200)"
    else
        echo "❌ API access failed (HTTP $response)"
    fi
    
    # Test /auth/me endpoint
    echo "  - Testing /auth/me endpoint:"
    curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/auth/me" | jq '.' || echo "    Response received but not valid JSON"
fi

echo ""
echo "🔗 Manual Authentication Test:"
echo "=================================="
echo "1. Open: $BASE_URL/auth/info"
echo "2. Use the web form to get a token, or use curl:"
echo "3. curl -X POST $BASE_URL/auth/token \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"client_id\":\"portfolio-api-client\",\"client_secret\":\"default-client-secret-change-in-production\",\"grant_type\":\"client_credentials\"}'"
echo "4. Test with: curl -H \"Authorization: Bearer YOUR_TOKEN\" $BASE_URL/api/v1/portfolio/equity"
echo ""
echo "📚 Documentation:"
echo "- Full setup guide: README_AUTH.md"
echo "- Environment config: .env (update with your client credentials)"

# Test 6: Environment check
echo ""
echo "6. Environment Configuration Check:"
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    
    # Check if required variables are set
    if grep -q "DEFAULT_CLIENT_ID=" .env && grep -q "DEFAULT_CLIENT_SECRET=" .env; then
        if grep -q "default-client-secret-change-in-production" .env; then
            echo "⚠️  Default client credentials should be changed for production"
        else
            echo "✅ Client credentials configured"
        fi
    else
        echo "❌ Missing client credentials in .env"
    fi
    
    if grep -q "JWT_SECRET=" .env; then
        if grep -q "your-jwt-secret" .env; then
            echo "⚠️  JWT secret should be updated for security"
        else
            echo "✅ JWT secret configured"
        fi
    else
        echo "❌ Missing JWT_SECRET in .env"
    fi
else
    echo "❌ .env file not found - copy and update with your credentials"
fi

echo ""
echo "🎉 Client Credentials authentication test completed!"
echo ""