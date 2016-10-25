'use strict';

const utils = require('./utils');
const QueryBuilder = require('./queryBuilder');
const relationTypes = require('./relationTypes');

module.exports = knex => {

	class BaseModel {

		static get primaryKey() {
			return 'id';
		}

		static get tableName() {
			return '';
		}

		static get columns() {
			return {
				id: null,
				created: null,
				updated: null
			};
		}

		static get virtualAttributes() {
			return {};
		}

		static hasOne(model, key, alias) {
			this._addRelation(relationTypes.hasOne, model, key, alias);
		}

		static belongsTo(model, key, alias) {
			this._addRelation(relationTypes.belongsTo, model, key, alias);
		}

		static hasMany(model, key, alias) {
			this._addRelation(relationTypes.hasMany, model, key, alias);
		}

		static belongsToMany(model, key, alias, throughTable) {
			this._addRelation(relationTypes.belongsToMany, model, key, alias, throughTable);
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
		static _addRelation(type, table, key, alias, throughTable) {

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

		static getRelation(table, alias) {

			if (!this.relations[table]) {
				throw new Error(`${table} is not associated with ${this.tableName}`);
			}

			return this.relations[table][alias || table] || this.relations[table][table];
		}


		static $as(alias) {
			this._alias = alias;
			return this;
		}

		static $select() {
			const args = Array.prototype.slice.call(arguments);
			const columnAliases = this.columns;
			const columns = Object.keys(columnAliases);
			const alias = this._alias || this.tableName;

			let selectColumns = null;

			if (args.length === 1 && typeof args[0] === 'object') {
				const obj = args[0];
				if ('include' in obj) {
					selectColumns = columns.concat(obj.include);
				} else if ('exclude' in obj) {
					selectColumns = columns.filter(c => {
						return obj.exclude.indexOf(c) === -1;
					});
				}
			} else if (args.length === 1 && args[0] === '*') {
				selectColumns = columns;
			} else if (args.length > 1) {
				selectColumns = args;
			}

			const query = knex(`${this.tableName} as ${alias}`);

			if (selectColumns) {
				query.select(QueryBuilder.getRawSelectFields(selectColumns, columnAliases, alias, true));
			}

			return new QueryBuilder(query, this.tableName, alias);
		}
	}

	BaseModel.relations = {};
	QueryBuilder.knex = knex;

	var models;
	QueryBuilder._models = BaseModel._models = models = {};

	const _import = model => {
		if (!model.tableName) {
			throw new Error('Model must specify tableName');
		}

		if ('execRelations' in model) {
			model.execRelations();
		}

		models[model.tableName] = model;
	};

	return {
		BaseModel,
		QueryBuilder,
		import: _import
	};
};