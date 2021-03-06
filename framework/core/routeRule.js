"use strict";
/* global loader: true, Promise: true, Type: true, core: true, error: true, RouteRule: true, PATTERN_MATCH: true, ROUTE_MATCH: true, PATTERN_CAPTURE_REGEX: true, IS_NAMED: true */
var di = require('../di'),
    Type = di.load('typejs'),
    core = di.load('core'),
    error = di.load('error'),
    RouteRuleInterface = di.load('interface/routeRule'),
    component = di.load('core/component'),
    logger = component.get('core/logger'),
    PATTERN_MATCH = /<(\w+):?([^>]+)?>/ig,
    ROUTE_MATCH = /<(\w+)>/ig,
    PATTERN_CAPTURE_REGEX = /\(\??P?(<(\w+)>)?([^\)]+\)?)\)?\)/g,
    IS_NAMED = /<(\w+)>/,
    IS_GROUP = /^\(([^\)]+)\)$/,
    RouteRule;
/**
 * @license Mit Licence 2014
 * @since 0.0.1
 * @author Igor Ivanovic
 * @name RouteRule
 *
 * @constructor
 * @description
 * RouteRule is used to create route rule
 */
RouteRule = RouteRuleInterface.inherit({
    routeParams: Type.ARRAY,
    paramRules: Type.ARRAY,
    template: Type.STRING,
    routeRule: Type.STRING,
    methods: Type.ARRAY,
    logger: Type.OBJECT,
    pattern: Type.OBJECT,
    route: Type.STRING
}, {
    _construct: function RouteRule(config) {
        var matches, name, pattern, escapePattern = [], escapeRule = [], template;
        this.routeParams = [];
        this.paramRules = [];
        this.template = null;
        this.routeRule = null;


        if (!config.pattern) {
            throw new error.HttpError(500, config, 'RouteRule: rule object must have an pattern property');
        } else if (!Type.isString(config.pattern)) {
            throw new error.HttpError(500, config, 'RouteRule: rule.pattern must be string type');
        }
        if (!config.route) {
            throw new error.HttpError(500, config, 'RouteRule: rule object must have an route property');
        }

        pattern = this.trim(config.pattern, '/');
        this.route = this.trim(config.route, '/');

        if (this.route.indexOf('<') > -1) {
            matches = core.match(ROUTE_MATCH, this.route);
            if (Type.isArray(matches)) {
                matches.forEach(function (item) {
                    this.routeParams.push({
                        key: item[1],
                        value: item[0]
                    });
                }.bind(this));
            }
        }


        matches = core.match(PATTERN_MATCH, pattern);


        if (Array.isArray(matches) && matches.length) {

            matches.forEach(function (item) {
                var esc, nPattern;
                name = item[1];
                nPattern = Type.isString(item[2]) ? item[2] : '([^\/]+)';

                esc = {
                    key: '<' + name + '>',
                    value: '(?P<' + name + '>' + nPattern + ')'
                };
                escapePattern.push(esc);

                if (this.find(this.routeParams, name)) {
                    escapeRule.push(esc);
                } else {
                    this.paramRules.push({
                        key: name,
                        value: nPattern === '([^\/]+)' ? '' : core.createRegex('^' + nPattern + '$')
                    });
                }

            }.bind(this));
        }

        this.template = pattern.replace(PATTERN_MATCH, function (match, path) {
            return '<' + path + '>';
        });

        template = this.escape(this.template, escapePattern);

        this.pattern = this.toRegex('^' + this.trim(template, '/') + '$');

        if (this.routeParams.length) {
            this.routeRule = '^' + this.escape(this.route, escapeRule) + '$';
        }

        if (config.method) {
            this.methods = config.method;
        } else {
            this.methods = ['GET'];
        }

        if (this.template.indexOf('<') > -1 && this.route.indexOf('<') > -1) {
            if (this.template.indexOf(this.route) === -1) {
                throw new error.HttpError(500, config, 'RouteRule: invalid route rule');
            }
        }

        logger.info('RouteRule.construct:', {
            escapePattern: escapePattern,
            escapeRule: escapeRule,
            escapedTemplate: template,
            template: this.template,
            paramRules: this.paramRules,
            routeParams: this.routeParams,
            routeRule: this.routeRule,
            method: this.method,
            pattern: this.pattern,
            route: this.route
        });
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#parseRequest
     *
     * @description
     * Parse request
     */
    parseRequest: function RouteRule_parseRequest(method, url) {

        var matches,
            route,
            key,
            result = [],
            escape = [],
            params = {},
            current;
        //match pathname
        matches = this.match(this.pattern, this.trim(url.pathname, '/'));


        if (!matches.length || !this.checkMethod(method)) {
            return false;
        }
        params = url.query;


        for (key in params) {
            current = this.find(matches, key);
            if (!current || current.value === '') {
                matches.push({
                    key: key,
                    value: params[key]
                });
            }
        }

        matches.forEach(function (item) {
            var current = this.find(this.routeParams, item.key);
            if (current) {
                escape.push({
                    key: '<' + current.key + '>',
                    value: item.value
                });
                delete params[item.name];
            } else if (this.find(this.paramRules, item.key)) {
                params[item.key] = item.value;
            }
        }.bind(this));


        if (this.routeParams.length) {
            route = this.escape(this.route, escape);
        } else {
            route = this.route;
        }

        result.push(route);
        result.push(params);

        return result;
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#createUrl
     *
     * @description
     * Create an url
     * @return {object}
     */
    createUrl: function RouteRule_createUrl(route, params) {
        var escape = [], i, len, c, url;

        if (this.route !== route) {
            if (!this.routeRule) {
                return false;
            }
            escape = this.match(this.routeRule, this.trim(route, '/'));
            if (!escape.length) {
                return false;
            }
            escape.forEach(function (item) {
                if (item.key.indexOf('<') === -1) {
                    item.key = '<' + item.key + '>';
                }
            });
        }

        len = this.paramRules.length;

        for (i = 0; i < len; ++i) {
            c = this.paramRules[i];
            if (params.hasOwnProperty(c.key) && (c.value === '' || (Type.isRegExp(c.value) && c.value.test(params[c.key])) || this.match(c.value, params[c.key].toString()).length > 0)) {
                escape.push({
                    key: '<' + c.key + '>',
                    value: params[c.key].toString()
                });
                delete params[c.key];
            } else if (Type.isUndefined(params[c.key])) {
                return false;
            }
        }

        url = this.trim(this.escape(this.template, escape), '/');

        if (this.match(this.pattern.regex, url).length === 0) {
            return false;
        }

        if (Object.keys(params).length > 0) {
            url += "?" + this.buildQuery(params);
        }
        return url;
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#buildQuery
     *
     * @description
     * Build query string
     */
    buildQuery: function RouteRule_buildQuery(params) {
        var data = [];
        Object.keys(params).forEach(function (key) {
            data.push(key + '=' + encodeURIComponent(params[key]));
        });
        return data.join('&');
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#checkMethod
     *
     * @description
     * Check is header method is same
     */
    checkMethod: function RouteRule_checkMethod(method) {
        return this.methods.indexOf(method) > -1;
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#find
     *
     * @description
     * Find route rule
     */
    find: function RouteRule_find(data, key) {
        return data.filter(Type.isFunction(key) ? key : function (item) {
            return item.key === key;
        }).pop();
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#toObject
     *
     * @description
     * Convert array to object
     */
    toObject: function RouteRule_toObject(arr) {
        var nObj = {};
        Object.keys(arr).forEach(function (key) {
            nObj[key] = arr[key];
        });
        return nObj;
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#toRegex
     *
     * @description
     * Creates regex from regex group string
     */
    toRegex: function RouteRule_toRegex(re) {
        var matches = core.match(PATTERN_CAPTURE_REGEX, re), newRegex = re;

        if (matches.length) {
            matches = matches.map(this.toObject);
            matches.forEach(function (item, mIndex) {
                var index = Object.keys(item).length - 3;
                item.isNamed = IS_NAMED.test(item[1]);
                if (item.isNamed) {
                    if (IS_GROUP.test(item[index])) {
                        item.pattern = item[index];
                    } else {
                        item.pattern = '(' + item[index] + ')';
                    }

                    item.key = item[2];
                    newRegex = newRegex.replace(item[0], item.pattern);
                } else {
                    if (IS_GROUP.test(item[index])) {
                        item.pattern = item[index];
                    } else {
                        item.pattern = '(' + item[index] + ')';
                    }
                    item.key = null;
                }
                item.index = mIndex;
            });
            return {
                group: matches,
                regex: core.createRegex(newRegex)
            };
        }
        return {
            group: false,
            regex: core.createRegex(re)
        };
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#match
     *
     * @description
     * Match named
     */
    match: function RouteRule_match(rgx, str) {
        var group, matched, data = [];
        if (Type.isString(rgx)) {
            rgx = this.toRegex(rgx);
        }
        if (Type.isObject(rgx) && Type.isRegExp(rgx.regex)) {
            if (rgx.group && rgx.group.length) {
                group = rgx.group;
                matched = core.match(rgx.regex, str).shift();
                if (Type.isArray(matched)) {
                    matched = matched.slice(1, matched.length - 2);
                    group.forEach(function (item) {
                        data.push({
                            key: item.isNamed ? item.key : false,
                            index: item.index,
                            value: matched[item.index]
                        });
                    });
                }
            } else {
                return core.match(rgx.regex, str);
            }
        } else if (Type.isRegExp(rgx)) {
            return core.match(rgx, str);
        }
        return data;
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#escape
     *
     * @description
     * Escape
     */
    escape: function RouteRule_escape(str, escape) {
        if (!Type.isString(str)) {
            throw new error.HttpError(500, {str: str}, 'RouteRule.escape: str must be a string type');
        } else if(!Type.isArray(escape)) {
            throw new error.HttpError(500, {escape: escape}, 'RouteRule.escape: escape must be a array type');
        }
        escape.forEach(function (item) {
            str = str.replace(item.key, item.value);
        });
        return str;
    },
    /**
     * @since 0.0.1
     * @author Igor Ivanovic
     * @method RouteRule#trim
     *
     * @description
     * Strip whitespace in string and as well strip extra parameter
     */
    trim: function RouteRule_trim(str, strip) {
        if (!Type.isString(str)) {
            return str;
        }
        str = str.trim();
        if (strip && str !== strip) {
            str = str.replace(core.createRegex('^' + strip), '');
            str = str.replace(core.createRegex(strip + '$'), '');
        }
        return str;
    }
});

module.exports = RouteRule;