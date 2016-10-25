'use strict';

const utils = require('./utils');
const isObject = utils.isObject;

const relationTypes = require('./relationTypes');

class QueryBuilder {

	/**
	 * Constructor to the query builder
	 * @param  {String} query       The initial query for the query builder
	 * @param  {String} table       The table for the current query
	 * @param  {String} tableAlias  Alias for the table
	 * @param  {String} parentTable Used for joins, the alias for the parent table if the joins are nested
	 * @return {QueryBuilder}       New instance of QueryBuilder
	 */
	constructor(query, table, tableAlias, parentTable) {
		this.query = query;
		this.tableName = table;
		this.tableAlias = tableAlias;
		this.parentTable = parentTable || null;

		const self = this;

		// Assign knex methods to the query builder
		['where', 'orderBy', 'limit'].forEach(fn => {
			this[fn] = function() {
				self.query = self.query[fn].apply(self.query, arguments);
				return self;
			}
		});
	}

	static getRawSelectFields(columns, columnAliases, alias, isTopLevel) {

		const raw = this.knex.raw;

		if (columns.length === 0) {
			return [];
		}

		return columns
			.map(c => raw(`"${alias}".${c} as "${isTopLevel ? columnAliases[c] || c : [alias, columnAliases[c] || c].join('.')}"`));
	}


	/**
	 * Execute a subquery for the current query
	 * @param  {Function} fn 	The subquery
	 * @return {QueryBuilder}   this
	 */
	$from(fn) {

		const alias = this.tableAlias;
		const subQuery = fn.call(this.constructor._models[this.tableName].$as(alias));

		this.query.select(`${this.tableAlias}.*`)

		this.query.from(subQuery.query.clone().as(this.tableAlias)).as('ignored_alias');

		return this;
	}

	$where(column, operator, value) {
		this.where([this.alias, column].join('.'), operator, value);
		return this;
	}

	/**
	 * Joins a table with the parent table 
	 * @param  {String} 			table 	The table to join
	 * @param  {String} 			alias 	Optional alias for the join table
	 * @param  {Array}  			attrs 	Optional attributes to select from the table. If omitted, all the fields are selected.
	 * @param  {Function || Object} opt 	Function to execute deeper joins on the joined model or object to add where conditions on the join
	 * @param  {Object} 			opt.$or Or conditions for the join
	 * @return {QueryBuilder}       		this
	 */
	$join() {
		return this.$innerJoin.apply(this, arguments);
	}

	$leftJoin(table, alias, attrs, opt) {
		return this._$join('leftJoin', table, alias, attrs, opt);
	}

	$innerJoin(table, alias, attrs, opt) {
		return this._$join('innerJoin', table, alias, attrs, opt);
	}

	_$join(joinType, joinTableName, alias, attrs, opt) {

		const args = Array.prototype.slice.call(arguments);
		const argCount = args.filter(a => typeof a !== 'undefined').length;

		if (argCount === 1) {
			throw new Error('joinTableName must be specied for the join');
		}

		// Almost all arguments optional... God help us

		// _join('joinTableName') - joinTableName same as alias and select all columns
		if (argCount === 2) {
			alias = joinTableName;
		}

		// _join('joinTableName', 'alias') - joinTableName different from alias and select all columns
		// _join('joinTableName', []) - joinTableName same as alias and select specified columns
		// _join('joinTableName', {} || Function) - joinTableName same as alias select all columns and execute options
		else if (argCount === 3) {

			// _join('joinTableName', []) - joinTableName same as alias and select specified columns
			if (Array.isArray(alias)) {
				attrs = alias;
				alias = joinTableName;
			}
			// _join('joinTableName', {} || Function) - joinTableName same as alias select all columns and execute options
			else if (isObject(alias) || typeof alias === 'function') {
				opt = alias;
				alias = joinTableName;
				attrs = undefined;
			}
		}


		// _join('joinTableName', 'alias', []) - joinTableName different from alias and select specified
		// _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias and select specified
		// _join('joinTableName', [], {} || Function) - joinTableName different from alias and select specified
		else if (argCount === 4) {
			// _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias and select specified
			if (typeof alias === 'string') {
				if (isObject(attrs) || typeof attrs === 'function') {
					opt = attrs;
					attrs = null;
				}
			} else if (Array.isArray(alias)) {
				opt = attrs;
				attrs = alias;
				alias = joinTableName;
			}
		}


		const joinTable = this.constructor._models[joinTableName],
			parentTable = this.constructor._models[this.tableName],
			relations = parentTable.getRelation(joinTableName, alias);

		if (alias === '*') {
			for (let alias in parentTable.relations[joinTableName]) {
				this._$join(joinType, joinTableName, alias, attrs, opt);
			}

			return this;
		}

		const joinTableColumns = Object.keys(joinTable.columns);
		const selectColumns = null;
		if (attrs === null || typeof attrs === 'undefined') {
			selectColumns = joinTableColumns;
		} else if (isObject(attrs)) {
			const obj = attrs;
			if ('include' in obj) {
				selectColumns = joinTableColumns.concat(obj.include);
			} else if ('exclude' in obj) {
				selectColumns = joinTableColumns.filter(c => {
					return obj.exclude.indexOf(c) === -1;
				});
			}


		} else if (Array.isArray(attrs)) {
			selectColumns = attrs;
		}

		let joinTableAlias = alias;

		if (this.parentTable) {
			joinTableAlias = [this.parentTable, alias].join('.');
		}

		if (selectColumns) {
			this.query.select(this.constructor.getRawSelectFields(selectColumns, joinTable.columns, joinTableAlias, false));
		}
		// this._addSelectFields(attrs, joinTableName, alias);

		const self = this;
		const knex = this.constructor.knex;

		// console.log(this.constructor.tableName, joinTableName, this.alias, alias)

		this.query[joinType](`${joinTableName} as ${joinTableAlias}`, function() {
			// Join on primary/foreign key relationship

			let join = null;

			if (relations.type === relationTypes.belongsTo) {
				join = this.on(knex.raw(`"${self.tableAlias}"."${relations.foreignKey}"`), '=', knex.raw(`"${joinTableAlias}"."${joinTable.primaryKey}"`));
			} else {
				join = this.on(knex.raw(`"${joinTableAlias}"."${relations.foreignKey}"`), '=', knex.raw(`"${self.tableAlias}"."${joinTable.primaryKey}"`));
			}

			if (isObject(opt)) {
				let orQuery = null;
				if ('$or' in opt) {
					orQuery = Object.assign({}, opt.$or);
					delete opt.$or
				}

				Object.keys(opt).forEach(key => {
					join.on(knex.raw(`"${joinTableAlias}"."${key}"`), '=', opt[key])
				});

				if (orQuery !== null) {
					join.andOn(function() {

						const orKeys = Object.keys(orQuery);

						for (let i = 0; i < orKeys.length; i++) {
							let fn = 'orOn';
							if (i === 0) {
								fn = 'on';
							}

							this[fn](knex.raw(`"${joinTableAlias}"."${orKeys[i]}"`), '=', orQuery[orKeys[i]])
						}
					});
				}
			}

			return join;
		});

		if (typeof opt === 'function') {
			opt.call(new QueryBuilder(this.query, joinTableName, alias, joinTableAlias));
		}

		return this;
	}

	toString() {
		return this.query.toString();
	}
}

module.exports = QueryBuilder;