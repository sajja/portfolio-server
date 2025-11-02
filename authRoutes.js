const express = require('express');
const router = express.Router();
const { 
  authenticateClient, 
  generateJWT, 
  generateTokenId, 
  storeToken, 
  authenticateAPI,
  revokeToken,
  createClient,
  AUTH_CONFIG
} = require('./auth');

// POST /auth/token - Get access token using client credentials
router.post('/token', async (req, res) => {
  const { client_id, client_secret, grant_type } = req.body;
  
  // Validate grant type
  if (grant_type !== 'client_credentials') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only client_credentials grant type is supported'
    });
  }
  
  // Validate required fields
  if (!client_id || !client_secret) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'client_id and client_secret are required'
    });
  }
  
  try {
    // Authenticate client
    const client = await authenticateClient(client_id, client_secret);
    
    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }
    
    // Generate token ID and JWT
    const tokenId = generateTokenId();
    const accessToken = generateJWT(client, tokenId);
    
    // Store token for tracking
    storeToken(tokenId, client_id, AUTH_CONFIG.jwt.expiresIn);
    
    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours in seconds
      scope: client.permissions || 'read write',
      client_id: client.client_id,
      client_name: client.name
    });
    
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

// GET /auth/info - Get authentication info page
router.get('/info', (req, res) => {
  const defaultClientId = AUTH_CONFIG.clients.defaultClientId;
  const defaultClientSecret = AUTH_CONFIG.clients.defaultClientSecret;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Portfolio API - Authentication</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 2rem; 
                background-color: #f5f5f5;
            }
            .container { 
                background: white; 
                padding: 2rem; 
                border-radius: 8px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .code-block { 
                background: #f8f9fa; 
                border: 1px solid #dee2e6; 
                border-radius: 4px; 
                padding: 1rem; 
                margin: 1rem 0; 
                font-family: monospace;
                font-size: 14px;
                white-space: pre-wrap;
                overflow-x: auto;
            }
            .form-group { 
                margin: 1rem 0; 
            }
            .form-group label { 
                display: block; 
                margin-bottom: 0.5rem; 
                font-weight: bold;
            }
            .form-group input { 
                width: 100%; 
                padding: 0.5rem; 
                border: 1px solid #ccc; 
                border-radius: 4px;
                font-family: monospace;
            }
            .btn { 
                background: #007bff; 
                color: white; 
                border: none; 
                padding: 0.75rem 1.5rem; 
                border-radius: 4px; 
                cursor: pointer; 
                font-size: 1rem;
            }
            .btn:hover { 
                background: #0056b3; 
            }
            .success { 
                background: #d4edda; 
                border: 1px solid #c3e6cb; 
                color: #155724; 
                padding: 1rem; 
                border-radius: 4px; 
                margin: 1rem 0;
            }
            .error { 
                background: #f8d7da; 
                border: 1px solid #f5c6cb; 
                color: #721c24; 
                padding: 1rem; 
                border-radius: 4px; 
                margin: 1rem 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔑 Portfolio API Authentication</h1>
            
            <h2>Client Credentials Flow</h2>
            <p>This API uses client credentials for authentication. You need a <code>client_id</code> and <code>client_secret</code> to obtain an access token.</p>
            
            <h3>Default Credentials (Development)</h3>
            <div class="code-block">Client ID: ${defaultClientId}
Client Secret: ${defaultClientSecret}

⚠️  Change these credentials in production!</div>
            
            <h3>Get Access Token</h3>
            <form id="tokenForm">
                <div class="form-group">
                    <label>Client ID:</label>
                    <input type="text" id="client_id" value="${defaultClientId}" required>
                </div>
                <div class="form-group">
                    <label>Client Secret:</label>
                    <input type="password" id="client_secret" value="${defaultClientSecret}" required>
                </div>
                <button type="submit" class="btn">Get Access Token</button>
            </form>
            
            <div id="result"></div>
            
            <h3>Example curl command:</h3>
            <div class="code-block">curl -X POST http://localhost:3000/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "${defaultClientId}",
    "client_secret": "${defaultClientSecret}", 
    "grant_type": "client_credentials"
  }'</div>
            
            <h3>Using the Access Token:</h3>
            <div class="code-block">curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  http://localhost:3000/api/v1/portfolio/equity</div>
        </div>
        
        <script>
            document.getElementById('tokenForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const clientId = document.getElementById('client_id').value;
                const clientSecret = document.getElementById('client_secret').value;
                const resultDiv = document.getElementById('result');
                
                try {
                    const response = await fetch('/auth/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            client_id: clientId,
                            client_secret: clientSecret,
                            grant_type: 'client_credentials'
                        }),
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        resultDiv.innerHTML = \`
                            <div class="success">
                                <h4>✅ Access Token Generated Successfully!</h4>
                                <p><strong>Access Token:</strong></p>
                                <div class="code-block">\${data.access_token}</div>
                                <p><strong>Expires in:</strong> \${data.expires_in} seconds (24 hours)</p>
                                <p><strong>Token Type:</strong> \${data.token_type}</p>
                                <p><strong>Scope:</strong> \${data.scope}</p>
                            </div>
                        \`;
                    } else {
                        resultDiv.innerHTML = \`
                            <div class="error">
                                <h4>❌ Authentication Failed</h4>
                                <p><strong>Error:</strong> \${data.error}</p>
                                <p><strong>Description:</strong> \${data.error_description}</p>
                            </div>
                        \`;
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="error">
                            <h4>❌ Request Failed</h4>
                            <p>Network error: \${error.message}</p>
                        </div>
                    \`;
                }
            });
        </script>
    </body>
    </html>
  `);
});

