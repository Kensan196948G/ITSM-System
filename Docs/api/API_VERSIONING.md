# API Versioning Guide

## Overview

ITSM-Sec Nexus API uses semantic versioning with multiple version declaration methods for backward compatibility.

## Current Version

- **Current Version**: v1
- **Supported Versions**: v1
- **Default Version**: v1

## Version Declaration Methods

The API supports four methods to specify the version (in order of priority):

### 1. URL Path (Recommended)
```
GET /api/v1/incidents
GET /api/v1/users
```

### 2. X-API-Version Header
```http
GET /api/incidents
X-API-Version: 1
```

### 3. Accept Header
```http
GET /api/incidents
Accept: application/vnd.itsm+json;version=1
```

### 4. Query Parameter
```
GET /api/incidents?api-version=1
```

## Response Headers

All API responses include versioning headers:

| Header | Description | Example |
|--------|-------------|---------|
| X-API-Version | Version used for the response | v1 |
| X-API-Supported-Versions | All supported versions | v1 |
| X-API-Current-Version | Latest stable version | v1 |

## Deprecation Warnings

When endpoints are deprecated, additional headers are included:

| Header | Description | Example |
|--------|-------------|---------|
| Deprecation | Indicates endpoint is deprecated | true |
| Sunset | Date when endpoint will be removed | 2026-06-01 |
| Link | URL to replacement endpoint | `</api/v2/users>; rel="successor-version"` |

### Deprecated Response Body

Deprecated endpoints include a warning in the response:

```json
{
  "data": [...],
  "_deprecationWarning": {
    "deprecated": true,
    "sunset": "2026-06-01",
    "alternative": "/api/v2/users",
    "message": "This endpoint is deprecated. Please migrate to v2."
  }
}
```

## Rate Limiting

### Rate Limit Headers
All responses include rate limit information:

| Header | Description |
|--------|-------------|
| X-RateLimit-Limit | Maximum requests per window |
| X-RateLimit-Remaining | Requests remaining |
| X-RateLimit-Reset | Unix timestamp when limit resets |

### Rate Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication (login) | 5 requests | 15 minutes |
| Registration | 3 requests | 1 hour |
| 2FA Verification | 5 requests | 5 minutes |
| Sensitive Operations | 10 requests | 1 hour |

### Rate Limit Response (429)
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| HTTP Status | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Versioning Best Practices

### For API Consumers

1. **Always specify version** - Use URL path versioning for clarity
2. **Check deprecation headers** - Monitor for deprecation warnings
3. **Handle version errors** - Implement fallback logic
4. **Subscribe to changelog** - Stay informed about version changes

### For API Developers

1. **Never break v1** - Maintain backward compatibility
2. **Use deprecation warnings** - Give clients time to migrate
3. **Document changes** - Update changelog for each change
4. **Version new features** - Add new endpoints to appropriate version

## Migration Guide

### When Migrating Between Versions

1. Check the changelog for breaking changes
2. Update API URLs or version headers
3. Test thoroughly in development environment
4. Monitor for deprecated endpoints
5. Update client code as needed

## Code Examples

### JavaScript (Fetch)
```javascript
// Using URL path versioning
const response = await fetch('/api/v1/incidents', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
});

// Check for deprecation
if (response.headers.get('Deprecation') === 'true') {
  console.warn('Endpoint deprecated. Sunset:', response.headers.get('Sunset'));
}
```

### Python (Requests)
```python
import requests

# Using header versioning
response = requests.get(
    'https://api.example.com/api/incidents',
    headers={
        'Authorization': f'Bearer {token}',
        'X-API-Version': '1'
    }
)

# Check rate limits
remaining = response.headers.get('X-RateLimit-Remaining')
if int(remaining) < 10:
    print(f'Warning: Only {remaining} requests remaining')
```

### cURL
```bash
# Using URL path versioning
curl -X GET "https://api.example.com/api/v1/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Using header versioning
curl -X GET "https://api.example.com/api/incidents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-API-Version: 1" \
  -H "Content-Type: application/json"
```

## Changelog

### v1 (Current)
- Initial release
- All ITSM core endpoints
- JWT authentication with refresh tokens
- Rate limiting
- RBAC (Role-Based Access Control)

### Future Versions
- v2 (Planned): GraphQL support, enhanced filtering
