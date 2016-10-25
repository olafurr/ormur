'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.compactObject = exports.isObject = undefined;

var _lodash = require('lodash');

var isObject = exports.isObject = _lodash.isPlainObject;

var compactObject = exports.compactObject = function compactObject(obj) {
    return _compactObject(obj, true);
};

function _compactObject(obj, isTopLevel) {

    var keys = Object.keys(obj);

    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (isObject(obj[key])) {
            var result = _compactObject(obj[key], false);
            if (result === null) {
                delete obj[key];
            } else {
                obj[key] = result;
            }
        } else if (obj[key] === null) {
            if (!isTopLevel) {
                delete obj[key];
            }
        }
    }

    if (Object.keys(obj).length === 0) {
        return null;
    }

    return obj;
}