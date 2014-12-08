"use strict";
/* global Type: true, error: true, path: true, util: true, fs: true, INVALID_ALIAS_VALUE: true */
var Type = require('static-type-js');
var core = require('./core');
var path = require('path');
var util = require('util');
var fs = require('fs');
var INVALID_ALIAS_VALUE = /[\\?%*:|"<>.\s]/ig;
var error;
/**
 * @license Mit Licence 2014
 * @since 0.0.1
 * @author Igor Ivanovic
 * @name Loader
 *
 * @constructor
 * @description
 * Loader is main class which provide all paths to load part of application
 */
var DI = Type.create({
    filePaths: Type.OBJECT,
    aliases: Type.OBJECT
}, {
    _construct: function DI_construct() {
        this.aliases = {};
        this.setAlias('framework', __dirname + '/');
        try {
            this.filePaths = JSON.parse(fs.readFileSync(this.normalizePath('@{framework}/files.json'), {encoding: 'utf8'}));
        } catch (e) {
            throw new Error("Cannot load @{framework}/files.json path");
        }

    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method Loader#hasAlias
     *
     * @description
     * Has an alias
     */
    hasAlias: function DI_hasAlias(key) {
        return this.aliases.hasOwnProperty(key);
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method Loader#getAlias
     *
     * @description
     * Get an alias
     */
    getAlias: function DI_getAlias(key) {
        if (this.aliases.hasOwnProperty(key)) {
            return this.normalizePath(this.aliases[key]);
        } else {
            error = this.load('error');
            throw new error.Exception('DI.getAlias: "' + key + '" is not valid');
        }
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method Loader#setAlias
     *
     * @description
     * Set an path alias
     */
    setAlias: function DI_setAlias(key, value) {
        /* @todo check if this will be required */
        if (INVALID_ALIAS_VALUE.test(value)) {
            error = this.load('error');
            throw new error.Exception('DI.setAlias: Invalid alias value, chars \'\\?%*:|"<>.\' and spaces are not allowed. KEY: ' + key);
        } else {
            this.aliases[key] = this.normalizePath(value);
        }
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method Loader#normalizePath
     *
     * @description
     * Normalize path
     */
    normalizePath: function DI_normalizePath(value) {
        Object.keys(this.aliases).forEach(function (key) {
            value = value.replace('@{' + key + '}', this.aliases[key]);
        }.bind(this));
        return path.normalize(value);
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method Loader#readFileSync
     *
     * @description
     * Read file sync
     */
    readFileSync: function DI_readFileSync(name) {
        try {
            return fs.readFileSync(this.normalizePath(name), {encoding: 'utf8'});
        } catch (e) {
            error = this.load('error');
            throw new error.Exception('DI.readFileSync', e);
        }
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method Loader#load
     *
     * @description
     * Load an package
     */
    load: function DI_load(file) {
        try {
            if (file in this.filePaths) {
                file = this.filePaths[file];
            }
            return require(this.normalizePath(file));
        } catch (e) {
            error = this.load('error');
            throw new error.Exception('DI.load', e);
        }
    }
});


module.exports = new DI;