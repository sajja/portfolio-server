# Portfolio API with Client Credentials Authentication

A secure portfolio management API with client credentials authentication for API-to-API access.

## Features

- **Client Credentials Authentication** with JWT tokens
- **Bearer Token API Access** 
- **Portfolio Management** (stocks, bonds, FDs, etc.)
- **Expense Tracking** with categorization
- **Real-time Stock Data** from CSE API
- **Comprehensive API Documentation**

## 🔐 Authentication Setup

### 1. Client Credentials Configuration

The API uses client credentials flow for authentication, which is ideal for:
- API-to-API communication
- Server-to-server authentication
- Applications without user interaction
- Automated systems and scripts

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
# Client Credentials Configuration
DEFAULT_CLIENT_ID=default-client
DEFAULT_CLIENT_SECRET=default-client-secret-change-in-production

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Environment
NODE_ENV=development
```

### 3. Generate Secure Secrets

```bash
# Generate JWT secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate client secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Installation & Setup

```bash
# Install dependencies
npm install

# Set up environment variables (see above)
# Create .env file and update with your values

# Start the server
npm start
```

## 🔑 Authentication Flow

### 1. Get Access Token

Use client credentials to obtain a JWT access token:

```bash
curl -X POST http://localhost:3000/auth/token \
     -H "Content-Type: application/json" \
     -d '{
       "client_id": "portfolio-api-client",
       "client_secret": "default-client-secret-change-in-production",
       "grant_type": "client_credentials"
     }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

### 2. Use Token for API Access

Include the JWT token in your API requests:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/v1/portfolio/equity
```

## 📚 API Endpoints

### Authentication Endpoints

- `POST /auth/token` - Get access token with client credentials
- `GET /auth/info` - Authentication info page  
- `GET /auth/me` - Get token info (requires auth)
- `POST /auth/revoke` - Revoke access token (requires auth)

### Portfolio Endpoints (🔒 Auth Required)

- `GET /api/v1/portfolio/equity` - Get all stocks
- `POST /api/v1/portfolio/equity/:symbol/buy` - Buy stock
- `POST /api/v1/portfolio/equity/:symbol/sell` - Sell stock
- `POST /api/v1/portfolio/equity/:symbol` - Update stock comment
- `GET /api/v1/portfolio/summary` - Portfolio summary
- `PUT /api/v1/portfolio/equity/:symbol/dividend` - Record dividend

### Expense Endpoints (🔒 Auth Required)

- `POST /api/v1/expense` - Record expense
- `GET /api/v1/expense` - Get expenses (current month)
- `GET /api/v1/expense/summary` - Expense summary (last 3 months)
- `GET /api/v1/expense/categories` - Get categories
- `PUT /api/v1/expense/:uuid` - Update expense
- `DELETE /api/v1/expense/:uuid` - Delete expense

## 🔐 Security Features

- **JWT Token Authentication** with configurable expiration
- **Client Credentials Flow** for secure API-to-API authentication
- **SQLite Storage** for client credentials and token management
- **Environment Variables** for sensitive configuration
- **CORS Headers** with Authorization support
- **Token Revocation** capability

## 📖 Usage Examples

### Get Authentication Token

```bash
# Get access token
curl -X POST http://localhost:3000/auth/token \
     -H "Content-Type: application/json" \
     -d '{
       "client_id": "portfolio-api-client",
       "client_secret": "default-client-secret-change-in-production",
       "grant_type": "client_credentials"
     }'
```

### Use API with Token

```bash
# Set your token (from the response above)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get portfolio
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/v1/portfolio/equity

# Record expense
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "uuid": "123e4567-e89b-12d3-a456-426614174000",
       "date": "2025-11-01",
       "category": "Food",
       "subcategory": "Restaurants", 
       "amount": 25.50,
       "description": "Lunch"
     }' \
     http://localhost:3000/api/v1/expense

# Get expense summary
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/v1/expense/summary
```

## 🛠️ Development

### Database Tables

The authentication system creates these tables:

```sql
-- Client credentials storage
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Access token management
CREATE TABLE access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  access_token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN DEFAULT 0,
  FOREIGN KEY (client_id) REFERENCES clients (client_id)
);
```

### Token Verification

```javascript
// Middleware automatically verifies Bearer tokens
// Access client info via req.client in protected routes
app.get('/protected', authenticateAPI, (req, res) => {
  res.json({ client: req.client });
});
```

## 🔒 Production Deployment

1. **Update Environment Variables**:
   - Generate strong, unique client secrets
   - Use a secure JWT secret
   - Set `NODE_ENV=production`

2. **Client Management**:
   - Create production-specific client credentials
   - Remove or disable default clients
   - Use descriptive client names for tracking

3. **Database Security**:
   - Use environment-specific database files
   - Regular backups
   - Access controls
   - Monitor token usage and revoke suspicious tokens

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid client credentials" error**
   - Check DEFAULT_CLIENT_ID and DEFAULT_CLIENT_SECRET in .env
   - Verify client exists in database
   - Ensure client is active (is_active = 1)

2. **"Token expired" error**
   - Get a new token using POST /auth/token
   - Check JWT_EXPIRES_IN configuration
   - Verify server system time is correct

3. **"Client not found" error**
   - Check if client was deactivated
   - Verify client_id spelling
   - Check database clients table

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm start
```

## 📄 License

MIT License - see LICENSE file for details.