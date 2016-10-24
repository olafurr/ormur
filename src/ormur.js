'use strict';

const inherits = require('util').inherits;

const isObject = o => o === Object(o) && !Array.isArray(o);

module.exports = knex => {


    const relationTypes = {
        hasOne: 'hasOne',
        belongsTo: 'belongsTo',
        hasMany: 'hasMany',
        belongsToMany: 'belongsToMany'
    };

    class BaseModel {

        constructor(query, parentModel) {
            this.parentModel = parentModel || '';
            this.selectFields = [];
            this.query = query || null;
            this._alias = null;

            const self = this;

            ['where', 'orderBy', 'limit'].forEach(fn => {
                this[fn] = function() {
                    self.query = self.query[fn].apply(self.query, arguments);
                    return self;
                }
            });

        }

        static get primaryKey() {
            return 'id';
        }

        static get tableName() {
            return '';
        }

        get alias() {
            // if (!this._alias) {
            //     return this.constructor.tableName;
            // }

            return this._alias;
        }

        static get columns() {
            return {
                id: null,
                created: null,
                updated: null
            };
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

        getRelation(table, alias) {

            if (!this.constructor.relations[table]) {
                throw new Error(`${table} is not associated with ${this.constructor.tableName}`);
            }

            return this.constructor.relations[table][alias || table] || this.constructor.relations[table][table];
        }

        getModel(tableName) {
            return this.constructor._models[tableName];
        }

        $join() {
            return this.$innerJoin.apply(this, arguments);
        }

        $leftJoin(table, alias, attrs, opt) {
            return this._$join('leftJoin', table, alias, attrs, opt);
        }

        $innerJoin(table, alias, attrs, opt) {
            return this._$join('innerJoin', table, alias, attrs, opt);
        }

        $from(fn) {

            const alias = this._alias || this.constructor.tableName;
            const subQueryInstance = new this.constructor();

            subQueryInstance._alias = alias

            const subQuery = fn.call(subQueryInstance);

            this.query.select(`${alias}.*`)

            this.query.from(subQuery.query.clone().as(alias)).as('ignored_alias');

            return this;
        }

        $as(alias) {
            this._alias = alias;
            return this;
        }

        static $as(alias) {

            const instance = new this();

            instance._alias = alias;

            instance.query = this.knex(`${this.tableName} as ${alias}`);
            return instance;
        }

        $select() {
            const args = Array.prototype.slice.call(arguments);

            if (args.length === 0) {
                this.
                return this;
            }

            // Object.keys(this.query.prototype).forEach(i => console.log(i));
            if (args.length === 0) {
                args.push('*');
            }

            let columns = null;

            if (args.length === 1 && args[0] === '*') {
                columns = Object.keys(this.constructor.columns);
            } else {
                columns = args;
            }

            this._addSelectFields(columns, this.constructor.tableName, this._alias);

            return this;
        }

        // The entry point
        static $select() {

            const instance = new this();

            return instance.$select.apply(instance, arguments);
        }

        toKnex() {
            return this.query;
        }

        _$join(joinType, joinTableName, alias, attrs, opt) {

            const args = Array.prototype.slice.call(arguments);
            const argCount = args.filter(a => typeof a !== 'undefined').length;

            if (argCount === 1) {
                throw new Error('joinTableName must be specied for the join');
            }

            /* 
                DEBUGGING

                joinTableName: <String> required,
                alias: <String> optional,
                attrs: <Array> optional,
                opt: <Function || Object> optional

                _join('joinTableName') - joinTableName same as alias and select all columns

                _join('joinTableName', 'alias') - joinTableName different from alias and select all columns
                _join('joinTableName', []) - joinTableName same as alias and select specified columns
                _join('joinTableName', {} || Function) - joinTableName same as alias select all columns and execute options

                _join('joinTableName', 'alias', []) - joinTableName different from alias and select specified
                _join('joinTableName', 'alias', {} || Function) - joinTableName different from alias and select specified
                _join('joinTableName', [], {} || Function) - joinTableName different from alias and select specified
            */

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
                }
                // _join('joinTableName', [], {} || Function) - joinTableName different from alias and select specified
                else if (Array.isArray(alias)) {
                    opt = attrs;
                    attrs = alias;
                    alias = joinTableName;
                }
            }



            const joinTable = this.constructor._models[joinTableName];

            const relations = this.getRelation(joinTableName, alias);


            if (alias === '*') {
                for (let alias in this.constructor.relations[joinTableName]) {
                    this._$join(joinType, joinTableName, alias, attrs, opt);
                }

                return this;
            }


            if (attrs === null || typeof attrs === 'undefined') {
                attrs = Object.keys(joinTable.columns);
            }

            let parentAlias = null;

            if (this.parentModel !== '') {
                alias = [this.parentModel, alias].join('.');
            }

            if (this.constructor.tableName === joinTableName) {
                parentAlias = this.alias;
            }

            this._addSelectFields(attrs, joinTableName, alias);

            const self = this;
            const selfClass = self.constructor;
            const knex = this.constructor.knex;

            // console.log(this.constructor.tableName, joinTableName, this.alias, alias)

            this.query[joinType](`${joinTableName} as ${alias}`, function() {
                // Join on primary/foreign key relationship

                let join = null;

                if (relations.type === relationTypes.belongsTo) {
                    join = this.on(knex.raw(`"${(self.parentModel || self.alias) || selfClass.tableName}"."${relations.foreignKey}"`), '=', knex.raw(`"${alias}"."${joinTable.primaryKey}"`));
                } else {
                    join = this.on(knex.raw(`"${alias}"."${relations.foreignKey}"`), '=', knex.raw(`"${(self.parentModel || self.alias) || selfClass.tableName}"."${joinTable.primaryKey}"`));
                }

                if (isObject(opt)) {
                    let orQuery = null;
                    if ('$or' in opt) {
                        orQuery = Object.assign({}, opt.$or);
                        delete opt.$or
                    }

                    Object.keys(opt).forEach(key => {
                        join.on(knex.raw(`"${alias}"."${key}"`), '=', opt[key])
                    });

                    if (orQuery !== null) {
                        join.andOn(function() {

                            const orKeys = Object.keys(orQuery);

                            for (let i = 0; i < orKeys.length; i++) {
                                let fn = 'orOn';
                                if (i === 0) {
                                    fn = 'on';
                                }

                                this[fn](knex.raw(`"${alias}"."${orKeys[i]}"`), '=', orQuery[orKeys[i]])
                            }
                        });
                    }
                }

                return join;
            });

            if (typeof opt === 'function') {
                opt.call(new joinTable(this.query, alias));
            }

            return this;
        }

        toString() {
            return this.query.toString()
        }

        _addSelectFieldsRaw(column) {
            this.query.select(column);
        }

        _addSelectFields(columns, tableName, alias) {

            if (!alias) {
                alias = tableName;
            }

            if (columns.length === 0) {
                return;
            }

            const knex = this.constructor.knex;

            const tableColumns = this.constructor._models[tableName].columns;

            const isParent = tableName === this.constructor.tableName;

            const fields = columns
                .map(
                    c => knex.raw(`"${alias}".${c} as "${isParent ? tableColumns[c] || c : [alias, tableColumns[c] || c].join('.')}"`)
                );

            if (!this.query) {
                this.query = knex(`${tableName} as ${alias}`);
                this.query.select(fields);
            } else {
                this.query.select(fields);
            }
        }
    }

    BaseModel.knex = knex;
    BaseModel._models = {};
    BaseModel.relations = {};

    const _import = model => {
        if (!model.tableName) {
            throw new Error('Model must specify tableName');
        }

        if ('execRelations' in model) {
            model.execRelations();
        }

        BaseModel._models[model.tableName] = model;
    };


    return {
        BaseModel,
        import: _import
    };
};