// GET /auth/me - Get current client info (requires authentication)
router.get('/me', authenticateAPI, (req, res) => {
  res.json({
    client: {
      id: req.client.id,
      name: req.client.name,
      permissions: req.client.permissions
    },
    token_info: {
      type: 'Bearer',
      scope: req.client.permissions.join(' ')
    }
  });
});

// POST /auth/revoke - Revoke access token
router.post('/revoke', authenticateAPI, (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'token parameter is required'
    });
  }
  
  // Extract token from Authorization header if not provided in body
  const tokenToRevoke = token || (req.headers.authorization ? req.headers.authorization.substring(7) : null);
  
  if (!tokenToRevoke) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'No token provided'
    });
  }
  
  // Verify and extract token ID
  const { verifyJWT } = require('./auth');
  const decoded = verifyJWT(tokenToRevoke);
  
  if (!decoded || !decoded.jti) {
    return res.status(400).json({
      error: 'invalid_token',
      error_description: 'Invalid token format'
    });
  }
  
  revokeToken(decoded.jti, (err, changes) => {
    if (err) {
      return res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to revoke token'
      });
    }
    
    res.json({
      message: 'Token revoked successfully',
      revoked: changes > 0
    });
  });
});

// POST /auth/clients - Create new API client (admin endpoint)
router.post('/clients', (req, res) => {
  const { name, description, permissions } = req.body;
  
  if (!name) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Client name is required'
    });
  }
  
  const clientData = {
    name: name.trim(),
    description: description ? description.trim() : null,
    permissions: permissions || 'read,write'
  };
  
  createClient(clientData, (err, client) => {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({
          error: 'client_exists',
          error_description: 'Client with this ID already exists'
        });
      }
      
      return res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to create client'
      });
    }
    
    res.status(201).json({
      message: 'Client created successfully',
      client_id: client.client_id,
      client_secret: client.client_secret, // Only shown once on creation
      name: client.name,
      description: client.description,
      permissions: client.permissions,
      warning: 'Store the client_secret securely. It will not be shown again.'
    });
  });
});

// GET /auth/status - Check API status and authentication info
router.get('/status', (req, res) => {
  res.json({
    api: 'Portfolio API',
    version: '2.0.0',
    authentication: {
      type: 'client_credentials',
      token_endpoint: '/auth/token',
      info_page: '/auth/info'
    },
    endpoints: {
      token: 'POST /auth/token',
      revoke: 'POST /auth/revoke',
      me: 'GET /auth/me',
      info: 'GET /auth/info'
    }
  });
});

module.exports = router;