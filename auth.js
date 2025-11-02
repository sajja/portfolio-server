require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

// Authentication Configuration
const AUTH_CONFIG = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  clients: {
    defaultClientId: process.env.DEFAULT_CLIENT_ID || 'portfolio-api-client',
    defaultClientSecret: process.env.DEFAULT_CLIENT_SECRET || 'default-client-secret-change-in-production'
  }
};

// Initialize clients table for API authentication
db.run(`
  CREATE TABLE IF NOT EXISTS api_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE NOT NULL,
    client_secret_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    permissions TEXT DEFAULT 'read,write'
  )
`, (err) => {
  if (err) {
    console.error('Error creating api_clients table:', err);
  } else {
    console.log('API clients table ready');
    
    // Create default client if it doesn't exist
    createDefaultClient();
  }
});

// Initialize access tokens table for tracking active tokens
db.run(`
  CREATE TABLE IF NOT EXISTS access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_revoked BOOLEAN DEFAULT 0,
    FOREIGN KEY (client_id) REFERENCES api_clients(client_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating access_tokens table:', err);
  } else {
    console.log('Access tokens table ready');
  }
});

// Hash client secret
function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

// Create default client
function createDefaultClient() {
  const clientId = AUTH_CONFIG.clients.defaultClientId;
  const clientSecret = AUTH_CONFIG.clients.defaultClientSecret;
  
  db.get('SELECT client_id FROM api_clients WHERE client_id = ?', [clientId], (err, existing) => {
    if (err) {
      console.error('Error checking default client:', err);
      return;
    }
    
    if (!existing) {
      const hashedSecret = hashSecret(clientSecret);
      db.run(
        'INSERT INTO api_clients (client_id, client_secret_hash, name, description) VALUES (?, ?, ?, ?)',
        [clientId, hashedSecret, 'Default Portfolio API Client', 'Default client for Portfolio API access'],
        function(err) {
          if (err) {
            console.error('Error creating default client:', err);
          } else {
            console.log(`Default API client created: ${clientId}`);
            console.log(`Default client secret: ${clientSecret}`);
            console.log('⚠️  Change the default client secret in production!');
          }
        }
      );
    }
  });
}

// Authenticate client credentials
async function authenticateClient(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM api_clients WHERE client_id = ? AND is_active = 1',
      [clientId],
      (err, client) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!client) {
          resolve(null);
          return;
        }
        
        const hashedSecret = hashSecret(clientSecret);
        if (client.client_secret_hash === hashedSecret) {
          // Update last used timestamp
          db.run('UPDATE api_clients SET last_used = CURRENT_TIMESTAMP WHERE id = ?', [client.id]);
          resolve(client);
        } else {
          resolve(null);
        }
      }
    );
  });
}

// Generate JWT token for API access
function generateJWT(client, tokenId) {
  const payload = {
    sub: client.client_id, // Subject (client ID)
    client_name: client.name,
    permissions: client.permissions ? client.permissions.split(',') : ['read', 'write'],
    jti: tokenId, // JWT ID for token tracking
    iat: Math.floor(Date.now() / 1000), // Issued at
    iss: 'portfolio-api' // Issuer
  };
  
  return jwt.sign(payload, AUTH_CONFIG.jwt.secret, {
    expiresIn: AUTH_CONFIG.jwt.expiresIn
  });
}

// Verify JWT token
function verifyJWT(token) {
  try {
    return jwt.verify(token, AUTH_CONFIG.jwt.secret);
  } catch (error) {
    return null;
  }
}

// Generate unique token ID
function generateTokenId() {
  return crypto.randomBytes(16).toString('hex');
}

// Store token in database for tracking
function storeToken(tokenId, clientId, expiresIn) {
  const expiresAt = new Date();
  
  // Parse expires in (e.g., "24h", "1d", "2w")
  const timeValue = parseInt(expiresIn.slice(0, -1));
  const timeUnit = expiresIn.slice(-1);
  
  switch (timeUnit) {
    case 'h': expiresAt.setHours(expiresAt.getHours() + timeValue); break;
    case 'd': expiresAt.setDate(expiresAt.getDate() + timeValue); break;
    case 'w': expiresAt.setDate(expiresAt.getDate() + (timeValue * 7)); break;
    default: expiresAt.setHours(expiresAt.getHours() + 24); // Default 24h
  }
  
  db.run(
    'INSERT INTO access_tokens (token_id, client_id, expires_at) VALUES (?, ?, ?)',
    [tokenId, clientId, expiresAt.toISOString()],
    (err) => {
      if (err) console.error('Error storing token:', err);
    }
  );
}

// Check if token is revoked
function isTokenRevoked(tokenId, callback) {
  db.get(
    'SELECT is_revoked, expires_at FROM access_tokens WHERE token_id = ?',
    [tokenId],
    (err, token) => {
      if (err) {
        callback(err, true);
        return;
      }
      
      if (!token) {
        callback(null, true); // Token not found, consider revoked
        return;
      }
      
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      
      // Check if token is revoked or expired
      const revoked = token.is_revoked || now > expiresAt;
      callback(null, revoked);
    }
  );
}

// Middleware to authenticate API requests
function authenticateAPI(req, res, next) {
  // Check for JWT token in Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid Bearer token in Authorization header',
      hint: 'Use: curl -H "Authorization: Bearer YOUR_TOKEN" ...'
    });
  }
  
  const decoded = verifyJWT(token);
  if (!decoded) {
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      message: 'Please obtain a new access token'
    });
  }
  
  // Check if token is revoked
  isTokenRevoked(decoded.jti, (err, revoked) => {
    if (err) {
      return res.status(500).json({ error: 'Token validation error' });
    }
    
    if (revoked) {
      return res.status(401).json({ 
        error: 'Token revoked or expired',
        message: 'Please obtain a new access token'
      });
    }
    
    // Check if client is still active
    db.get('SELECT * FROM api_clients WHERE client_id = ? AND is_active = 1', [decoded.sub], (err, client) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!client) {
        return res.status(401).json({ 
          error: 'Client not found or inactive',
          message: 'Client has been deactivated'
        });
      }
      
      // Attach client info to request
      req.client = {
        id: client.client_id,
        name: client.name,
        permissions: decoded.permissions || ['read', 'write']
      };
      
      next();
    });
  });
}

// Revoke token
function revokeToken(tokenId, callback) {
  db.run(
    'UPDATE access_tokens SET is_revoked = 1 WHERE token_id = ?',
    [tokenId],
    function(err) {
      callback(err, this.changes);
    }
  );
}

// Create new API client
function createClient(clientData, callback) {
  const clientId = clientData.client_id || `client-${crypto.randomBytes(8).toString('hex')}`;
  const clientSecret = clientData.client_secret || crypto.randomBytes(32).toString('hex');
  const hashedSecret = hashSecret(clientSecret);
  
  db.run(
    'INSERT INTO api_clients (client_id, client_secret_hash, name, description, permissions) VALUES (?, ?, ?, ?, ?)',
    [clientId, hashedSecret, clientData.name, clientData.description, clientData.permissions || 'read,write'],
    function(err) {
      if (err) {
        callback(err, null);
        return;
      }
      
      callback(null, {
        id: this.lastID,
        client_id: clientId,
        client_secret: clientSecret, // Return plaintext secret only on creation
        name: clientData.name,
        description: clientData.description,
        permissions: clientData.permissions || 'read,write'
      });
    }
  );
}

module.exports = {
  AUTH_CONFIG,
  authenticateClient,
  generateJWT,
  generateTokenId,
  storeToken,
  verifyJWT,
  authenticateAPI,
  revokeToken,
  createClient,
  isTokenRevoked
};