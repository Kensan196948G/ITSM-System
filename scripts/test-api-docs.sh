#!/bin/bash
#
# APIドキュメントエンドポイントのテストスクリプト
#
# 使用方法:
#   ./scripts/test-api-docs.sh
#

set -e

BASE_URL="${1:-https://localhost:5443}"
INSECURE_FLAG="-k"

echo "========================================="
echo "ITSM API Documentation Test"
echo "========================================="
echo "Base URL: $BASE_URL"
echo ""

# 色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# テスト関数
test_endpoint() {
    local url=$1
    local description=$2
    local expected_pattern=$3

    echo -n "Testing: $description ... "

    response=$(curl -s $INSECURE_FLAG "$url")

    if echo "$response" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected pattern: $expected_pattern"
        echo "  Response: ${response:0:100}..."
        return 1
    fi
}

test_json_endpoint() {
    local url=$1
    local description=$2
    local jq_query=$3

    echo -n "Testing: $description ... "

    response=$(curl -s $INSECURE_FLAG "$url")

    if echo "$response" | jq -e "$jq_query" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        result=$(echo "$response" | jq -r "$jq_query" 2>/dev/null)
        if [ -n "$result" ] && [ "$result" != "null" ]; then
            echo "  Result: $result"
        fi
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  JQ Query: $jq_query"
        return 1
    fi
}

# サーバーが起動しているか確認
echo -n "Checking server status ... "
if curl -s $INSECURE_FLAG "$BASE_URL/api/v1/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running${NC}"
    echo "Please start the server with: npm start"
    exit 1
fi

echo ""

# APIドキュメントエンドポイントのテスト
echo "--- HTML Endpoints ---"
test_endpoint "$BASE_URL/api-docs" "Landing Page" "ITSM-Sec Nexus API"
test_endpoint "$BASE_URL/api-docs/swagger" "Swagger UI" "swagger-ui"
test_endpoint "$BASE_URL/api-docs/redoc" "ReDoc" "redoc"
test_endpoint "$BASE_URL/api-docs/examples" "Sample Code" "サンプルコード"

echo ""
echo "--- JSON Endpoints ---"
test_json_endpoint "$BASE_URL/api-docs/openapi.json" "OpenAPI JSON" '.info.title'
test_json_endpoint "$BASE_URL/api-docs/swagger.json" "Swagger JSON (compatibility)" '.info.version'
test_json_endpoint "$BASE_URL/api-docs/postman-collection.json" "Postman Collection" '.info.schema'

echo ""
echo "--- Postman Collection Details ---"
test_json_endpoint "$BASE_URL/api-docs/postman-collection.json" "Collection Name" '.info.name'
test_json_endpoint "$BASE_URL/api-docs/postman-collection.json" "Collection Version" '.info.version'
test_json_endpoint "$BASE_URL/api-docs/postman-collection.json" "Number of Folders" '.item | length'

echo ""
echo "--- OpenAPI Specification Details ---"
test_json_endpoint "$BASE_URL/api-docs/openapi.json" "API Title" '.info.title'
test_json_endpoint "$BASE_URL/api-docs/openapi.json" "API Version" '.info.version'
test_json_endpoint "$BASE_URL/api-docs/openapi.json" "Number of Tags" '.tags | length'
test_json_endpoint "$BASE_URL/api-docs/openapi.json" "Number of Paths" '.paths | length'

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="

# 統計情報
folders=$(curl -s $INSECURE_FLAG "$BASE_URL/api-docs/postman-collection.json" | jq -r '.item | length')
total_requests=$(curl -s $INSECURE_FLAG "$BASE_URL/api-docs/postman-collection.json" | jq '[.item[].item | length] | add')
api_paths=$(curl -s $INSECURE_FLAG "$BASE_URL/api-docs/openapi.json" | jq '.paths | length')

echo "Postman Collection:"
echo "  - Folders: $folders"
echo "  - Total Requests: $total_requests"
echo ""
echo "OpenAPI Specification:"
echo "  - Total Paths: $api_paths"
echo ""

echo -e "${GREEN}All tests completed!${NC}"
echo ""
echo "Access the API documentation at:"
echo "  Landing Page: $BASE_URL/api-docs"
echo "  Swagger UI:   $BASE_URL/api-docs/swagger"
echo "  ReDoc:        $BASE_URL/api-docs/redoc"
echo "  Examples:     $BASE_URL/api-docs/examples"
