const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ITSM-Sec Nexus API',
      version: '1.0.0',
      description: 'IT Service Management System API - ITIL準拠の統合ITSM API',
      contact: {
        name: 'ITSM Development Team',
        email: 'dev@itsm.local'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: '開発環境'
      },
      {
        url: 'http://192.168.0.187:5000/api/v1',
        description: 'ローカルネットワーク'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./backend/server.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
