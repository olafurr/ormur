'use strict';

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
        }

        static get primaryKey() {
            return 'id';
        }

        static get tableName() {
            return '';
        }

        static get alias() {
            return this.tableName;
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
            this.query.from(fn.bind(this));
            return this;
        }

        $as(alias) {
            this.query.as(alias);
            return this;
        }

        // The entry point
        static $select() {

            const instance = new this();

            const args = Array.prototype.slice.call(arguments);

            if (args.length === 0) {
                args.push('*');
            }

            let columns = null;

            if (args.length === 1 && args[0] === '*') {
                columns = Object.keys(instance.constructor.columns);
            } else {
                columns = args;
            }

            instance._addSelectFields(columns, this.tableName, this.alias);

            return instance;
        }

        toKnex() {
            return this.query;
        }

        _$join(joinType, table, alias, attrs, opt) {

            const args = Array.prototype.slice.call(arguments);
            const argCount = args.filter(a => typeof a !== 'undefined').length;

            if (argCount === 1) {
                throw new Error('Table must be specied for the join');
            }

            /* 
                DEBUGGING

                table: <String> required,
                alias: <String> optional,
                attrs: <Array> optional,
                opt: <Function || Object> optional

                _join('table') - table same as alias and select all columns

                _join('table', 'alias') - table different from alias and select all columns
                _join('table', []) - table same as alias and select specified columns
                _join('table', {} || Function) - table same as alias select all columns and execute options

                _join('table', 'alias', []) - table different from alias and select specified
                _join('table', 'alias', {} || Function) - table different from alias and select all columns and execute options
                _join('table', [], {} || Function) - table different from alias, select specified and execute options
            */

            // _join('table') - table same as alias and select all columns
            if (argCount === 2) {
                alias = table;
            }

            // _join('table', 'alias') - table different from alias and select all columns
            // _join('table', []) - table same as alias and select specified columns
            // _join('table', {} || Function) - table same as alias select all columns and execute options
            else if (argCount === 3) {

                // _join('table', []) - table same as alias and select specified columns
                if (Array.isArray(alias)) {
                    attrs = alias;
                    alias = table;
                }
                // _join('table', {} || Function) - table same as alias select all columns and execute options
                else if (isObject(alias) || typeof alias === 'function') {
                    opt = alias;
                    alias = table;
                    attrs = undefined;
                }
            }

            // _join('table', 'alias', []) - table different from alias and select specified
            // _join('table', 'alias', {} || Function) - table different from alias, select all and execute options
            // _join('table', [], {} || Function) - table different from alias, select specified and execute options
            else if (argCount === 4) {
                // _join('table', 'alias', {} || Function) - table different from alias, select all and execute options
                if (typeof alias === 'string') {
                    if (isObject(attrs) || typeof attrs === 'function') {
                        opt = attrs;
                        attrs = null;
                    }
                }
                // _join('table', [], {} || Function) - table different from alias, select specified and execute options
                else if (Array.isArray(alias)) {
                    opt = attrs;
                    attrs = alias;
                    alias = table;
                }
            }



            const joinTable = this.constructor._models[table];

            const relations = this.getRelation(table, alias);


            if (alias === '*') {
                for (let alias in this.constructor.relations[table]) {
                    this._$join(joinType, table, alias, attrs, opt);
                }

                return this;
            }


            if (attrs === null || typeof attrs === 'undefined') {
                attrs = Object.keys(joinTable.columns);
            }

            if (this.parentModel !== '') {
                alias = [this.parentModel, alias].join('.');
            }

            this._addSelectFields(attrs, table, alias);

            const self = this;
            const selfClass = self.constructor;
            const knex = this.constructor.knex;

            this.query[joinType](`${table} as ${alias}`, function() {
                // Join on primary/foreign key relationship

                let join = null;

                if (relations.type === relationTypes.belongsTo) {
                    join = this.on(knex.raw(`"${self.parentModel || selfClass.tableName}"."${relations.foreignKey}"`), '=', knex.raw(`"${alias}"."${joinTable.primaryKey}"`));
                } else {
                    join = this.on(knex.raw(`"${alias}"."${relations.foreignKey}"`), '=', knex.raw(`"${self.parentModel || selfClass.tableName}"."${joinTable.primaryKey}"`));
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
                this.query = knex(`${tableName} as ${alias}`).select(fields);
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