# Authentication and Token Management

## Overview

ITSM-Sec Nexus uses a secure JWT-based authentication system with refresh token rotation for session management.

## Token Types

### Access Token (JWT)
- **Purpose**: Short-lived token for API authentication
- **Expiration**: 1 hour (configurable via `JWT_EXPIRES_IN`)
- **Storage**: HttpOnly cookie (`token`) or Authorization header
- **Contains**: User ID, username, email, role, JTI (JWT ID)

### Refresh Token
- **Purpose**: Long-lived token for obtaining new access tokens
- **Expiration**: 7 days (configurable via `REFRESH_TOKEN_EXPIRES_DAYS`)
- **Storage**: HttpOnly cookie (`refreshToken`) with path restriction to `/auth`
- **Security**: Stored as SHA-256 hash in database, rotated on each use

## Authentication Flow

### Login Flow
```
Client                    Server
   |                         |
   |-- POST /api/v1/auth/login -->
   |   (username, password)  |
   |                         |
   |<-- 200 OK --------------|
   |   Set-Cookie: token     |
   |   Set-Cookie: refreshToken
   |   { user, expiresAt }   |
```

### Token Refresh Flow
```
Client                    Server
   |                         |
   |-- POST /api/v1/auth/refresh -->
   |   Cookie: refreshToken  |
   |                         |
   |<-- 200 OK --------------|
   |   Set-Cookie: token (new)
   |   Set-Cookie: refreshToken (rotated)
   |   { user, expiresAt }   |
```

### Logout Flow
```
Client                    Server
   |                         |
   |-- POST /api/v1/auth/logout -->
   |   Cookie: token         |
   |   ?allDevices=true      |
   |                         |
   |<-- 200 OK --------------|
   |   Clear-Cookie: token   |
   |   Clear-Cookie: refreshToken
   |   Token blacklisted     |
```

## Security Features

### JWT Blacklisting
- Each JWT contains a unique JTI (JWT ID)
- On logout, JTI is added to `token_blacklist` table
- All requests check blacklist before granting access
- Blacklist entries auto-expire based on original token expiration

### Refresh Token Rotation
- Each refresh token belongs to a "family" tracked by `family_id`
- When a refresh token is used, a new token is issued and old one is invalidated
- If a previously-used token is detected (replay attack), entire family is revoked
- Protects against token theft and replay attacks

### Session Management
- Users can view active sessions via `GET /api/v1/auth/sessions`
- Sessions include device info and IP address
- Users can logout from all devices via `POST /api/v1/auth/logout?allDevices=true`

## API Endpoints

### POST /api/v1/auth/login
Login with username and password.

**Request:**
```json
{
  "username": "string",
  "password": "string",
  "totpToken": "string (optional, for 2FA)"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "JWT access token",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  "expiresAt": "2026-01-18T15:00:00.000Z"
}
```

### POST /api/v1/auth/refresh
Refresh access token using refresh token.

**Response (200):**
```json
{
  "message": "Token refreshed",
  "token": "New JWT access token",
  "user": { ... },
  "expiresAt": "2026-01-18T16:00:00.000Z"
}
```

### POST /api/v1/auth/logout
Logout and invalidate tokens.

**Query Parameters:**
- `allDevices=true` - Logout from all devices

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### GET /api/v1/auth/sessions
Get list of active sessions for current user.

**Response (200):**
```json
{
  "sessions": [
    {
      "id": 1,
      "device_info": "Mozilla/5.0...",
      "ip_address": "192.168.0.100",
      "created_at": "2026-01-18T10:00:00.000Z",
      "last_used_at": "2026-01-18T14:00:00.000Z"
    }
  ],
  "count": 1
}
```

## Database Schema

### token_blacklist
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| jti | VARCHAR(64) | JWT ID (unique) |
| user_id | INTEGER | User ID |
| expires_at | TIMESTAMP | Original token expiration |
| blacklisted_at | TIMESTAMP | When token was blacklisted |
| reason | ENUM | logout, password_change, admin_revoke, security_concern |
| ip_address | VARCHAR(45) | Client IP address |

### refresh_tokens
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | User ID |
| token_hash | VARCHAR(64) | SHA-256 hash of token |
| family_id | VARCHAR(36) | Token family UUID |
| device_info | VARCHAR(255) | User-Agent string |
| ip_address | VARCHAR(45) | Client IP address |
| expires_at | TIMESTAMP | Token expiration |
| is_revoked | BOOLEAN | Whether token is revoked |
| revoked_at | TIMESTAMP | When token was revoked |
| revoke_reason | VARCHAR(50) | Reason for revocation |
| last_used_at | TIMESTAMP | Last usage time |
| created_at | TIMESTAMP | Creation time |

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_DAYS=7
```

## Best Practices

1. **Never store tokens in localStorage** - Use HttpOnly cookies
2. **Implement token refresh** - Refresh before expiration
3. **Handle 401 errors** - Redirect to login on token expiration
4. **Use HTTPS** - Required for secure cookie transmission
5. **Implement logout** - Always call logout endpoint when user logs out

## Security Considerations

- Access tokens have short expiration (1 hour)
- Refresh tokens are rotated on each use
- Token blacklisting prevents use of revoked tokens
- All tokens are transmitted via HttpOnly cookies
- CORS is configured to prevent unauthorized origins
- Rate limiting protects against brute force attacks
