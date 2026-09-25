const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',

    info: {
      title: 'QR Loyalty API',
      version: '1.0.0',
      description:
        'API documentation for the QR Loyalty multi-tenant loyalty platform.'
    },

    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server'
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

    tags: [
      {
        name: 'Authentication',
        description: 'Authentication and current-user APIs'
      },
      {
        name: 'Tenants',
        description: 'Vendor management APIs'
      },
      {
        name: 'Loyalty',
        description: 'Loyalty program APIs'
      },
      {
        name: 'Rewards',
        description: 'Reward management APIs'
      },
      {
        name: 'QR Codes',
        description: 'Vendor QR code APIs'
      },
      {
        name: 'Verification',
        description: 'Staff PIN and customer verification APIs'
      },
      {
        name: 'Customers',
        description: 'Customer registration and customer APIs'
      },
      {
        name: 'Stamps',
        description: 'Loyalty stamp APIs'
      }
    ]
  },

  apis: [
    './src/routes/*.js',
    './src/server.js'
  ]
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;