/**
 * Knex database instance
 * Shared knex instance across the application
 */

const knex = require('knex');
const knexConfig = require('../knexfile');

// Use environment-specific configuration
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

const instance = knex(config);

module.exports = instance;
