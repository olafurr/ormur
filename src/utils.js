'use strict';

import {
    isPlainObject
} from 'lodash';

export const isObject = isPlainObject;

export const compactObject = obj => _compactObject(obj, true);

function _compactObject(obj, isTopLevel) {

    const keys = Object.keys(obj);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (isObject(obj[key])) {
            const result = _compactObject(obj[key], false);
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