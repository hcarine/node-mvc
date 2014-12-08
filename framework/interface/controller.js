"use strict";
/* global loader: true,  Type: true,, error: true, CacheInterface: true */
var di = require('../di'),
    Type = di.load('typejs'),
    core = di.load('core'),
    error = di.load('error'),
    ControllerInterface;
/**
 * @license Mit Licence 2014
 * @since 0.0.1
 * @author Igor Ivanovic
 * @name ControllerInterface
 *
 * @constructor
 * @description
 * Controller interface
 */
ControllerInterface = Type.create({
    _request: Type.OBJECT
}, {
    _invoke: function ControllerInterface(request) {
        this._request = request;
        ["hasAction", "getAction", "redirect", "forward", "addHeader", "onEnd", "createUrl"].forEach(function (method) {
            if (!(method in this)) {
                throw new error.DataError({method: method}, 'ControllerInterface: missing method in Controller class');
            }
        }.bind(this));
    }
});

module.exports = ControllerInterface;