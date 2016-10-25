'use strict';

import {
    expect
} from './testCase';

import {
    isObject
} from '../src/utils';

describe('Test utils', () => {

    describe('Test isObject', () => {
        it('should return true for object', () => expect(isObject({})).to.equal(true));
        it('should return false for function', () => expect(isObject(function() {})).to.equal(false));
        it('should return false for Number', () => expect(isObject(Number())).to.equal(false));
        it('should return false for array', () => expect(isObject([])).to.equal(false));
    });
});