/**
 * API Client with JWT Authentication
 * 認証付きAPIクライアント
 */

import { API_BASE } from '../config/constants.js';

/**
 * API Client Class
 */
export class ApiClient {
  /**
   * Make authenticated API call
   * @param {string} endpoint - API endpoint (e.g., '/incidents')
   * @param {object} options - Fetch options
   * @returns {Promise<any>}
   */
  async call(endpoint, options = {}) {
    // JWT はHttpOnly Cookie で管理するため localStorage からは読まない
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include', // HttpOnly Cookie を自動送信
        headers
      });

      // Handle authentication errors
      if (response.status === 401) {
        console.warn('Unauthorized: Token may be expired');
        // Import dynamically to avoid circular dependency
        const { handleUnauthorized } = await import('./auth.js');
        handleUnauthorized();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'API Error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<any>}
   */
  async get(endpoint) {
    return this.call(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body
   * @returns {Promise<any>}
   */
  async post(endpoint, data) {
    return this.call(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body
   * @returns {Promise<any>}
   */
  async put(endpoint, data) {
    return this.call(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<any>}
   */
  async delete(endpoint) {
    return this.call(endpoint, { method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Backward compatibility: グローバル変数として公開（非推奨）
if (typeof window !== 'undefined') {
  window.apiClient = apiClient;
}
