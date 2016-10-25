'use strict';

const knex = require('knex');

exports.isObject = o => o === Object(o) && !Array.isArray(o);