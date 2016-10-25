'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('./utils');

var _relationTypes = require('./relationTypes');

var _relationTypes2 = _interopRequireDefault(_relationTypes);

var _dottie = require('dottie');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var QueryBuilder = function () {

	/**
  * Constructor to the query builder
  * @param  {String} query       The initial query for the query builder
  * @param  {String} table       The table for the current query
  * @param  {String} tableAlias  Alias for the table
  * @param  {String} parentTable Used for joins, the alias for the parent table if the joins are nested
  * @return {QueryBuilder}       New instance of QueryBuilder
  */
	function QueryBuilder(query, table, tableAlias, parentTable) {
		var _this = this;

		_classCallCheck(this, QueryBuilder);

		this.query = query;
		this.tableName = table;
		this.tableAlias = tableAlias;
		this.parentTable = parentTable || null;
		this.pagination = null;
		this.__limit = 0;
		var self = this;

		// Assign knex methods to the query builder
		['where', 'orderBy', 'then', 'map'].forEach(function (fn) {
			_this[fn] = function () {
				self.query = self.query[fn].apply(self.query, arguments);
				return self;
			};
		});
	}

	_createClass(QueryBuilder, [{
		key: '$from',


		/**
   * Execute a subquery for the current query
   * @param  {Function} fn 	The subquery
   * @return {QueryBuilder}   this
   */
		value: function $from(fn) {

			var alias = this.tableAlias;
			var subQuery = fn.call(this.constructor._models[this.tableName].$as(alias));

			if (typeof subQuery.query._single.limit !== 'undefined' && this.pagination) {
				this.__limit = subQuery.query._single.limit + 1;
				subQuery.limit(this.__limit);
			}

			this.query.select(this.tableAlias + '.*');

			this.query.from(subQuery.query.clone().as(this.tableAlias)).as('ignored_alias');

			return this;
		}
	}, {
		key: '$where',
		value: function $where(column, operator, value) {
			this.where([this.alias, column].join('.'), operator, value);
			return this;
		}
	}, {
		key: '$paginate',
		value: function $paginate(column) {
			this.pagination = {
				column: column || 'id'
			};

			return this;
		}
	}, {
		key: '$toJSON',
		value: function $toJSON() {
			this.query = this.query.map(function (row) {
				return (0, _utils.compactObject)((0, _dottie.transform)(row));
			});
			return this;
		}
	}, {
		key: '_constructPaginationObject',
		value: function _constructPaginationObject(rows) {

			var result = rows || [];
			var paginationObj = null;
			if (!this.pagination || this.__limit === 0) {
				return {
					result: result,
					paginationObj: paginationObj
				};
			}

			var paginationColumn = this.pagination.column;
			var nextId = null;

			if (result.length > this.__limit - 1) {
				var nextItem = rows[rows.length - 2];

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
				result: result,
				paginationObj: paginationObj
			};
		}
	}, {
		key: '$spread',
		value: function $spread() {
			return this.spread.apply(this, arguments);
		}
	}, {
		key: 'spread',
		value: function spread(cb) {

			var self = this;
			console.log(this.query);
			return this.query.then(function (rows) {
				console.log(rows);

				var _self$_constructPagin = self._constructPaginationObject(rows),
				    result = _self$_constructPagin.result,
				    paginationObj = _self$_constructPagin.paginationObj;

				return cb(result, paginationObj);
			});
		}
	}, {
		key: '$limit',
		value: function $limit() {
			return this.limit.apply(this, arguments);
		}
	}, {
		key: 'limit',
		value: function limit(count) {
			var limit = count;
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

	}, {
		key: '$join',
		value: function $join() {
			return this.$innerJoin.apply(this, arguments);
		}
	}, {
		key: '$leftJoin',
		value: function $leftJoin(table, alias, attrs, opt) {
			return this._$join('leftJoin', table, alias, attrs, opt);
		}
	}, {
		key: '$innerJoin',
		value: function $innerJoin(table, alias, attrs, opt) {
			return this._$join('innerJoin', table, alias, attrs, opt);
		}
	}, {
		key: '_parseJoinArguments',
		value: function _parseJoinArguments(joinType, joinTableName, alias, attrs, opt) {
			var args = Array.prototype.slice.call(arguments);
			var argCount = args.filter(function (a) {
				return typeof a !== 'undefined';
			}).length;

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
					else if ((0, _utils.isObject)(alias)) {

							if (alias.include && Array.isArray(alias.include) || alias.exclude && Array.isArray(alias.exclude)) {
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
							if ((0, _utils.isObject)(attrs)) {
								if (attrs.include && Array.isArray(attrs.include) || attrs.exclude && Array.isArray(attrs.exclude)) {
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
				joinType: joinType,
				joinTableName: joinTableName,
				alias: alias,
				attrs: attrs,
				opt: opt
			};
		}
	}, {
		key: '_$join',
		value: function _$join() {
			var _parseJoinArguments$a = this._parseJoinArguments.apply(this, arguments),
			    joinType = _parseJoinArguments$a.joinType,
			    joinTableName = _parseJoinArguments$a.joinTableName,
			    alias = _parseJoinArguments$a.alias,
			    attrs = _parseJoinArguments$a.attrs,
			    opt = _parseJoinArguments$a.opt;

			var joinTable = this.constructor._models[joinTableName],
			    parentTable = this.constructor._models[this.tableName],
			    relations = parentTable.getRelation(joinTableName, alias);

			if (alias === '*') {
				for (var _alias in parentTable.relations[joinTableName]) {
					this._$join(joinType, joinTableName, _alias, attrs, opt);
				}

				return this;
			}

			var joinTableColumns = Object.keys(joinTable.columns);
			var selectColumns = null;
			if (attrs === null || typeof attrs === 'undefined') {
				selectColumns = joinTableColumns;
			} else if ((0, _utils.isObject)(attrs)) {
				(function () {
					var obj = attrs;
					if ('include' in obj) {
						selectColumns = joinTableColumns.concat(obj.include);
					} else if ('exclude' in obj) {
						selectColumns = joinTableColumns.filter(function (c) {
							return obj.exclude.indexOf(c) === -1;
						});
					}
				})();
			} else if (Array.isArray(attrs)) {
				selectColumns = attrs;
			}

			var joinTableAlias = alias;

			if (this.parentTable) {
				joinTableAlias = [this.parentTable, alias].join('.');
			}

			if (selectColumns) {
				this.query.select(this.constructor.getRawSelectFields(selectColumns, joinTable.columns, joinTableAlias, false));
			}
			// this._addSelectFields(attrs, joinTableName, alias);

			var self = this;
			var knex = this.constructor.knex;

			// console.log(this.constructor.tableName, joinTableName, this.alias, alias)

			this.query[joinType](joinTableName + ' as ' + joinTableAlias, function () {
				// Join on primary/foreign key relationship

				var join = null;

				if (relations.type === _relationTypes2.default.belongsTo) {
					join = this.on(knex.raw('"' + self.tableAlias + '"."' + relations.foreignKey + '"'), '=', knex.raw('"' + joinTableAlias + '"."' + joinTable.primaryKey + '"'));
				} else {
					join = this.on(knex.raw('"' + joinTableAlias + '"."' + relations.foreignKey + '"'), '=', knex.raw('"' + self.tableAlias + '"."' + joinTable.primaryKey + '"'));
				}

				if ((0, _utils.isObject)(opt)) {
					(function () {
						var orQuery = null;
						if ('$or' in opt) {
							orQuery = Object.assign({}, opt.$or);
							delete opt.$or;
						}

						Object.keys(opt).forEach(function (key) {
							join.on(knex.raw('"' + joinTableAlias + '"."' + key + '"'), '=', opt[key]);
						});

						if (orQuery !== null) {
							join.andOn(function () {

								var orKeys = Object.keys(orQuery);

								for (var i = 0; i < orKeys.length; i++) {
									var fn = 'orOn';
									if (i === 0) {
										fn = 'on';
									}

									this[fn](knex.raw('"' + joinTableAlias + '"."' + orKeys[i] + '"'), '=', orQuery[orKeys[i]]);
								}
							});
						}
					})();
				}

				return join;
			});

			if (typeof opt === 'function') {
				opt.call(new QueryBuilder(this.query, joinTableName, alias, joinTableAlias));
			}

			return this;
		}
	}, {
		key: 'toString',
		value: function toString() {
			return this.query.toString();
		}
	}], [{
		key: 'getRawSelectFields',
		value: function getRawSelectFields(columns, columnAliases, alias, isTopLevel) {

			var raw = this.knex.raw;

			if (columns.length === 0) {
				return [];
			}

			return columns.map(function (c) {

				var leftHand = null,
				    rightHand = null;

				if (typeof c === 'function') {
					var result = c(alias);

					if (!Array.isArray(result) || result.length !== 2) {
						throw new Error('The result from virtual attributes must be an array with length 2');
					}

					leftHand = result[0];

					rightHand = isTopLevel ? result[1] : [alias, result[1]].join('.');
				} else {
					leftHand = '"' + alias + '".' + c;
					rightHand = isTopLevel ? columnAliases[c] || c : [alias, columnAliases[c] || c].join('.');
				}

				return raw(leftHand + ' as "' + rightHand + '"');
			});
		}
	}]);

	return QueryBuilder;
}();

exports.default = QueryBuilder;