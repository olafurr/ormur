'use strict';

import {
    expect
} from './testCase';

import QueryBuilder from '../src/queryBuilder';

describe('Test QueryBuilder', () => {
    describe('Parse join arguments', () => {

        const queryBuilder = new QueryBuilder();

        describe('No arguments', () => {
            it('should throw an error with no argument', () => {
                expect(queryBuilder._parseJoinArguments).to.throw(Error);
            });
        });

        describe('One argument', () => {
            it('should parse correctly with one argument', () => {
                const args = queryBuilder._parseJoinArguments('leftJoin', 'users');

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.be.undefined;
                expect(args.opt).to.be.undefined;
            });
        });

        describe('Two arguments', () => {
            it('should parse correctly with alias set', () => {
                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', 'user');

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('user');
                expect(args.attrs).to.be.undefined;
                expect(args.opt).to.be.undefined;
            });

            it('should parse correctly with attributes as an array', () => {
                const attrs = ['id'];
                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', attrs);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.be.undefined;
            });

            it('should parse correctly with attributes as an object', () => {
                const attrs = {
                    include: ['id']
                };

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', attrs);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.be.undefined;
            });

            it('should parse correctly with attributes omitted and opt as an object', () => {
                const opt = {
                    username: 'jack'
                };

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.be.undefined;
                expect(args.opt).to.equal(opt);
            });

            it('should parse correctly with attributes omitted and opt as a function', () => {
                const opt = function() {};

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.be.undefined;
                expect(args.opt).to.equal(opt);
            });
        });

        describe('Three arguments', () => {
            it('should parse correctly with alias set and attributes as an array', () => {

                let attrs = ['id'];

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', 'user', attrs);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('user');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.be.undefined;
            });

            it('should parse correctly with alias set and attributes as an object', () => {
                const attrs = {
                    include: ['id']
                };
                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', 'user', attrs);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('user');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.be.undefined;
            });

            it('should parse correctly with alias set, attributes omitted and opt as an object', () => {
                const opt = {
                    username: 'jack'
                };

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', 'user', opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('user');
                expect(args.attrs).to.be.undefined;
                expect(args.opt).to.equal(opt);
            });

            it('should parse correctly with alias set, attributes omitted and opt as a function', () => {
                const opt = function() {};

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', 'user', opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('user');
                expect(args.attrs).to.be.undefined;
                expect(args.opt).to.equal(opt);
            });

            it('should parse correctly with alias omitted, attributes as an array and opt as object', () => {
                const opt = {
                    username: 'jack'
                };

                const attrs = ['id'];

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', attrs, opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.equal(opt);
            });

            it('should parse correctly with alias omitted, attributes as an array and opt a function', () => {
                const opt = function() {};

                const attrs = ['id'];

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', attrs, opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.equal(opt);
                expect(args.optFn).to.equal(opt);
            });

            it('should parse correctly with alias omitted, attributes as an object and opt an object', () => {
                const opt = {
                    username: 'jack'
                };

                const attrs = {
                    include: ['id']
                };

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', attrs, opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.equal(opt);
                expect(args.optFn).to.equal(null);
            });

            it('should parse correctly with alias omitted, attributes as an object and opt a function', () => {
                const opt = function() {};

                const attrs = {
                    include: ['id']
                };

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', attrs, opt);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('users');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.equal(opt);
                expect(args.optFn).to.equal(opt);
            });
        });

        describe.only('Four arguments', () => {
            it('should parse correctly with alias omitted, attributes as an object and opt an object', () => {
                const opt = {
                    username: 'jack'
                };

                const optFn = function() {};

                const attrs = {
                    include: ['id']
                };

                const args = queryBuilder._parseJoinArguments('leftJoin', 'users', 'user', attrs, opt, optFn);

                expect(args.joinType).to.equal('leftJoin');
                expect(args.joinTableName).to.equal('users');
                expect(args.alias).to.equal('user');
                expect(args.attrs).to.equal(attrs);
                expect(args.opt).to.equal(opt);
                expect(args.optFn).to.equal(optFn);
            });


        });

    });

});