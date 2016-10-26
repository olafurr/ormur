'use strict';

import {
	isObject,
	compactObject
} from './utils';

import relationTypes from './relationTypes';

import {
	transform
} from 'dottie';

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
		this.pagination = null;
		this.__limit = 0;
		const self = this;

		// Assign knex methods to the query builder
		['where', 'orderBy', 'toSQL', 'orderByRaw', 'then', 'tap', 'catch', 'map', 'groupBy', 'gropuByRaw', 'whereRaw', 'whereNot', 'whereIn', 'whereNotIn', 'whereNull', 'whereNotNull', 'whereExists', 'whereNotExists', 'whereBetween', 'whereNotBetween'].forEach(fn => {
			this[fn] = function() {
				self.query = self.query[fn].apply(self.query, arguments);
				return self;
			};
		});
	}

	static getRawSelectFields(columns, columnAliases, alias, isTopLevel) {

		const raw = this.knex.raw;

		if (columns.length === 0) {
			return [];
		}

		return columns.map(c => {

			let leftHand = null,
				rightHand = null;

			if (typeof c === 'function') {
				const result = c(alias);

				if (!Array.isArray(result) || result.length !== 2) {
					throw new Error(`The result from virtual attributes must be an array with length 2`);
				}

				leftHand = result[0];

				rightHand = isTopLevel ? result[1] : [alias, result[1]].join('.');
			} else {
				leftHand = `"${alias}".${c}`;
				rightHand = isTopLevel ? columnAliases[c] || c : [alias, columnAliases[c] || c].join('.');
			}

			return raw(`${leftHand} as "${rightHand}"`);
		});
	}


	/**
	 * Execute a subquery for the current query
	 * @param  {Function} fn 	The subquery
	 * @return {QueryBuilder}   this
	 */
	$from(fn) {

		const alias = this.tableAlias;
		const subQuery = fn.call(this.constructor._models[this.tableName].$as(alias));

		if (typeof subQuery.query._single.limit !== 'undefined' && this.pagination) {
			this.__limit = subQuery.query._single.limit + 1;
			subQuery.limit(this.__limit);
		}

		this.query.select(`${this.tableAlias}.*`);

		this.query.from(subQuery.query.clone().as(this.tableAlias)).as('ignored_alias');

		return this;
	}

	$where(column, operator, value) {
		this.where([this.tableAlias, column].join('.'), operator, value);
		return this;
	}

	$paginate(column) {
		this.pagination = {
			column: column || 'id'
		};

		return this;
	}

	$toJSON() {
		this.query = this.query.map(row => compactObject(transform(row)));
		return this;
	}

	_constructPaginationObject(rows) {

		let result = rows || [];
		let paginationObj = null;
		if (!this.pagination || this.__limit === 0) {
			return {
				result,
				paginationObj
			};
		}

		const paginationColumn = this.pagination.column;
		let nextId = null;

		if (result.length > this.__limit - 1) {
			const nextItem = rows[rows.length - 2];

			if (typeof paginationColumn !== 'undefined' && nextItem.hasOwnProperty(paginationColumn)) {
				nextId = nextItem[paginationColumn];
			}

			result = rows.slice(0, rows.length - 1);
		}

		if (nextId) {
			paginationObj = {
				nextId: nextId
			};
		}

		return {
			result,
			paginationObj
		};
	}

	$spread() {
		return this.spread.apply(this, arguments);
	}

	spread(cb) {

		const self = this;
		return this.query.then(function(rows) {
			let {
				result,
				paginationObj
			} = self._constructPaginationObject(rows);

			return cb(result, paginationObj);
		});
	}

	$limit() {
		return this.limit.apply(this, arguments);
	}

	limit(count) {
		let limit = count;
		if (this.pagination) {
			limit += 1;
		}

		this.query.limit(limit);
		this.__limit = limit;

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

	_parseJoinArguments(joinType, joinTableName, alias, attrs, opt) {
		const args = Array.prototype.slice.call(arguments);
		const argCount = args.filter(a => typeof a !== 'undefined').length;

		if (argCount < 2) {
			throw new Error('joinTableName and joinType must be specied for the join');
		}

		// Almost all arguments optional... God help us

		// _join('joinTableName') - joinTableName same as alias and select all columns
		if (argCount === 2) {
			alias = joinTableName;
		}

		// _join('joinTableName', 'alias') - joinTableName different from alias and select all columns
		// _join('joinTableName', []) - joinTableName same as alias and select specified columns
		// _join('joinTableName', {}) - joinTableName same as alias and attrs is an object
		// _join('joinTableName', {} || Function) - joinTableName same as alias select all columns and execute options
		else if (argCount === 3) {

			// _join('joinTableName', []) - joinTableName same as alias and select specified columns
			if (Array.isArray(alias)) {
				attrs = alias;
				alias = joinTableName;
			}
			// _join('joinTableName', {} || Function) - joinTableName same as alias select all columns and execute options
			else if (isObject(alias)) {

				if ((alias.include && Array.isArray(alias.include)) ||
					(alias.exclude && Array.isArray(alias.exclude))) {
					attrs = alias;
					alias = joinTableName;
					opt = undefined;

					// _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias, select all attributes and execute options
				} else {
					opt = alias;
					alias = joinTableName;
					attrs = undefined;
				}
			} else if (typeof alias === 'function') {
				opt = alias;
				alias = joinTableName;
				attrs = undefined;
			}
		}


		// _join('joinTableName', 'alias', []) - joinTableName different from alias and select specified fields
		// _join('joinTableName', 'alias', {}) - joinTableName different from alias and attrs is an object
		// _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias, select all attributes and execute options
		// _join('joinTableName', {}, {} || Function) - joinTableName different from alias and select specified
		// _join('joinTableName', [], {} || Function) - joinTableName different from alias and select specified
		else if (argCount === 4) {
			// _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias and select specified
			if (typeof alias === 'string') {

				// _join('joinTableName', 'alias', {}) - joinTableName different from alias and attrs is an object
				if (isObject(attrs)) {
					if ((attrs.include && Array.isArray(attrs.include)) ||
						(attrs.exclude && Array.isArray(attrs.exclude))) {
						opt = undefined;

						// _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias, select all attributes and execute options
					} else {
						opt = attrs;
						attrs = undefined;
					}
					// _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias, select all attributes and execute options
				} else if (typeof attrs === 'function') {
					opt = attrs;
					attrs = undefined;
				}
				// _join('joinTableName', [], {} || Function) - joinTableName different from alias and select specified
			} else {
				opt = attrs;
				attrs = alias;
				alias = joinTableName;
			}
		}

		return {
			joinType,
			joinTableName,
			alias,
			attrs,
			opt
		};
	}

	_$join() {

		let {
			joinType,
			joinTableName,
			alias,
			attrs,
			opt
		} = this._parseJoinArguments.apply(this, arguments);


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
		let selectColumns = null;
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
					delete opt.$or;
				}

				Object.keys(opt).forEach(key => {
					join.on(knex.raw(`"${joinTableAlias}"."${key}"`), '=', opt[key]);
				});

				if (orQuery !== null) {
					join.andOn(function() {

						const orKeys = Object.keys(orQuery);

						for (let i = 0; i < orKeys.length; i++) {
							let fn = 'orOn';
							if (i === 0) {
								fn = 'on';
							}

							this[fn](knex.raw(`"${joinTableAlias}"."${orKeys[i]}"`), '=', orQuery[orKeys[i]]);
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

export default QueryBuilder;