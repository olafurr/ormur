'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _queryBuilder = require('./queryBuilder');

var _queryBuilder2 = _interopRequireDefault(_queryBuilder);

var _relationTypes = require('./relationTypes');

var _relationTypes2 = _interopRequireDefault(_relationTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

module.exports = function (knex) {
	var BaseModel = function () {
		function BaseModel() {
			_classCallCheck(this, BaseModel);
		}

		_createClass(BaseModel, null, [{
			key: 'hasOne',
			value: function hasOne(model, key, alias) {
				this._addRelation(_relationTypes2.default.hasOne, model, key, alias);
			}
		}, {
			key: 'belongsTo',
			value: function belongsTo(model, key, alias) {
				this._addRelation(_relationTypes2.default.belongsTo, model, key, alias);
			}
		}, {
			key: 'hasMany',
			value: function hasMany(model, key, alias) {
				this._addRelation(_relationTypes2.default.hasMany, model, key, alias);
			}
		}, {
			key: 'belongsToMany',
			value: function belongsToMany(model, key, alias, throughTable) {
				this._addRelation(_relationTypes2.default.belongsToMany, model, key, alias, throughTable);
			}

			/*
       this.relations
   	    {   
   		        [tableName]: {
               [alias || tableName]: {
                   foreignKey: foreignKey,
                   relation: REL
               }
           }
           images: {
               lowResolution: {
                   foreignKey: foreign_key,
                   relation: hasOne
               }
           },
           users: {
               users: {
                   foreignKey: foreign_key,
                   relation: belongsTo
               }
           }
   	    }
   		 */

		}, {
			key: '_addRelation',
			value: function _addRelation(type, table, key, alias, throughTable) {

				if (typeof alias === 'undefined' || alias === null) {
					alias = table;
				} else if (alias.prototype instanceof this) {
					throughTable = alias;
				}

				// if (!(alias.prototype instanceof this)) {
				//     throw new Error('Through table must be an instance of BaseModel');
				// }

				if (!this.relations[table]) {
					this.relations[table] = {};
				}

				this.relations[table][alias] = {
					foreignKey: key,
					type: type
				};

				if (throughTable) {
					this.relations[table][alias].throughTable = throughTable;
				}
			}
		}, {
			key: 'getRelation',
			value: function getRelation(table, alias) {

				if (!this.relations[table]) {
					throw new Error(table + ' is not associated with ' + this.tableName);
				}

				return this.relations[table][alias || table] || this.relations[table][table];
			}
		}, {
			key: '$as',
			value: function $as(alias) {
				this._alias = alias;
				return this;
			}
		}, {
			key: '$select',
			value: function $select() {
				var args = Array.prototype.slice.call(arguments);
				var columnAliases = this.columns;
				var columns = Object.keys(columnAliases);
				var alias = this._alias || this.tableName;

				var selectColumns = null;

				if (args.length === 1 && _typeof(args[0]) === 'object') {
					(function () {
						var obj = args[0];
						if ('include' in obj) {
							selectColumns = columns.concat(obj.include);
						} else if ('exclude' in obj) {
							selectColumns = columns.filter(function (c) {
								return obj.exclude.indexOf(c) === -1;
							});
						}
					})();
				} else if (args.length === 1 && args[0] === '*') {
					selectColumns = columns;
				} else if (args.length > 1) {
					selectColumns = args;
				}

				var query = knex(this.tableName + ' as ' + alias);

				if (selectColumns) {
					query.select(_queryBuilder2.default.getRawSelectFields(selectColumns, columnAliases, alias, true));
				}

				return new _queryBuilder2.default(query, this.tableName, alias);
			}
		}, {
			key: 'primaryKey',
			get: function get() {
				return 'id';
			}
		}, {
			key: 'tableName',
			get: function get() {
				return '';
			}
		}, {
			key: 'columns',
			get: function get() {
				return {
					id: null,
					created: null,
					updated: null
				};
			}
		}, {
			key: 'virtualAttributes',
			get: function get() {
				return {};
			}
		}]);

		return BaseModel;
	}();

	BaseModel.relations = {};
	_queryBuilder2.default.knex = knex;

	var models;
	_queryBuilder2.default._models = BaseModel._models = models = {};

	var _import = function _import(model) {
		if (!model.tableName) {
			throw new Error('Model must specify tableName');
		}

		if ('execRelations' in model) {
			model.execRelations();
		}

		models[model.tableName] = model;
	};

	return {
		BaseModel: BaseModel,
		QueryBuilder: _queryBuilder2.default,
		import: _import
	};
};