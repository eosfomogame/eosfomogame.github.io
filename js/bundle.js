(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
    module.exports = require('./register')().Promise

},{"./register":3}],2:[function(require,module,exports){
    "use strict"
    // global key for user preferred registration
    var REGISTRATION_KEY = '@@any-promise/REGISTRATION',
        // Prior registration (preferred or detected)
        registered = null

    /**
     * Registers the given implementation.  An implementation must
     * be registered prior to any call to `require("any-promise")`,
     * typically on application load.
     *
     * If called with no arguments, will return registration in
     * following priority:
     *
     * For Node.js:
     *
     * 1. Previous registration
     * 2. global.Promise if node.js version >= 0.12
     * 3. Auto detected promise based on first sucessful require of
     *    known promise libraries. Note this is a last resort, as the
     *    loaded library is non-deterministic. node.js >= 0.12 will
     *    always use global.Promise over this priority list.
     * 4. Throws error.
     *
     * For Browser:
     *
     * 1. Previous registration
     * 2. window.Promise
     * 3. Throws error.
     *
     * Options:
     *
     * Promise: Desired Promise constructor
     * global: Boolean - Should the registration be cached in a global variable to
     * allow cross dependency/bundle registration?  (default true)
     */
    module.exports = function(root, loadImplementation){
        return function register(implementation, opts){
            implementation = implementation || null
            opts = opts || {}
            // global registration unless explicitly  {global: false} in options (default true)
            var registerGlobal = opts.global !== false;

            // load any previous global registration
            if(registered === null && registerGlobal){
                registered = root[REGISTRATION_KEY] || null
            }

            if(registered !== null
                && implementation !== null
                && registered.implementation !== implementation){
                // Throw error if attempting to redefine implementation
                throw new Error('any-promise already defined as "'+registered.implementation+
                    '".  You can only register an implementation before the first '+
                    ' call to require("any-promise") and an implementation cannot be changed')
            }

            if(registered === null){
                // use provided implementation
                if(implementation !== null && typeof opts.Promise !== 'undefined'){
                    registered = {
                        Promise: opts.Promise,
                        implementation: implementation
                    }
                } else {
                    // require implementation if implementation is specified but not provided
                    registered = loadImplementation(implementation)
                }

                if(registerGlobal){
                    // register preference globally in case multiple installations
                    root[REGISTRATION_KEY] = registered
                }
            }

            return registered
        }
    }

},{}],3:[function(require,module,exports){
    "use strict";
    module.exports = require('./loader')(window, loadImplementation)

    /**
     * Browser specific loadImplementation.  Always uses `window.Promise`
     *
     * To register a custom implementation, must register with `Promise` option.
     */
    function loadImplementation(){
        if(typeof window.Promise === 'undefined'){
            throw new Error("any-promise browser requires a polyfill or explicit registration"+
                " e.g: require('any-promise/register/bluebird')")
        }
        return {
            Promise: window.Promise,
            implementation: 'window.Promise'
        }
    }

},{"./loader":2}],4:[function(require,module,exports){
    var asn1 = exports;

    asn1.bignum = require('bn.js');

    asn1.define = require('./asn1/api').define;
    asn1.base = require('./asn1/base');
    asn1.constants = require('./asn1/constants');
    asn1.decoders = require('./asn1/decoders');
    asn1.encoders = require('./asn1/encoders');

},{"./asn1/api":5,"./asn1/base":7,"./asn1/constants":11,"./asn1/decoders":13,"./asn1/encoders":16,"bn.js":21}],5:[function(require,module,exports){
    var asn1 = require('../asn1');
    var inherits = require('inherits');

    var api = exports;

    api.define = function define(name, body) {
        return new Entity(name, body);
    };

    function Entity(name, body) {
        this.name = name;
        this.body = body;

        this.decoders = {};
        this.encoders = {};
    };

    Entity.prototype._createNamed = function createNamed(base) {
        var named;
        try {
            named = require('vm').runInThisContext(
                '(function ' + this.name + '(entity) {\n' +
                '  this._initNamed(entity);\n' +
                '})'
            );
        } catch (e) {
            named = function (entity) {
                this._initNamed(entity);
            };
        }
        inherits(named, base);
        named.prototype._initNamed = function initnamed(entity) {
            base.call(this, entity);
        };

        return new named(this);
    };

    Entity.prototype._getDecoder = function _getDecoder(enc) {
        enc = enc || 'der';
        // Lazily create decoder
        if (!this.decoders.hasOwnProperty(enc))
            this.decoders[enc] = this._createNamed(asn1.decoders[enc]);
        return this.decoders[enc];
    };

    Entity.prototype.decode = function decode(data, enc, options) {
        return this._getDecoder(enc).decode(data, options);
    };

    Entity.prototype._getEncoder = function _getEncoder(enc) {
        enc = enc || 'der';
        // Lazily create encoder
        if (!this.encoders.hasOwnProperty(enc))
            this.encoders[enc] = this._createNamed(asn1.encoders[enc]);
        return this.encoders[enc];
    };

    Entity.prototype.encode = function encode(data, enc, /* internal */ reporter) {
        return this._getEncoder(enc).encode(data, reporter);
    };

},{"../asn1":4,"inherits":113,"vm":199}],6:[function(require,module,exports){
    var inherits = require('inherits');
    var Reporter = require('../base').Reporter;
    var Buffer = require('buffer').Buffer;

    function DecoderBuffer(base, options) {
        Reporter.call(this, options);
        if (!Buffer.isBuffer(base)) {
            this.error('Input not Buffer');
            return;
        }

        this.base = base;
        this.offset = 0;
        this.length = base.length;
    }
    inherits(DecoderBuffer, Reporter);
    exports.DecoderBuffer = DecoderBuffer;

    DecoderBuffer.prototype.save = function save() {
        return { offset: this.offset, reporter: Reporter.prototype.save.call(this) };
    };

    DecoderBuffer.prototype.restore = function restore(save) {
        // Return skipped data
        var res = new DecoderBuffer(this.base);
        res.offset = save.offset;
        res.length = this.offset;

        this.offset = save.offset;
        Reporter.prototype.restore.call(this, save.reporter);

        return res;
    };

    DecoderBuffer.prototype.isEmpty = function isEmpty() {
        return this.offset === this.length;
    };

    DecoderBuffer.prototype.readUInt8 = function readUInt8(fail) {
        if (this.offset + 1 <= this.length)
            return this.base.readUInt8(this.offset++, true);
        else
            return this.error(fail || 'DecoderBuffer overrun');
    }

    DecoderBuffer.prototype.skip = function skip(bytes, fail) {
        if (!(this.offset + bytes <= this.length))
            return this.error(fail || 'DecoderBuffer overrun');

        var res = new DecoderBuffer(this.base);

        // Share reporter state
        res._reporterState = this._reporterState;

        res.offset = this.offset;
        res.length = this.offset + bytes;
        this.offset += bytes;
        return res;
    }

    DecoderBuffer.prototype.raw = function raw(save) {
        return this.base.slice(save ? save.offset : this.offset, this.length);
    }

    function EncoderBuffer(value, reporter) {
        if (Array.isArray(value)) {
            this.length = 0;
            this.value = value.map(function(item) {
                if (!(item instanceof EncoderBuffer))
                    item = new EncoderBuffer(item, reporter);
                this.length += item.length;
                return item;
            }, this);
        } else if (typeof value === 'number') {
            if (!(0 <= value && value <= 0xff))
                return reporter.error('non-byte EncoderBuffer value');
            this.value = value;
            this.length = 1;
        } else if (typeof value === 'string') {
            this.value = value;
            this.length = Buffer.byteLength(value);
        } else if (Buffer.isBuffer(value)) {
            this.value = value;
            this.length = value.length;
        } else {
            return reporter.error('Unsupported type: ' + typeof value);
        }
    }
    exports.EncoderBuffer = EncoderBuffer;

    EncoderBuffer.prototype.join = function join(out, offset) {
        if (!out)
            out = new Buffer(this.length);
        if (!offset)
            offset = 0;

        if (this.length === 0)
            return out;

        if (Array.isArray(this.value)) {
            this.value.forEach(function(item) {
                item.join(out, offset);
                offset += item.length;
            });
        } else {
            if (typeof this.value === 'number')
                out[offset] = this.value;
            else if (typeof this.value === 'string')
                out.write(this.value, offset);
            else if (Buffer.isBuffer(this.value))
                this.value.copy(out, offset);
            offset += this.length;
        }

        return out;
    };

},{"../base":7,"buffer":52,"inherits":113}],7:[function(require,module,exports){
    var base = exports;

    base.Reporter = require('./reporter').Reporter;
    base.DecoderBuffer = require('./buffer').DecoderBuffer;
    base.EncoderBuffer = require('./buffer').EncoderBuffer;
    base.Node = require('./node');

},{"./buffer":6,"./node":8,"./reporter":9}],8:[function(require,module,exports){
    var Reporter = require('../base').Reporter;
    var EncoderBuffer = require('../base').EncoderBuffer;
    var DecoderBuffer = require('../base').DecoderBuffer;
    var assert = require('minimalistic-assert');

// Supported tags
    var tags = [
        'seq', 'seqof', 'set', 'setof', 'objid', 'bool',
        'gentime', 'utctime', 'null_', 'enum', 'int', 'objDesc',
        'bitstr', 'bmpstr', 'charstr', 'genstr', 'graphstr', 'ia5str', 'iso646str',
        'numstr', 'octstr', 'printstr', 't61str', 'unistr', 'utf8str', 'videostr'
    ];

// Public methods list
    var methods = [
        'key', 'obj', 'use', 'optional', 'explicit', 'implicit', 'def', 'choice',
        'any', 'contains'
    ].concat(tags);

// Overrided methods list
    var overrided = [
        '_peekTag', '_decodeTag', '_use',
        '_decodeStr', '_decodeObjid', '_decodeTime',
        '_decodeNull', '_decodeInt', '_decodeBool', '_decodeList',

        '_encodeComposite', '_encodeStr', '_encodeObjid', '_encodeTime',
        '_encodeNull', '_encodeInt', '_encodeBool'
    ];

    function Node(enc, parent) {
        var state = {};
        this._baseState = state;

        state.enc = enc;

        state.parent = parent || null;
        state.children = null;

        // State
        state.tag = null;
        state.args = null;
        state.reverseArgs = null;
        state.choice = null;
        state.optional = false;
        state.any = false;
        state.obj = false;
        state.use = null;
        state.useDecoder = null;
        state.key = null;
        state['default'] = null;
        state.explicit = null;
        state.implicit = null;
        state.contains = null;

        // Should create new instance on each method
        if (!state.parent) {
            state.children = [];
            this._wrap();
        }
    }
    module.exports = Node;

    var stateProps = [
        'enc', 'parent', 'children', 'tag', 'args', 'reverseArgs', 'choice',
        'optional', 'any', 'obj', 'use', 'alteredUse', 'key', 'default', 'explicit',
        'implicit', 'contains'
    ];

    Node.prototype.clone = function clone() {
        var state = this._baseState;
        var cstate = {};
        stateProps.forEach(function(prop) {
            cstate[prop] = state[prop];
        });
        var res = new this.constructor(cstate.parent);
        res._baseState = cstate;
        return res;
    };

    Node.prototype._wrap = function wrap() {
        var state = this._baseState;
        methods.forEach(function(method) {
            this[method] = function _wrappedMethod() {
                var clone = new this.constructor(this);
                state.children.push(clone);
                return clone[method].apply(clone, arguments);
            };
        }, this);
    };

    Node.prototype._init = function init(body) {
        var state = this._baseState;

        assert(state.parent === null);
        body.call(this);

        // Filter children
        state.children = state.children.filter(function(child) {
            return child._baseState.parent === this;
        }, this);
        assert.equal(state.children.length, 1, 'Root node can have only one child');
    };

    Node.prototype._useArgs = function useArgs(args) {
        var state = this._baseState;

        // Filter children and args
        var children = args.filter(function(arg) {
            return arg instanceof this.constructor;
        }, this);
        args = args.filter(function(arg) {
            return !(arg instanceof this.constructor);
        }, this);

        if (children.length !== 0) {
            assert(state.children === null);
            state.children = children;

            // Replace parent to maintain backward link
            children.forEach(function(child) {
                child._baseState.parent = this;
            }, this);
        }
        if (args.length !== 0) {
            assert(state.args === null);
            state.args = args;
            state.reverseArgs = args.map(function(arg) {
                if (typeof arg !== 'object' || arg.constructor !== Object)
                    return arg;

                var res = {};
                Object.keys(arg).forEach(function(key) {
                    if (key == (key | 0))
                        key |= 0;
                    var value = arg[key];
                    res[value] = key;
                });
                return res;
            });
        }
    };

//
// Overrided methods
//

    overrided.forEach(function(method) {
        Node.prototype[method] = function _overrided() {
            var state = this._baseState;
            throw new Error(method + ' not implemented for encoding: ' + state.enc);
        };
    });

//
// Public methods
//

    tags.forEach(function(tag) {
        Node.prototype[tag] = function _tagMethod() {
            var state = this._baseState;
            var args = Array.prototype.slice.call(arguments);

            assert(state.tag === null);
            state.tag = tag;

            this._useArgs(args);

            return this;
        };
    });

    Node.prototype.use = function use(item) {
        assert(item);
        var state = this._baseState;

        assert(state.use === null);
        state.use = item;

        return this;
    };

    Node.prototype.optional = function optional() {
        var state = this._baseState;

        state.optional = true;

        return this;
    };

    Node.prototype.def = function def(val) {
        var state = this._baseState;

        assert(state['default'] === null);
        state['default'] = val;
        state.optional = true;

        return this;
    };

    Node.prototype.explicit = function explicit(num) {
        var state = this._baseState;

        assert(state.explicit === null && state.implicit === null);
        state.explicit = num;

        return this;
    };

    Node.prototype.implicit = function implicit(num) {
        var state = this._baseState;

        assert(state.explicit === null && state.implicit === null);
        state.implicit = num;

        return this;
    };

    Node.prototype.obj = function obj() {
        var state = this._baseState;
        var args = Array.prototype.slice.call(arguments);

        state.obj = true;

        if (args.length !== 0)
            this._useArgs(args);

        return this;
    };

    Node.prototype.key = function key(newKey) {
        var state = this._baseState;

        assert(state.key === null);
        state.key = newKey;

        return this;
    };

    Node.prototype.any = function any() {
        var state = this._baseState;

        state.any = true;

        return this;
    };

    Node.prototype.choice = function choice(obj) {
        var state = this._baseState;

        assert(state.choice === null);
        state.choice = obj;
        this._useArgs(Object.keys(obj).map(function(key) {
            return obj[key];
        }));

        return this;
    };

    Node.prototype.contains = function contains(item) {
        var state = this._baseState;

        assert(state.use === null);
        state.contains = item;

        return this;
    };

//
// Decoding
//

    Node.prototype._decode = function decode(input, options) {
        var state = this._baseState;

        // Decode root node
        if (state.parent === null)
            return input.wrapResult(state.children[0]._decode(input, options));

        var result = state['default'];
        var present = true;

        var prevKey = null;
        if (state.key !== null)
            prevKey = input.enterKey(state.key);

        // Check if tag is there
        if (state.optional) {
            var tag = null;
            if (state.explicit !== null)
                tag = state.explicit;
            else if (state.implicit !== null)
                tag = state.implicit;
            else if (state.tag !== null)
                tag = state.tag;

            if (tag === null && !state.any) {
                // Trial and Error
                var save = input.save();
                try {
                    if (state.choice === null)
                        this._decodeGeneric(state.tag, input, options);
                    else
                        this._decodeChoice(input, options);
                    present = true;
                } catch (e) {
                    present = false;
                }
                input.restore(save);
            } else {
                present = this._peekTag(input, tag, state.any);

                if (input.isError(present))
                    return present;
            }
        }

        // Push object on stack
        var prevObj;
        if (state.obj && present)
            prevObj = input.enterObject();

        if (present) {
            // Unwrap explicit values
            if (state.explicit !== null) {
                var explicit = this._decodeTag(input, state.explicit);
                if (input.isError(explicit))
                    return explicit;
                input = explicit;
            }

            var start = input.offset;

            // Unwrap implicit and normal values
            if (state.use === null && state.choice === null) {
                if (state.any)
                    var save = input.save();
                var body = this._decodeTag(
                    input,
                    state.implicit !== null ? state.implicit : state.tag,
                    state.any
                );
                if (input.isError(body))
                    return body;

                if (state.any)
                    result = input.raw(save);
                else
                    input = body;
            }

            if (options && options.track && state.tag !== null)
                options.track(input.path(), start, input.length, 'tagged');

            if (options && options.track && state.tag !== null)
                options.track(input.path(), input.offset, input.length, 'content');

            // Select proper method for tag
            if (state.any)
                result = result;
            else if (state.choice === null)
                result = this._decodeGeneric(state.tag, input, options);
            else
                result = this._decodeChoice(input, options);

            if (input.isError(result))
                return result;

            // Decode children
            if (!state.any && state.choice === null && state.children !== null) {
                state.children.forEach(function decodeChildren(child) {
                    // NOTE: We are ignoring errors here, to let parser continue with other
                    // parts of encoded data
                    child._decode(input, options);
                });
            }

            // Decode contained/encoded by schema, only in bit or octet strings
            if (state.contains && (state.tag === 'octstr' || state.tag === 'bitstr')) {
                var data = new DecoderBuffer(result);
                result = this._getUse(state.contains, input._reporterState.obj)
                    ._decode(data, options);
            }
        }

        // Pop object
        if (state.obj && present)
            result = input.leaveObject(prevObj);

        // Set key
        if (state.key !== null && (result !== null || present === true))
            input.leaveKey(prevKey, state.key, result);
        else if (prevKey !== null)
            input.exitKey(prevKey);

        return result;
    };

    Node.prototype._decodeGeneric = function decodeGeneric(tag, input, options) {
        var state = this._baseState;

        if (tag === 'seq' || tag === 'set')
            return null;
        if (tag === 'seqof' || tag === 'setof')
            return this._decodeList(input, tag, state.args[0], options);
        else if (/str$/.test(tag))
            return this._decodeStr(input, tag, options);
        else if (tag === 'objid' && state.args)
            return this._decodeObjid(input, state.args[0], state.args[1], options);
        else if (tag === 'objid')
            return this._decodeObjid(input, null, null, options);
        else if (tag === 'gentime' || tag === 'utctime')
            return this._decodeTime(input, tag, options);
        else if (tag === 'null_')
            return this._decodeNull(input, options);
        else if (tag === 'bool')
            return this._decodeBool(input, options);
        else if (tag === 'objDesc')
            return this._decodeStr(input, tag, options);
        else if (tag === 'int' || tag === 'enum')
            return this._decodeInt(input, state.args && state.args[0], options);

        if (state.use !== null) {
            return this._getUse(state.use, input._reporterState.obj)
                ._decode(input, options);
        } else {
            return input.error('unknown tag: ' + tag);
        }
    };

    Node.prototype._getUse = function _getUse(entity, obj) {

        var state = this._baseState;
        // Create altered use decoder if implicit is set
        state.useDecoder = this._use(entity, obj);
        assert(state.useDecoder._baseState.parent === null);
        state.useDecoder = state.useDecoder._baseState.children[0];
        if (state.implicit !== state.useDecoder._baseState.implicit) {
            state.useDecoder = state.useDecoder.clone();
            state.useDecoder._baseState.implicit = state.implicit;
        }
        return state.useDecoder;
    };

    Node.prototype._decodeChoice = function decodeChoice(input, options) {
        var state = this._baseState;
        var result = null;
        var match = false;

        Object.keys(state.choice).some(function(key) {
            var save = input.save();
            var node = state.choice[key];
            try {
                var value = node._decode(input, options);
                if (input.isError(value))
                    return false;

                result = { type: key, value: value };
                match = true;
            } catch (e) {
                input.restore(save);
                return false;
            }
            return true;
        }, this);

        if (!match)
            return input.error('Choice not matched');

        return result;
    };

//
// Encoding
//

    Node.prototype._createEncoderBuffer = function createEncoderBuffer(data) {
        return new EncoderBuffer(data, this.reporter);
    };

    Node.prototype._encode = function encode(data, reporter, parent) {
        var state = this._baseState;
        if (state['default'] !== null && state['default'] === data)
            return;

        var result = this._encodeValue(data, reporter, parent);
        if (result === undefined)
            return;

        if (this._skipDefault(result, reporter, parent))
            return;

        return result;
    };

    Node.prototype._encodeValue = function encode(data, reporter, parent) {
        var state = this._baseState;

        // Decode root node
        if (state.parent === null)
            return state.children[0]._encode(data, reporter || new Reporter());

        var result = null;

        // Set reporter to share it with a child class
        this.reporter = reporter;

        // Check if data is there
        if (state.optional && data === undefined) {
            if (state['default'] !== null)
                data = state['default']
            else
                return;
        }

        // Encode children first
        var content = null;
        var primitive = false;
        if (state.any) {
            // Anything that was given is translated to buffer
            result = this._createEncoderBuffer(data);
        } else if (state.choice) {
            result = this._encodeChoice(data, reporter);
        } else if (state.contains) {
            content = this._getUse(state.contains, parent)._encode(data, reporter);
            primitive = true;
        } else if (state.children) {
            content = state.children.map(function(child) {
                if (child._baseState.tag === 'null_')
                    return child._encode(null, reporter, data);

                if (child._baseState.key === null)
                    return reporter.error('Child should have a key');
                var prevKey = reporter.enterKey(child._baseState.key);

                if (typeof data !== 'object')
                    return reporter.error('Child expected, but input is not object');

                var res = child._encode(data[child._baseState.key], reporter, data);
                reporter.leaveKey(prevKey);

                return res;
            }, this).filter(function(child) {
                return child;
            });
            content = this._createEncoderBuffer(content);
        } else {
            if (state.tag === 'seqof' || state.tag === 'setof') {
                // TODO(indutny): this should be thrown on DSL level
                if (!(state.args && state.args.length === 1))
                    return reporter.error('Too many args for : ' + state.tag);

                if (!Array.isArray(data))
                    return reporter.error('seqof/setof, but data is not Array');

                var child = this.clone();
                child._baseState.implicit = null;
                content = this._createEncoderBuffer(data.map(function(item) {
                    var state = this._baseState;

                    return this._getUse(state.args[0], data)._encode(item, reporter);
                }, child));
            } else if (state.use !== null) {
                result = this._getUse(state.use, parent)._encode(data, reporter);
            } else {
                content = this._encodePrimitive(state.tag, data);
                primitive = true;
            }
        }

        // Encode data itself
        var result;
        if (!state.any && state.choice === null) {
            var tag = state.implicit !== null ? state.implicit : state.tag;
            var cls = state.implicit === null ? 'universal' : 'context';

            if (tag === null) {
                if (state.use === null)
                    reporter.error('Tag could be omitted only for .use()');
            } else {
                if (state.use === null)
                    result = this._encodeComposite(tag, primitive, cls, content);
            }
        }

        // Wrap in explicit
        if (state.explicit !== null)
            result = this._encodeComposite(state.explicit, false, 'context', result);

        return result;
    };

    Node.prototype._encodeChoice = function encodeChoice(data, reporter) {
        var state = this._baseState;

        var node = state.choice[data.type];
        if (!node) {
            assert(
                false,
                data.type + ' not found in ' +
                JSON.stringify(Object.keys(state.choice)));
        }
        return node._encode(data.value, reporter);
    };

    Node.prototype._encodePrimitive = function encodePrimitive(tag, data) {
        var state = this._baseState;

        if (/str$/.test(tag))
            return this._encodeStr(data, tag);
        else if (tag === 'objid' && state.args)
            return this._encodeObjid(data, state.reverseArgs[0], state.args[1]);
        else if (tag === 'objid')
            return this._encodeObjid(data, null, null);
        else if (tag === 'gentime' || tag === 'utctime')
            return this._encodeTime(data, tag);
        else if (tag === 'null_')
            return this._encodeNull();
        else if (tag === 'int' || tag === 'enum')
            return this._encodeInt(data, state.args && state.reverseArgs[0]);
        else if (tag === 'bool')
            return this._encodeBool(data);
        else if (tag === 'objDesc')
            return this._encodeStr(data, tag);
        else
            throw new Error('Unsupported tag: ' + tag);
    };

    Node.prototype._isNumstr = function isNumstr(str) {
        return /^[0-9 ]*$/.test(str);
    };

    Node.prototype._isPrintstr = function isPrintstr(str) {
        return /^[A-Za-z0-9 '\(\)\+,\-\.\/:=\?]*$/.test(str);
    };

},{"../base":7,"minimalistic-assert":121}],9:[function(require,module,exports){
    var inherits = require('inherits');

    function Reporter(options) {
        this._reporterState = {
            obj: null,
            path: [],
            options: options || {},
            errors: []
        };
    }
    exports.Reporter = Reporter;

    Reporter.prototype.isError = function isError(obj) {
        return obj instanceof ReporterError;
    };

    Reporter.prototype.save = function save() {
        var state = this._reporterState;

        return { obj: state.obj, pathLen: state.path.length };
    };

    Reporter.prototype.restore = function restore(data) {
        var state = this._reporterState;

        state.obj = data.obj;
        state.path = state.path.slice(0, data.pathLen);
    };

    Reporter.prototype.enterKey = function enterKey(key) {
        return this._reporterState.path.push(key);
    };

    Reporter.prototype.exitKey = function exitKey(index) {
        var state = this._reporterState;

        state.path = state.path.slice(0, index - 1);
    };

    Reporter.prototype.leaveKey = function leaveKey(index, key, value) {
        var state = this._reporterState;

        this.exitKey(index);
        if (state.obj !== null)
            state.obj[key] = value;
    };

    Reporter.prototype.path = function path() {
        return this._reporterState.path.join('/');
    };

    Reporter.prototype.enterObject = function enterObject() {
        var state = this._reporterState;

        var prev = state.obj;
        state.obj = {};
        return prev;
    };

    Reporter.prototype.leaveObject = function leaveObject(prev) {
        var state = this._reporterState;

        var now = state.obj;
        state.obj = prev;
        return now;
    };

    Reporter.prototype.error = function error(msg) {
        var err;
        var state = this._reporterState;

        var inherited = msg instanceof ReporterError;
        if (inherited) {
            err = msg;
        } else {
            err = new ReporterError(state.path.map(function(elem) {
                return '[' + JSON.stringify(elem) + ']';
            }).join(''), msg.message || msg, msg.stack);
        }

        if (!state.options.partial)
            throw err;

        if (!inherited)
            state.errors.push(err);

        return err;
    };

    Reporter.prototype.wrapResult = function wrapResult(result) {
        var state = this._reporterState;
        if (!state.options.partial)
            return result;

        return {
            result: this.isError(result) ? null : result,
            errors: state.errors
        };
    };

    function ReporterError(path, msg) {
        this.path = path;
        this.rethrow(msg);
    };
    inherits(ReporterError, Error);

    ReporterError.prototype.rethrow = function rethrow(msg) {
        this.message = msg + ' at: ' + (this.path || '(shallow)');
        if (Error.captureStackTrace)
            Error.captureStackTrace(this, ReporterError);

        if (!this.stack) {
            try {
                // IE only adds stack when thrown
                throw new Error(this.message);
            } catch (e) {
                this.stack = e.stack;
            }
        }
        return this;
    };

},{"inherits":113}],10:[function(require,module,exports){
    var constants = require('../constants');

    exports.tagClass = {
        0: 'universal',
        1: 'application',
        2: 'context',
        3: 'private'
    };
    exports.tagClassByName = constants._reverse(exports.tagClass);

    exports.tag = {
        0x00: 'end',
        0x01: 'bool',
        0x02: 'int',
        0x03: 'bitstr',
        0x04: 'octstr',
        0x05: 'null_',
        0x06: 'objid',
        0x07: 'objDesc',
        0x08: 'external',
        0x09: 'real',
        0x0a: 'enum',
        0x0b: 'embed',
        0x0c: 'utf8str',
        0x0d: 'relativeOid',
        0x10: 'seq',
        0x11: 'set',
        0x12: 'numstr',
        0x13: 'printstr',
        0x14: 't61str',
        0x15: 'videostr',
        0x16: 'ia5str',
        0x17: 'utctime',
        0x18: 'gentime',
        0x19: 'graphstr',
        0x1a: 'iso646str',
        0x1b: 'genstr',
        0x1c: 'unistr',
        0x1d: 'charstr',
        0x1e: 'bmpstr'
    };
    exports.tagByName = constants._reverse(exports.tag);

},{"../constants":11}],11:[function(require,module,exports){
    var constants = exports;

// Helper
    constants._reverse = function reverse(map) {
        var res = {};

        Object.keys(map).forEach(function(key) {
            // Convert key to integer if it is stringified
            if ((key | 0) == key)
                key = key | 0;

            var value = map[key];
            res[value] = key;
        });

        return res;
    };

    constants.der = require('./der');

},{"./der":10}],12:[function(require,module,exports){
    var inherits = require('inherits');

    var asn1 = require('../../asn1');
    var base = asn1.base;
    var bignum = asn1.bignum;

// Import DER constants
    var der = asn1.constants.der;

    function DERDecoder(entity) {
        this.enc = 'der';
        this.name = entity.name;
        this.entity = entity;

        // Construct base tree
        this.tree = new DERNode();
        this.tree._init(entity.body);
    };
    module.exports = DERDecoder;

    DERDecoder.prototype.decode = function decode(data, options) {
        if (!(data instanceof base.DecoderBuffer))
            data = new base.DecoderBuffer(data, options);

        return this.tree._decode(data, options);
    };

// Tree methods

    function DERNode(parent) {
        base.Node.call(this, 'der', parent);
    }
    inherits(DERNode, base.Node);

    DERNode.prototype._peekTag = function peekTag(buffer, tag, any) {
        if (buffer.isEmpty())
            return false;

        var state = buffer.save();
        var decodedTag = derDecodeTag(buffer, 'Failed to peek tag: "' + tag + '"');
        if (buffer.isError(decodedTag))
            return decodedTag;

        buffer.restore(state);

        return decodedTag.tag === tag || decodedTag.tagStr === tag ||
            (decodedTag.tagStr + 'of') === tag || any;
    };

    DERNode.prototype._decodeTag = function decodeTag(buffer, tag, any) {
        var decodedTag = derDecodeTag(buffer,
            'Failed to decode tag of "' + tag + '"');
        if (buffer.isError(decodedTag))
            return decodedTag;

        var len = derDecodeLen(buffer,
            decodedTag.primitive,
            'Failed to get length of "' + tag + '"');

        // Failure
        if (buffer.isError(len))
            return len;

        if (!any &&
            decodedTag.tag !== tag &&
            decodedTag.tagStr !== tag &&
            decodedTag.tagStr + 'of' !== tag) {
            return buffer.error('Failed to match tag: "' + tag + '"');
        }

        if (decodedTag.primitive || len !== null)
            return buffer.skip(len, 'Failed to match body of: "' + tag + '"');

        // Indefinite length... find END tag
        var state = buffer.save();
        var res = this._skipUntilEnd(
            buffer,
            'Failed to skip indefinite length body: "' + this.tag + '"');
        if (buffer.isError(res))
            return res;

        len = buffer.offset - state.offset;
        buffer.restore(state);
        return buffer.skip(len, 'Failed to match body of: "' + tag + '"');
    };

    DERNode.prototype._skipUntilEnd = function skipUntilEnd(buffer, fail) {
        while (true) {
            var tag = derDecodeTag(buffer, fail);
            if (buffer.isError(tag))
                return tag;
            var len = derDecodeLen(buffer, tag.primitive, fail);
            if (buffer.isError(len))
                return len;

            var res;
            if (tag.primitive || len !== null)
                res = buffer.skip(len)
            else
                res = this._skipUntilEnd(buffer, fail);

            // Failure
            if (buffer.isError(res))
                return res;

            if (tag.tagStr === 'end')
                break;
        }
    };

    DERNode.prototype._decodeList = function decodeList(buffer, tag, decoder,
                                                        options) {
        var result = [];
        while (!buffer.isEmpty()) {
            var possibleEnd = this._peekTag(buffer, 'end');
            if (buffer.isError(possibleEnd))
                return possibleEnd;

            var res = decoder.decode(buffer, 'der', options);
            if (buffer.isError(res) && possibleEnd)
                break;
            result.push(res);
        }
        return result;
    };

    DERNode.prototype._decodeStr = function decodeStr(buffer, tag) {
        if (tag === 'bitstr') {
            var unused = buffer.readUInt8();
            if (buffer.isError(unused))
                return unused;
            return { unused: unused, data: buffer.raw() };
        } else if (tag === 'bmpstr') {
            var raw = buffer.raw();
            if (raw.length % 2 === 1)
                return buffer.error('Decoding of string type: bmpstr length mismatch');

            var str = '';
            for (var i = 0; i < raw.length / 2; i++) {
                str += String.fromCharCode(raw.readUInt16BE(i * 2));
            }
            return str;
        } else if (tag === 'numstr') {
            var numstr = buffer.raw().toString('ascii');
            if (!this._isNumstr(numstr)) {
                return buffer.error('Decoding of string type: ' +
                    'numstr unsupported characters');
            }
            return numstr;
        } else if (tag === 'octstr') {
            return buffer.raw();
        } else if (tag === 'objDesc') {
            return buffer.raw();
        } else if (tag === 'printstr') {
            var printstr = buffer.raw().toString('ascii');
            if (!this._isPrintstr(printstr)) {
                return buffer.error('Decoding of string type: ' +
                    'printstr unsupported characters');
            }
            return printstr;
        } else if (/str$/.test(tag)) {
            return buffer.raw().toString();
        } else {
            return buffer.error('Decoding of string type: ' + tag + ' unsupported');
        }
    };

    DERNode.prototype._decodeObjid = function decodeObjid(buffer, values, relative) {
        var result;
        var identifiers = [];
        var ident = 0;
        while (!buffer.isEmpty()) {
            var subident = buffer.readUInt8();
            ident <<= 7;
            ident |= subident & 0x7f;
            if ((subident & 0x80) === 0) {
                identifiers.push(ident);
                ident = 0;
            }
        }
        if (subident & 0x80)
            identifiers.push(ident);

        var first = (identifiers[0] / 40) | 0;
        var second = identifiers[0] % 40;

        if (relative)
            result = identifiers;
        else
            result = [first, second].concat(identifiers.slice(1));

        if (values) {
            var tmp = values[result.join(' ')];
            if (tmp === undefined)
                tmp = values[result.join('.')];
            if (tmp !== undefined)
                result = tmp;
        }

        return result;
    };

    DERNode.prototype._decodeTime = function decodeTime(buffer, tag) {
        var str = buffer.raw().toString();
        if (tag === 'gentime') {
            var year = str.slice(0, 4) | 0;
            var mon = str.slice(4, 6) | 0;
            var day = str.slice(6, 8) | 0;
            var hour = str.slice(8, 10) | 0;
            var min = str.slice(10, 12) | 0;
            var sec = str.slice(12, 14) | 0;
        } else if (tag === 'utctime') {
            var year = str.slice(0, 2) | 0;
            var mon = str.slice(2, 4) | 0;
            var day = str.slice(4, 6) | 0;
            var hour = str.slice(6, 8) | 0;
            var min = str.slice(8, 10) | 0;
            var sec = str.slice(10, 12) | 0;
            if (year < 70)
                year = 2000 + year;
            else
                year = 1900 + year;
        } else {
            return buffer.error('Decoding ' + tag + ' time is not supported yet');
        }

        return Date.UTC(year, mon - 1, day, hour, min, sec, 0);
    };

    DERNode.prototype._decodeNull = function decodeNull(buffer) {
        return null;
    };

    DERNode.prototype._decodeBool = function decodeBool(buffer) {
        var res = buffer.readUInt8();
        if (buffer.isError(res))
            return res;
        else
            return res !== 0;
    };

    DERNode.prototype._decodeInt = function decodeInt(buffer, values) {
        // Bigint, return as it is (assume big endian)
        var raw = buffer.raw();
        var res = new bignum(raw);

        if (values)
            res = values[res.toString(10)] || res;

        return res;
    };

    DERNode.prototype._use = function use(entity, obj) {
        if (typeof entity === 'function')
            entity = entity(obj);
        return entity._getDecoder('der').tree;
    };

// Utility methods

    function derDecodeTag(buf, fail) {
        var tag = buf.readUInt8(fail);
        if (buf.isError(tag))
            return tag;

        var cls = der.tagClass[tag >> 6];
        var primitive = (tag & 0x20) === 0;

        // Multi-octet tag - load
        if ((tag & 0x1f) === 0x1f) {
            var oct = tag;
            tag = 0;
            while ((oct & 0x80) === 0x80) {
                oct = buf.readUInt8(fail);
                if (buf.isError(oct))
                    return oct;

                tag <<= 7;
                tag |= oct & 0x7f;
            }
        } else {
            tag &= 0x1f;
        }
        var tagStr = der.tag[tag];

        return {
            cls: cls,
            primitive: primitive,
            tag: tag,
            tagStr: tagStr
        };
    }

    function derDecodeLen(buf, primitive, fail) {
        var len = buf.readUInt8(fail);
        if (buf.isError(len))
            return len;

        // Indefinite form
        if (!primitive && len === 0x80)
            return null;

        // Definite form
        if ((len & 0x80) === 0) {
            // Short form
            return len;
        }

        // Long form
        var num = len & 0x7f;
        if (num > 4)
            return buf.error('length octect is too long');

        len = 0;
        for (var i = 0; i < num; i++) {
            len <<= 8;
            var j = buf.readUInt8(fail);
            if (buf.isError(j))
                return j;
            len |= j;
        }

        return len;
    }

},{"../../asn1":4,"inherits":113}],13:[function(require,module,exports){
    var decoders = exports;

    decoders.der = require('./der');
    decoders.pem = require('./pem');

},{"./der":12,"./pem":14}],14:[function(require,module,exports){
    var inherits = require('inherits');
    var Buffer = require('buffer').Buffer;

    var DERDecoder = require('./der');

    function PEMDecoder(entity) {
        DERDecoder.call(this, entity);
        this.enc = 'pem';
    };
    inherits(PEMDecoder, DERDecoder);
    module.exports = PEMDecoder;

    PEMDecoder.prototype.decode = function decode(data, options) {
        var lines = data.toString().split(/[\r\n]+/g);

        var label = options.label.toUpperCase();

        var re = /^-----(BEGIN|END) ([^-]+)-----$/;
        var start = -1;
        var end = -1;
        for (var i = 0; i < lines.length; i++) {
            var match = lines[i].match(re);
            if (match === null)
                continue;

            if (match[2] !== label)
                continue;

            if (start === -1) {
                if (match[1] !== 'BEGIN')
                    break;
                start = i;
            } else {
                if (match[1] !== 'END')
                    break;
                end = i;
                break;
            }
        }
        if (start === -1 || end === -1)
            throw new Error('PEM section not found for: ' + label);

        var base64 = lines.slice(start + 1, end).join('');
        // Remove excessive symbols
        base64.replace(/[^a-z0-9\+\/=]+/gi, '');

        var input = new Buffer(base64, 'base64');
        return DERDecoder.prototype.decode.call(this, input, options);
    };

},{"./der":12,"buffer":52,"inherits":113}],15:[function(require,module,exports){
    var inherits = require('inherits');
    var Buffer = require('buffer').Buffer;

    var asn1 = require('../../asn1');
    var base = asn1.base;

// Import DER constants
    var der = asn1.constants.der;

    function DEREncoder(entity) {
        this.enc = 'der';
        this.name = entity.name;
        this.entity = entity;

        // Construct base tree
        this.tree = new DERNode();
        this.tree._init(entity.body);
    };
    module.exports = DEREncoder;

    DEREncoder.prototype.encode = function encode(data, reporter) {
        return this.tree._encode(data, reporter).join();
    };

// Tree methods

    function DERNode(parent) {
        base.Node.call(this, 'der', parent);
    }
    inherits(DERNode, base.Node);

    DERNode.prototype._encodeComposite = function encodeComposite(tag,
                                                                  primitive,
                                                                  cls,
                                                                  content) {
        var encodedTag = encodeTag(tag, primitive, cls, this.reporter);

        // Short form
        if (content.length < 0x80) {
            var header = new Buffer(2);
            header[0] = encodedTag;
            header[1] = content.length;
            return this._createEncoderBuffer([ header, content ]);
        }

        // Long form
        // Count octets required to store length
        var lenOctets = 1;
        for (var i = content.length; i >= 0x100; i >>= 8)
            lenOctets++;

        var header = new Buffer(1 + 1 + lenOctets);
        header[0] = encodedTag;
        header[1] = 0x80 | lenOctets;

        for (var i = 1 + lenOctets, j = content.length; j > 0; i--, j >>= 8)
            header[i] = j & 0xff;

        return this._createEncoderBuffer([ header, content ]);
    };

    DERNode.prototype._encodeStr = function encodeStr(str, tag) {
        if (tag === 'bitstr') {
            return this._createEncoderBuffer([ str.unused | 0, str.data ]);
        } else if (tag === 'bmpstr') {
            var buf = new Buffer(str.length * 2);
            for (var i = 0; i < str.length; i++) {
                buf.writeUInt16BE(str.charCodeAt(i), i * 2);
            }
            return this._createEncoderBuffer(buf);
        } else if (tag === 'numstr') {
            if (!this._isNumstr(str)) {
                return this.reporter.error('Encoding of string type: numstr supports ' +
                    'only digits and space');
            }
            return this._createEncoderBuffer(str);
        } else if (tag === 'printstr') {
            if (!this._isPrintstr(str)) {
                return this.reporter.error('Encoding of string type: printstr supports ' +
                    'only latin upper and lower case letters, ' +
                    'digits, space, apostrophe, left and rigth ' +
                    'parenthesis, plus sign, comma, hyphen, ' +
                    'dot, slash, colon, equal sign, ' +
                    'question mark');
            }
            return this._createEncoderBuffer(str);
        } else if (/str$/.test(tag)) {
            return this._createEncoderBuffer(str);
        } else if (tag === 'objDesc') {
            return this._createEncoderBuffer(str);
        } else {
            return this.reporter.error('Encoding of string type: ' + tag +
                ' unsupported');
        }
    };

    DERNode.prototype._encodeObjid = function encodeObjid(id, values, relative) {
        if (typeof id === 'string') {
            if (!values)
                return this.reporter.error('string objid given, but no values map found');
            if (!values.hasOwnProperty(id))
                return this.reporter.error('objid not found in values map');
            id = values[id].split(/[\s\.]+/g);
            for (var i = 0; i < id.length; i++)
                id[i] |= 0;
        } else if (Array.isArray(id)) {
            id = id.slice();
            for (var i = 0; i < id.length; i++)
                id[i] |= 0;
        }

        if (!Array.isArray(id)) {
            return this.reporter.error('objid() should be either array or string, ' +
                'got: ' + JSON.stringify(id));
        }

        if (!relative) {
            if (id[1] >= 40)
                return this.reporter.error('Second objid identifier OOB');
            id.splice(0, 2, id[0] * 40 + id[1]);
        }

        // Count number of octets
        var size = 0;
        for (var i = 0; i < id.length; i++) {
            var ident = id[i];
            for (size++; ident >= 0x80; ident >>= 7)
                size++;
        }

        var objid = new Buffer(size);
        var offset = objid.length - 1;
        for (var i = id.length - 1; i >= 0; i--) {
            var ident = id[i];
            objid[offset--] = ident & 0x7f;
            while ((ident >>= 7) > 0)
                objid[offset--] = 0x80 | (ident & 0x7f);
        }

        return this._createEncoderBuffer(objid);
    };

    function two(num) {
        if (num < 10)
            return '0' + num;
        else
            return num;
    }

    DERNode.prototype._encodeTime = function encodeTime(time, tag) {
        var str;
        var date = new Date(time);

        if (tag === 'gentime') {
            str = [
                two(date.getFullYear()),
                two(date.getUTCMonth() + 1),
                two(date.getUTCDate()),
                two(date.getUTCHours()),
                two(date.getUTCMinutes()),
                two(date.getUTCSeconds()),
                'Z'
            ].join('');
        } else if (tag === 'utctime') {
            str = [
                two(date.getFullYear() % 100),
                two(date.getUTCMonth() + 1),
                two(date.getUTCDate()),
                two(date.getUTCHours()),
                two(date.getUTCMinutes()),
                two(date.getUTCSeconds()),
                'Z'
            ].join('');
        } else {
            this.reporter.error('Encoding ' + tag + ' time is not supported yet');
        }

        return this._encodeStr(str, 'octstr');
    };

    DERNode.prototype._encodeNull = function encodeNull() {
        return this._createEncoderBuffer('');
    };

    DERNode.prototype._encodeInt = function encodeInt(num, values) {
        if (typeof num === 'string') {
            if (!values)
                return this.reporter.error('String int or enum given, but no values map');
            if (!values.hasOwnProperty(num)) {
                return this.reporter.error('Values map doesn\'t contain: ' +
                    JSON.stringify(num));
            }
            num = values[num];
        }

        // Bignum, assume big endian
        if (typeof num !== 'number' && !Buffer.isBuffer(num)) {
            var numArray = num.toArray();
            if (!num.sign && numArray[0] & 0x80) {
                numArray.unshift(0);
            }
            num = new Buffer(numArray);
        }

        if (Buffer.isBuffer(num)) {
            var size = num.length;
            if (num.length === 0)
                size++;

            var out = new Buffer(size);
            num.copy(out);
            if (num.length === 0)
                out[0] = 0
            return this._createEncoderBuffer(out);
        }

        if (num < 0x80)
            return this._createEncoderBuffer(num);

        if (num < 0x100)
            return this._createEncoderBuffer([0, num]);

        var size = 1;
        for (var i = num; i >= 0x100; i >>= 8)
            size++;

        var out = new Array(size);
        for (var i = out.length - 1; i >= 0; i--) {
            out[i] = num & 0xff;
            num >>= 8;
        }
        if(out[0] & 0x80) {
            out.unshift(0);
        }

        return this._createEncoderBuffer(new Buffer(out));
    };

    DERNode.prototype._encodeBool = function encodeBool(value) {
        return this._createEncoderBuffer(value ? 0xff : 0);
    };

    DERNode.prototype._use = function use(entity, obj) {
        if (typeof entity === 'function')
            entity = entity(obj);
        return entity._getEncoder('der').tree;
    };

    DERNode.prototype._skipDefault = function skipDefault(dataBuffer, reporter, parent) {
        var state = this._baseState;
        var i;
        if (state['default'] === null)
            return false;

        var data = dataBuffer.join();
        if (state.defaultBuffer === undefined)
            state.defaultBuffer = this._encodeValue(state['default'], reporter, parent).join();

        if (data.length !== state.defaultBuffer.length)
            return false;

        for (i=0; i < data.length; i++)
            if (data[i] !== state.defaultBuffer[i])
                return false;

        return true;
    };

// Utility methods

    function encodeTag(tag, primitive, cls, reporter) {
        var res;

        if (tag === 'seqof')
            tag = 'seq';
        else if (tag === 'setof')
            tag = 'set';

        if (der.tagByName.hasOwnProperty(tag))
            res = der.tagByName[tag];
        else if (typeof tag === 'number' && (tag | 0) === tag)
            res = tag;
        else
            return reporter.error('Unknown tag: ' + tag);

        if (res >= 0x1f)
            return reporter.error('Multi-octet tag encoding unsupported');

        if (!primitive)
            res |= 0x20;

        res |= (der.tagClassByName[cls || 'universal'] << 6);

        return res;
    }

},{"../../asn1":4,"buffer":52,"inherits":113}],16:[function(require,module,exports){
    var encoders = exports;

    encoders.der = require('./der');
    encoders.pem = require('./pem');

},{"./der":15,"./pem":17}],17:[function(require,module,exports){
    var inherits = require('inherits');

    var DEREncoder = require('./der');

    function PEMEncoder(entity) {
        DEREncoder.call(this, entity);
        this.enc = 'pem';
    };
    inherits(PEMEncoder, DEREncoder);
    module.exports = PEMEncoder;

    PEMEncoder.prototype.encode = function encode(data, options) {
        var buf = DEREncoder.prototype.encode.call(this, data);

        var p = buf.toString('base64');
        var out = [ '-----BEGIN ' + options.label + '-----' ];
        for (var i = 0; i < p.length; i += 64)
            out.push(p.slice(i, i + 64));
        out.push('-----END ' + options.label + '-----');
        return out.join('\n');
    };

},{"./der":15,"inherits":113}],18:[function(require,module,exports){
    'use strict'

    exports.byteLength = byteLength
    exports.toByteArray = toByteArray
    exports.fromByteArray = fromByteArray

    var lookup = []
    var revLookup = []
    var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

    var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    for (var i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i]
        revLookup[code.charCodeAt(i)] = i
    }

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
    revLookup['-'.charCodeAt(0)] = 62
    revLookup['_'.charCodeAt(0)] = 63

    function getLens (b64) {
        var len = b64.length

        if (len % 4 > 0) {
            throw new Error('Invalid string. Length must be a multiple of 4')
        }

        // Trim off extra bytes after placeholder bytes are found
        // See: https://github.com/beatgammit/base64-js/issues/42
        var validLen = b64.indexOf('=')
        if (validLen === -1) validLen = len

        var placeHoldersLen = validLen === len
            ? 0
            : 4 - (validLen % 4)

        return [validLen, placeHoldersLen]
    }

// base64 is 4/3 + up to two characters of the original data
    function byteLength (b64) {
        var lens = getLens(b64)
        var validLen = lens[0]
        var placeHoldersLen = lens[1]
        return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
    }

    function _byteLength (b64, validLen, placeHoldersLen) {
        return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
    }

    function toByteArray (b64) {
        var tmp
        var lens = getLens(b64)
        var validLen = lens[0]
        var placeHoldersLen = lens[1]

        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

        var curByte = 0

        // if there are placeholders, only get up to the last complete 4 chars
        var len = placeHoldersLen > 0
            ? validLen - 4
            : validLen

        for (var i = 0; i < len; i += 4) {
            tmp =
                (revLookup[b64.charCodeAt(i)] << 18) |
                (revLookup[b64.charCodeAt(i + 1)] << 12) |
                (revLookup[b64.charCodeAt(i + 2)] << 6) |
                revLookup[b64.charCodeAt(i + 3)]
            arr[curByte++] = (tmp >> 16) & 0xFF
            arr[curByte++] = (tmp >> 8) & 0xFF
            arr[curByte++] = tmp & 0xFF
        }

        if (placeHoldersLen === 2) {
            tmp =
                (revLookup[b64.charCodeAt(i)] << 2) |
                (revLookup[b64.charCodeAt(i + 1)] >> 4)
            arr[curByte++] = tmp & 0xFF
        }

        if (placeHoldersLen === 1) {
            tmp =
                (revLookup[b64.charCodeAt(i)] << 10) |
                (revLookup[b64.charCodeAt(i + 1)] << 4) |
                (revLookup[b64.charCodeAt(i + 2)] >> 2)
            arr[curByte++] = (tmp >> 8) & 0xFF
            arr[curByte++] = tmp & 0xFF
        }

        return arr
    }

    function tripletToBase64 (num) {
        return lookup[num >> 18 & 0x3F] +
            lookup[num >> 12 & 0x3F] +
            lookup[num >> 6 & 0x3F] +
            lookup[num & 0x3F]
    }

    function encodeChunk (uint8, start, end) {
        var tmp
        var output = []
        for (var i = start; i < end; i += 3) {
            tmp =
                ((uint8[i] << 16) & 0xFF0000) +
                ((uint8[i + 1] << 8) & 0xFF00) +
                (uint8[i + 2] & 0xFF)
            output.push(tripletToBase64(tmp))
        }
        return output.join('')
    }

    function fromByteArray (uint8) {
        var tmp
        var len = uint8.length
        var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
        var parts = []
        var maxChunkLength = 16383 // must be multiple of 3

        // go through the array every three bytes, we'll deal with trailing stuff later
        for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
            parts.push(encodeChunk(
                uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
            ))
        }

        // pad the end with zeros, but make sure to not forget the extra bytes
        if (extraBytes === 1) {
            tmp = uint8[len - 1]
            parts.push(
                lookup[tmp >> 2] +
                lookup[(tmp << 4) & 0x3F] +
                '=='
            )
        } else if (extraBytes === 2) {
            tmp = (uint8[len - 2] << 8) + uint8[len - 1]
            parts.push(
                lookup[tmp >> 10] +
                lookup[(tmp >> 4) & 0x3F] +
                lookup[(tmp << 2) & 0x3F] +
                '='
            )
        }

        return parts.join('')
    }

},{}],19:[function(require,module,exports){
    ;(function (globalObject) {
        'use strict';

        /*
         *      bignumber.js v6.0.0
         *      A JavaScript library for arbitrary-precision arithmetic.
         *      https://github.com/MikeMcl/bignumber.js
         *      Copyright (c) 2018 Michael Mclaughlin <M8ch88l@gmail.com>
         *      MIT Licensed.
         *
         *      BigNumber.prototype methods     |  BigNumber methods
         *                                      |
         *      absoluteValue            abs    |  clone
         *      comparedTo                      |  config               set
         *      decimalPlaces            dp     |      DECIMAL_PLACES
         *      dividedBy                div    |      ROUNDING_MODE
         *      dividedToIntegerBy       idiv   |      EXPONENTIAL_AT
         *      exponentiatedBy          pow    |      RANGE
         *      integerValue                    |      CRYPTO
         *      isEqualTo                eq     |      MODULO_MODE
         *      isFinite                        |      POW_PRECISION
         *      isGreaterThan            gt     |      FORMAT
         *      isGreaterThanOrEqualTo   gte    |      ALPHABET
         *      isInteger                       |  isBigNumber
         *      isLessThan               lt     |  maximum              max
         *      isLessThanOrEqualTo      lte    |  minimum              min
         *      isNaN                           |  random
         *      isNegative                      |
         *      isPositive                      |
         *      isZero                          |
         *      minus                           |
         *      modulo                   mod    |
         *      multipliedBy             times  |
         *      negated                         |
         *      plus                            |
         *      precision                sd     |
         *      shiftedBy                       |
         *      squareRoot               sqrt   |
         *      toExponential                   |
         *      toFixed                         |
         *      toFormat                        |
         *      toFraction                      |
         *      toJSON                          |
         *      toNumber                        |
         *      toPrecision                     |
         *      toString                        |
         *      valueOf                         |
         *
         */


        var BigNumber,
            isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,

            mathceil = Math.ceil,
            mathfloor = Math.floor,

            bignumberError = '[BigNumber Error] ',
            tooManyDigits = bignumberError + 'Number primitive has more than 15 significant digits: ',

            BASE = 1e14,
            LOG_BASE = 14,
            MAX_SAFE_INTEGER = 0x1fffffffffffff,         // 2^53 - 1
            // MAX_INT32 = 0x7fffffff,                   // 2^31 - 1
            POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13],
            SQRT_BASE = 1e7,

            // EDITABLE
            // The limit on the value of DECIMAL_PLACES, TO_EXP_NEG, TO_EXP_POS, MIN_EXP, MAX_EXP, and
            // the arguments to toExponential, toFixed, toFormat, and toPrecision.
            MAX = 1E9;                                   // 0 to MAX_INT32


        /*
         * Create and return a BigNumber constructor.
         */
        function clone(configObject) {
            var div, convertBase, parseNumeric,
                P = BigNumber.prototype,
                ONE = new BigNumber(1),


                //----------------------------- EDITABLE CONFIG DEFAULTS -------------------------------


                // The default values below must be integers within the inclusive ranges stated.
                // The values can also be changed at run-time using BigNumber.set.

                // The maximum number of decimal places for operations involving division.
                DECIMAL_PLACES = 20,                     // 0 to MAX

                // The rounding mode used when rounding to the above decimal places, and when using
                // toExponential, toFixed, toFormat and toPrecision, and round (default value).
                // UP         0 Away from zero.
                // DOWN       1 Towards zero.
                // CEIL       2 Towards +Infinity.
                // FLOOR      3 Towards -Infinity.
                // HALF_UP    4 Towards nearest neighbour. If equidistant, up.
                // HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
                // HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
                // HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
                // HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
                ROUNDING_MODE = 4,                       // 0 to 8

                // EXPONENTIAL_AT : [TO_EXP_NEG , TO_EXP_POS]

                // The exponent value at and beneath which toString returns exponential notation.
                // Number type: -7
                TO_EXP_NEG = -7,                         // 0 to -MAX

                // The exponent value at and above which toString returns exponential notation.
                // Number type: 21
                TO_EXP_POS = 21,                         // 0 to MAX

                // RANGE : [MIN_EXP, MAX_EXP]

                // The minimum exponent value, beneath which underflow to zero occurs.
                // Number type: -324  (5e-324)
                MIN_EXP = -1e7,                          // -1 to -MAX

                // The maximum exponent value, above which overflow to Infinity occurs.
                // Number type:  308  (1.7976931348623157e+308)
                // For MAX_EXP > 1e7, e.g. new BigNumber('1e100000000').plus(1) may be slow.
                MAX_EXP = 1e7,                           // 1 to MAX

                // Whether to use cryptographically-secure random number generation, if available.
                CRYPTO = false,                          // true or false

                // The modulo mode used when calculating the modulus: a mod n.
                // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
                // The remainder (r) is calculated as: r = a - n * q.
                //
                // UP        0 The remainder is positive if the dividend is negative, else is negative.
                // DOWN      1 The remainder has the same sign as the dividend.
                //             This modulo mode is commonly known as 'truncated division' and is
                //             equivalent to (a % n) in JavaScript.
                // FLOOR     3 The remainder has the same sign as the divisor (Python %).
                // HALF_EVEN 6 This modulo mode implements the IEEE 754 remainder function.
                // EUCLID    9 Euclidian division. q = sign(n) * floor(a / abs(n)).
                //             The remainder is always positive.
                //
                // The truncated division, floored division, Euclidian division and IEEE 754 remainder
                // modes are commonly used for the modulus operation.
                // Although the other rounding modes can also be used, they may not give useful results.
                MODULO_MODE = 1,                         // 0 to 9

                // The maximum number of significant digits of the result of the exponentiatedBy operation.
                // If POW_PRECISION is 0, there will be unlimited significant digits.
                POW_PRECISION = 0,                    // 0 to MAX

                // The format specification used by the BigNumber.prototype.toFormat method.
                FORMAT = {
                    decimalSeparator: '.',
                    groupSeparator: ',',
                    groupSize: 3,
                    secondaryGroupSize: 0,
                    fractionGroupSeparator: '\xA0',      // non-breaking space
                    fractionGroupSize: 0
                },

                // The alphabet used for base conversion.
                // It must be at least 2 characters long, with no '.' or repeated character.
                // '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_'
                ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';


            //------------------------------------------------------------------------------------------


            // CONSTRUCTOR


            /*
             * The BigNumber constructor and exported function.
             * Create and return a new instance of a BigNumber object.
             *
             * n {number|string|BigNumber} A numeric value.
             * [b] {number} The base of n. Integer, 2 to ALPHABET.length inclusive.
             */
            function BigNumber( n, b ) {
                var alphabet, c, e, i, isNum, len, str,
                    x = this;

                // Enable constructor usage without new.
                if ( !( x instanceof BigNumber ) ) {

                    // Don't throw on constructor call without new (#81).
                    // '[BigNumber Error] Constructor call without new: {n}'
                    //throw Error( bignumberError + ' Constructor call without new: ' + n );
                    return new BigNumber( n, b );
                }

                if ( b == null ) {

                    // Duplicate.
                    if ( n instanceof BigNumber ) {
                        x.s = n.s;
                        x.e = n.e;
                        x.c = ( n = n.c ) ? n.slice() : n;
                        return;
                    }

                    isNum = typeof n == 'number';

                    if ( isNum && n * 0 == 0 ) {

                        // Use `1 / n` to handle minus zero also.
                        x.s = 1 / n < 0 ? ( n = -n, -1 ) : 1;

                        // Faster path for integers.
                        if ( n === ~~n ) {
                            for ( e = 0, i = n; i >= 10; i /= 10, e++ );
                            x.e = e;
                            x.c = [n];
                            return;
                        }

                        str = n + '';
                    } else {
                        if ( !isNumeric.test( str = n + '' ) ) return parseNumeric( x, str, isNum );
                        x.s = str.charCodeAt(0) == 45 ? ( str = str.slice(1), -1 ) : 1;
                    }

                } else {

                    // '[BigNumber Error] Base {not a primitive number|not an integer|out of range}: {b}'
                    intCheck( b, 2, ALPHABET.length, 'Base' );
                    str = n + '';

                    // Allow exponential notation to be used with base 10 argument, while
                    // also rounding to DECIMAL_PLACES as with other bases.
                    if ( b == 10 ) {
                        x = new BigNumber( n instanceof BigNumber ? n : str );
                        return round( x, DECIMAL_PLACES + x.e + 1, ROUNDING_MODE );
                    }

                    isNum = typeof n == 'number';

                    if (isNum) {

                        // Avoid potential interpretation of Infinity and NaN as base 44+ values.
                        if ( n * 0 != 0 ) return parseNumeric( x, str, isNum, b );

                        x.s = 1 / n < 0 ? ( str = str.slice(1), -1 ) : 1;

                        // '[BigNumber Error] Number primitive has more than 15 significant digits: {n}'
                        if ( str.replace( /^0\.0*|\./, '' ).length > 15 ) {
                            throw Error
                            ( tooManyDigits + n );
                        }

                        // Prevent later check for length on converted number.
                        isNum = false;
                    } else {
                        x.s = str.charCodeAt(0) === 45 ? ( str = str.slice(1), -1 ) : 1;

                        // Allow e.g. hexadecimal 'FF' as well as 'ff'.
                        if ( b > 10 && b < 37 ) str = str.toLowerCase();
                    }

                    alphabet = ALPHABET.slice( 0, b );
                    e = i = 0;

                    // Check that str is a valid base b number.
                    // Don't use RegExp so alphabet can contain special characters.
                    for ( len = str.length; i < len; i++ ) {
                        if ( alphabet.indexOf( c = str.charAt(i) ) < 0 ) {
                            if ( c == '.' ) {

                                // If '.' is not the first character and it has not be found before.
                                if ( i > e ) {
                                    e = len;
                                    continue;
                                }
                            }

                            return parseNumeric( x, n + '', isNum, b );
                        }
                    }

                    str = convertBase( str, b, 10, x.s );
                }

                // Decimal point?
                if ( ( e = str.indexOf('.') ) > -1 ) str = str.replace( '.', '' );

                // Exponential form?
                if ( ( i = str.search( /e/i ) ) > 0 ) {

                    // Determine exponent.
                    if ( e < 0 ) e = i;
                    e += +str.slice( i + 1 );
                    str = str.substring( 0, i );
                } else if ( e < 0 ) {

                    // Integer.
                    e = str.length;
                }

                // Determine leading zeros.
                for ( i = 0; str.charCodeAt(i) === 48; i++ );

                // Determine trailing zeros.
                for ( len = str.length; str.charCodeAt(--len) === 48; );
                str = str.slice( i, len + 1 );

                if (str) {
                    len = str.length;

                    // '[BigNumber Error] Number primitive has more than 15 significant digits: {n}'
                    if ( isNum && len > 15 && ( n > MAX_SAFE_INTEGER || n !== mathfloor(n) ) ) {
                        throw Error
                        ( tooManyDigits + ( x.s * n ) );
                    }

                    e = e - i - 1;

                    // Overflow?
                    if ( e > MAX_EXP ) {

                        // Infinity.
                        x.c = x.e = null;

                        // Underflow?
                    } else if ( e < MIN_EXP ) {

                        // Zero.
                        x.c = [ x.e = 0 ];
                    } else {
                        x.e = e;
                        x.c = [];

                        // Transform base

                        // e is the base 10 exponent.
                        // i is where to slice str to get the first element of the coefficient array.
                        i = ( e + 1 ) % LOG_BASE;
                        if ( e < 0 ) i += LOG_BASE;

                        if ( i < len ) {
                            if (i) x.c.push( +str.slice( 0, i ) );

                            for ( len -= LOG_BASE; i < len; ) {
                                x.c.push( +str.slice( i, i += LOG_BASE ) );
                            }

                            str = str.slice(i);
                            i = LOG_BASE - str.length;
                        } else {
                            i -= len;
                        }

                        for ( ; i--; str += '0' );
                        x.c.push( +str );
                    }
                } else {

                    // Zero.
                    x.c = [ x.e = 0 ];
                }
            }


            // CONSTRUCTOR PROPERTIES


            BigNumber.clone = clone;

            BigNumber.ROUND_UP = 0;
            BigNumber.ROUND_DOWN = 1;
            BigNumber.ROUND_CEIL = 2;
            BigNumber.ROUND_FLOOR = 3;
            BigNumber.ROUND_HALF_UP = 4;
            BigNumber.ROUND_HALF_DOWN = 5;
            BigNumber.ROUND_HALF_EVEN = 6;
            BigNumber.ROUND_HALF_CEIL = 7;
            BigNumber.ROUND_HALF_FLOOR = 8;
            BigNumber.EUCLID = 9;


            /*
             * Configure infrequently-changing library-wide settings.
             *
             * Accept an object with the following optional properties (if the value of a property is
             * a number, it must be an integer within the inclusive range stated):
             *
             *   DECIMAL_PLACES   {number}           0 to MAX
             *   ROUNDING_MODE    {number}           0 to 8
             *   EXPONENTIAL_AT   {number|number[]}  -MAX to MAX  or  [-MAX to 0, 0 to MAX]
             *   RANGE            {number|number[]}  -MAX to MAX (not zero)  or  [-MAX to -1, 1 to MAX]
             *   CRYPTO           {boolean}          true or false
             *   MODULO_MODE      {number}           0 to 9
             *   POW_PRECISION       {number}           0 to MAX
             *   ALPHABET         {string}           A string of two or more unique characters, and not
             *                                       containing '.'. The empty string, null or undefined
             *                                       resets the alphabet to its default value.
             *   FORMAT           {object}           An object with some of the following properties:
             *      decimalSeparator       {string}
             *      groupSeparator         {string}
             *      groupSize              {number}
             *      secondaryGroupSize     {number}
             *      fractionGroupSeparator {string}
             *      fractionGroupSize      {number}
             *
             * (The values assigned to the above FORMAT object properties are not checked for validity.)
             *
             * E.g.
             * BigNumber.config({ DECIMAL_PLACES : 20, ROUNDING_MODE : 4 })
             *
             * Ignore properties/parameters set to null or undefined, except for ALPHABET.
             *
             * Return an object with the properties current values.
             */
            BigNumber.config = BigNumber.set = function (obj) {
                var p, v;

                if ( obj != null ) {

                    if ( typeof obj == 'object' ) {

                        // DECIMAL_PLACES {number} Integer, 0 to MAX inclusive.
                        // '[BigNumber Error] DECIMAL_PLACES {not a primitive number|not an integer|out of range}: {v}'
                        if ( obj.hasOwnProperty( p = 'DECIMAL_PLACES' ) ) {
                            v = obj[p];
                            intCheck( v, 0, MAX, p );
                            DECIMAL_PLACES = v;
                        }

                        // ROUNDING_MODE {number} Integer, 0 to 8 inclusive.
                        // '[BigNumber Error] ROUNDING_MODE {not a primitive number|not an integer|out of range}: {v}'
                        if ( obj.hasOwnProperty( p = 'ROUNDING_MODE' ) ) {
                            v = obj[p];
                            intCheck( v, 0, 8, p );
                            ROUNDING_MODE = v;
                        }

                        // EXPONENTIAL_AT {number|number[]}
                        // Integer, -MAX to MAX inclusive or
                        // [integer -MAX to 0 inclusive, 0 to MAX inclusive].
                        // '[BigNumber Error] EXPONENTIAL_AT {not a primitive number|not an integer|out of range}: {v}'
                        if ( obj.hasOwnProperty( p = 'EXPONENTIAL_AT' ) ) {
                            v = obj[p];
                            if ( isArray(v) ) {
                                intCheck( v[0], -MAX, 0, p );
                                intCheck( v[1], 0, MAX, p );
                                TO_EXP_NEG = v[0];
                                TO_EXP_POS = v[1];
                            } else {
                                intCheck( v, -MAX, MAX, p );
                                TO_EXP_NEG = -( TO_EXP_POS = v < 0 ? -v : v );
                            }
                        }

                        // RANGE {number|number[]} Non-zero integer, -MAX to MAX inclusive or
                        // [integer -MAX to -1 inclusive, integer 1 to MAX inclusive].
                        // '[BigNumber Error] RANGE {not a primitive number|not an integer|out of range|cannot be zero}: {v}'
                        if ( obj.hasOwnProperty( p = 'RANGE' ) ) {
                            v = obj[p];
                            if ( isArray(v) ) {
                                intCheck( v[0], -MAX, -1, p );
                                intCheck( v[1], 1, MAX, p );
                                MIN_EXP = v[0];
                                MAX_EXP = v[1];
                            } else {
                                intCheck( v, -MAX, MAX, p );
                                if (v) {
                                    MIN_EXP = -( MAX_EXP = v < 0 ? -v : v );
                                } else {
                                    throw Error
                                    ( bignumberError + p + ' cannot be zero: ' + v );
                                }
                            }
                        }

                        // CRYPTO {boolean} true or false.
                        // '[BigNumber Error] CRYPTO not true or false: {v}'
                        // '[BigNumber Error] crypto unavailable'
                        if ( obj.hasOwnProperty( p = 'CRYPTO' ) ) {
                            v = obj[p];
                            if ( v === !!v ) {
                                if (v) {
                                    if ( typeof crypto != 'undefined' && crypto &&
                                        (crypto.getRandomValues || crypto.randomBytes) ) {
                                        CRYPTO = v;
                                    } else {
                                        CRYPTO = !v;
                                        throw Error
                                        ( bignumberError + 'crypto unavailable' );
                                    }
                                } else {
                                    CRYPTO = v;
                                }
                            } else {
                                throw Error
                                ( bignumberError + p + ' not true or false: ' + v );
                            }
                        }

                        // MODULO_MODE {number} Integer, 0 to 9 inclusive.
                        // '[BigNumber Error] MODULO_MODE {not a primitive number|not an integer|out of range}: {v}'
                        if ( obj.hasOwnProperty( p = 'MODULO_MODE' ) ) {
                            v = obj[p];
                            intCheck( v, 0, 9, p );
                            MODULO_MODE = v;
                        }

                        // POW_PRECISION {number} Integer, 0 to MAX inclusive.
                        // '[BigNumber Error] POW_PRECISION {not a primitive number|not an integer|out of range}: {v}'
                        if ( obj.hasOwnProperty( p = 'POW_PRECISION' ) ) {
                            v = obj[p];
                            intCheck( v, 0, MAX, p );
                            POW_PRECISION = v;
                        }

                        // FORMAT {object}
                        // '[BigNumber Error] FORMAT not an object: {v}'
                        if ( obj.hasOwnProperty( p = 'FORMAT' ) ) {
                            v = obj[p];
                            if ( typeof v == 'object' ) FORMAT = v;
                            else throw Error
                            ( bignumberError + p + ' not an object: ' + v );
                        }

                        // ALPHABET {string}
                        // '[BigNumber Error] ALPHABET invalid: {v}'
                        if ( obj.hasOwnProperty( p = 'ALPHABET' ) ) {
                            v = obj[p];

                            // Disallow if only one character, or contains '.' or a repeated character.
                            if ( typeof v == 'string' && !/^.$|\.|(.).*\1/.test(v) ) {
                                ALPHABET = v;
                            } else {
                                throw Error
                                ( bignumberError + p + ' invalid: ' + v );
                            }
                        }

                    } else {

                        // '[BigNumber Error] Object expected: {v}'
                        throw Error
                        ( bignumberError + 'Object expected: ' + obj );
                    }
                }

                return {
                    DECIMAL_PLACES: DECIMAL_PLACES,
                    ROUNDING_MODE: ROUNDING_MODE,
                    EXPONENTIAL_AT: [ TO_EXP_NEG, TO_EXP_POS ],
                    RANGE: [ MIN_EXP, MAX_EXP ],
                    CRYPTO: CRYPTO,
                    MODULO_MODE: MODULO_MODE,
                    POW_PRECISION: POW_PRECISION,
                    FORMAT: FORMAT,
                    ALPHABET: ALPHABET
                };
            };


            /*
             * Return true if v is a BigNumber instance, otherwise return false.
             *
             * v {any}
             */
            BigNumber.isBigNumber = function (v) {
                return v instanceof BigNumber || v && v._isBigNumber === true || false;
            };


            /*
             * Return a new BigNumber whose value is the maximum of the arguments.
             *
             * arguments {number|string|BigNumber}
             */
            BigNumber.maximum = BigNumber.max = function () {
                return maxOrMin( arguments, P.lt );
            };


            /*
             * Return a new BigNumber whose value is the minimum of the arguments.
             *
             * arguments {number|string|BigNumber}
             */
            BigNumber.minimum = BigNumber.min = function () {
                return maxOrMin( arguments, P.gt );
            };


            /*
             * Return a new BigNumber with a random value equal to or greater than 0 and less than 1,
             * and with dp, or DECIMAL_PLACES if dp is omitted, decimal places (or less if trailing
             * zeros are produced).
             *
             * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp}'
             * '[BigNumber Error] crypto unavailable'
             */
            BigNumber.random = (function () {
                var pow2_53 = 0x20000000000000;

                // Return a 53 bit integer n, where 0 <= n < 9007199254740992.
                // Check if Math.random() produces more than 32 bits of randomness.
                // If it does, assume at least 53 bits are produced, otherwise assume at least 30 bits.
                // 0x40000000 is 2^30, 0x800000 is 2^23, 0x1fffff is 2^21 - 1.
                var random53bitInt = (Math.random() * pow2_53) & 0x1fffff
                    ? function () { return mathfloor( Math.random() * pow2_53 ); }
                    : function () { return ((Math.random() * 0x40000000 | 0) * 0x800000) +
                        (Math.random() * 0x800000 | 0); };

                return function (dp) {
                    var a, b, e, k, v,
                        i = 0,
                        c = [],
                        rand = new BigNumber(ONE);

                    if ( dp == null ) dp = DECIMAL_PLACES;
                    else intCheck( dp, 0, MAX );

                    k = mathceil( dp / LOG_BASE );

                    if (CRYPTO) {

                        // Browsers supporting crypto.getRandomValues.
                        if (crypto.getRandomValues) {

                            a = crypto.getRandomValues( new Uint32Array( k *= 2 ) );

                            for ( ; i < k; ) {

                                // 53 bits:
                                // ((Math.pow(2, 32) - 1) * Math.pow(2, 21)).toString(2)
                                // 11111 11111111 11111111 11111111 11100000 00000000 00000000
                                // ((Math.pow(2, 32) - 1) >>> 11).toString(2)
                                //                                     11111 11111111 11111111
                                // 0x20000 is 2^21.
                                v = a[i] * 0x20000 + (a[i + 1] >>> 11);

                                // Rejection sampling:
                                // 0 <= v < 9007199254740992
                                // Probability that v >= 9e15, is
                                // 7199254740992 / 9007199254740992 ~= 0.0008, i.e. 1 in 1251
                                if ( v >= 9e15 ) {
                                    b = crypto.getRandomValues( new Uint32Array(2) );
                                    a[i] = b[0];
                                    a[i + 1] = b[1];
                                } else {

                                    // 0 <= v <= 8999999999999999
                                    // 0 <= (v % 1e14) <= 99999999999999
                                    c.push( v % 1e14 );
                                    i += 2;
                                }
                            }
                            i = k / 2;

                            // Node.js supporting crypto.randomBytes.
                        } else if (crypto.randomBytes) {

                            // buffer
                            a = crypto.randomBytes( k *= 7 );

                            for ( ; i < k; ) {

                                // 0x1000000000000 is 2^48, 0x10000000000 is 2^40
                                // 0x100000000 is 2^32, 0x1000000 is 2^24
                                // 11111 11111111 11111111 11111111 11111111 11111111 11111111
                                // 0 <= v < 9007199254740992
                                v = ( ( a[i] & 31 ) * 0x1000000000000 ) + ( a[i + 1] * 0x10000000000 ) +
                                    ( a[i + 2] * 0x100000000 ) + ( a[i + 3] * 0x1000000 ) +
                                    ( a[i + 4] << 16 ) + ( a[i + 5] << 8 ) + a[i + 6];

                                if ( v >= 9e15 ) {
                                    crypto.randomBytes(7).copy( a, i );
                                } else {

                                    // 0 <= (v % 1e14) <= 99999999999999
                                    c.push( v % 1e14 );
                                    i += 7;
                                }
                            }
                            i = k / 7;
                        } else {
                            CRYPTO = false;
                            throw Error
                            ( bignumberError + 'crypto unavailable' );
                        }
                    }

                    // Use Math.random.
                    if (!CRYPTO) {

                        for ( ; i < k; ) {
                            v = random53bitInt();
                            if ( v < 9e15 ) c[i++] = v % 1e14;
                        }
                    }

                    k = c[--i];
                    dp %= LOG_BASE;

                    // Convert trailing digits to zeros according to dp.
                    if ( k && dp ) {
                        v = POWS_TEN[LOG_BASE - dp];
                        c[i] = mathfloor( k / v ) * v;
                    }

                    // Remove trailing elements which are zero.
                    for ( ; c[i] === 0; c.pop(), i-- );

                    // Zero?
                    if ( i < 0 ) {
                        c = [ e = 0 ];
                    } else {

                        // Remove leading elements which are zero and adjust exponent accordingly.
                        for ( e = -1 ; c[0] === 0; c.splice(0, 1), e -= LOG_BASE);

                        // Count the digits of the first element of c to determine leading zeros, and...
                        for ( i = 1, v = c[0]; v >= 10; v /= 10, i++);

                        // adjust the exponent accordingly.
                        if ( i < LOG_BASE ) e -= LOG_BASE - i;
                    }

                    rand.e = e;
                    rand.c = c;
                    return rand;
                };
            })();


            // PRIVATE FUNCTIONS


            // Called by BigNumber and BigNumber.prototype.toString.
            convertBase = ( function () {
                var decimal = '0123456789';

                /*
                 * Convert string of baseIn to an array of numbers of baseOut.
                 * Eg. toBaseOut('255', 10, 16) returns [15, 15].
                 * Eg. toBaseOut('ff', 16, 10) returns [2, 5, 5].
                 */
                function toBaseOut( str, baseIn, baseOut, alphabet ) {
                    var j,
                        arr = [0],
                        arrL,
                        i = 0,
                        len = str.length;

                    for ( ; i < len; ) {
                        for ( arrL = arr.length; arrL--; arr[arrL] *= baseIn );

                        arr[0] += alphabet.indexOf( str.charAt( i++ ) );

                        for ( j = 0; j < arr.length; j++ ) {

                            if ( arr[j] > baseOut - 1 ) {
                                if ( arr[j + 1] == null ) arr[j + 1] = 0;
                                arr[j + 1] += arr[j] / baseOut | 0;
                                arr[j] %= baseOut;
                            }
                        }
                    }

                    return arr.reverse();
                }

                // Convert a numeric string of baseIn to a numeric string of baseOut.
                // If the caller is toString, we are converting from base 10 to baseOut.
                // If the caller is BigNumber, we are converting from baseIn to base 10.
                return function ( str, baseIn, baseOut, sign, callerIsToString ) {
                    var alphabet, d, e, k, r, x, xc, y,
                        i = str.indexOf( '.' ),
                        dp = DECIMAL_PLACES,
                        rm = ROUNDING_MODE;

                    // Non-integer.
                    if ( i >= 0 ) {
                        k = POW_PRECISION;

                        // Unlimited precision.
                        POW_PRECISION = 0;
                        str = str.replace( '.', '' );
                        y = new BigNumber(baseIn);
                        x = y.pow( str.length - i );
                        POW_PRECISION = k;

                        // Convert str as if an integer, then restore the fraction part by dividing the
                        // result by its base raised to a power.

                        y.c = toBaseOut( toFixedPoint( coeffToString( x.c ), x.e, '0' ),
                            10, baseOut, decimal );
                        y.e = y.c.length;
                    }

                    // Convert the number as integer.

                    xc = toBaseOut( str, baseIn, baseOut, callerIsToString
                        ? ( alphabet = ALPHABET, decimal )
                        : ( alphabet = decimal, ALPHABET ) );


                    // xc now represents str as an integer and converted to baseOut. e is the exponent.
                    e = k = xc.length;

                    // Remove trailing zeros.
                    for ( ; xc[--k] == 0; xc.pop() );

                    // Zero?
                    if ( !xc[0] ) return alphabet.charAt(0);

                    // Does str represent an integer? If so, no need for the division.
                    if ( i < 0 ) {
                        --e;
                    } else {
                        x.c = xc;
                        x.e = e;

                        // The sign is needed for correct rounding.
                        x.s = sign;
                        x = div( x, y, dp, rm, baseOut );
                        xc = x.c;
                        r = x.r;
                        e = x.e;
                    }

                    // xc now represents str converted to baseOut.

                    // THe index of the rounding digit.
                    d = e + dp + 1;

                    // The rounding digit: the digit to the right of the digit that may be rounded up.
                    i = xc[d];

                    // Look at the rounding digits and mode to determine whether to round up.

                    k = baseOut / 2;
                    r = r || d < 0 || xc[d + 1] != null;

                    r = rm < 4 ? ( i != null || r ) && ( rm == 0 || rm == ( x.s < 0 ? 3 : 2 ) )
                        : i > k || i == k &&( rm == 4 || r || rm == 6 && xc[d - 1] & 1 ||
                        rm == ( x.s < 0 ? 8 : 7 ) );

                    // If the index of the rounding digit is not greater than zero, or xc represents
                    // zero, then the result of the base conversion is zero or, if rounding up, a value
                    // such as 0.00001.
                    if ( d < 1 || !xc[0] ) {

                        // 1^-dp or 0
                        str = r ? toFixedPoint( alphabet.charAt(1), -dp, alphabet.charAt(0) )
                            : alphabet.charAt(0);
                    } else {

                        // Truncate xc to the required number of decimal places.
                        xc.length = d;

                        // Round up?
                        if (r) {

                            // Rounding up may mean the previous digit has to be rounded up and so on.
                            for ( --baseOut; ++xc[--d] > baseOut; ) {
                                xc[d] = 0;

                                if ( !d ) {
                                    ++e;
                                    xc = [1].concat(xc);
                                }
                            }
                        }

                        // Determine trailing zeros.
                        for ( k = xc.length; !xc[--k]; );

                        // E.g. [4, 11, 15] becomes 4bf.
                        for ( i = 0, str = ''; i <= k; str += alphabet.charAt( xc[i++] ) );

                        // Add leading zeros, decimal point and trailing zeros as required.
                        str = toFixedPoint( str, e, alphabet.charAt(0) );
                    }

                    // The caller will add the sign.
                    return str;
                };
            })();


            // Perform division in the specified base. Called by div and convertBase.
            div = (function () {

                // Assume non-zero x and k.
                function multiply( x, k, base ) {
                    var m, temp, xlo, xhi,
                        carry = 0,
                        i = x.length,
                        klo = k % SQRT_BASE,
                        khi = k / SQRT_BASE | 0;

                    for ( x = x.slice(); i--; ) {
                        xlo = x[i] % SQRT_BASE;
                        xhi = x[i] / SQRT_BASE | 0;
                        m = khi * xlo + xhi * klo;
                        temp = klo * xlo + ( ( m % SQRT_BASE ) * SQRT_BASE ) + carry;
                        carry = ( temp / base | 0 ) + ( m / SQRT_BASE | 0 ) + khi * xhi;
                        x[i] = temp % base;
                    }

                    if (carry) x = [carry].concat(x);

                    return x;
                }

                function compare( a, b, aL, bL ) {
                    var i, cmp;

                    if ( aL != bL ) {
                        cmp = aL > bL ? 1 : -1;
                    } else {

                        for ( i = cmp = 0; i < aL; i++ ) {

                            if ( a[i] != b[i] ) {
                                cmp = a[i] > b[i] ? 1 : -1;
                                break;
                            }
                        }
                    }
                    return cmp;
                }

                function subtract( a, b, aL, base ) {
                    var i = 0;

                    // Subtract b from a.
                    for ( ; aL--; ) {
                        a[aL] -= i;
                        i = a[aL] < b[aL] ? 1 : 0;
                        a[aL] = i * base + a[aL] - b[aL];
                    }

                    // Remove leading zeros.
                    for ( ; !a[0] && a.length > 1; a.splice(0, 1) );
                }

                // x: dividend, y: divisor.
                return function ( x, y, dp, rm, base ) {
                    var cmp, e, i, more, n, prod, prodL, q, qc, rem, remL, rem0, xi, xL, yc0,
                        yL, yz,
                        s = x.s == y.s ? 1 : -1,
                        xc = x.c,
                        yc = y.c;

                    // Either NaN, Infinity or 0?
                    if ( !xc || !xc[0] || !yc || !yc[0] ) {

                        return new BigNumber(

                            // Return NaN if either NaN, or both Infinity or 0.
                            !x.s || !y.s || ( xc ? yc && xc[0] == yc[0] : !yc ) ? NaN :

                                // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
                                xc && xc[0] == 0 || !yc ? s * 0 : s / 0
                        );
                    }

                    q = new BigNumber(s);
                    qc = q.c = [];
                    e = x.e - y.e;
                    s = dp + e + 1;

                    if ( !base ) {
                        base = BASE;
                        e = bitFloor( x.e / LOG_BASE ) - bitFloor( y.e / LOG_BASE );
                        s = s / LOG_BASE | 0;
                    }

                    // Result exponent may be one less then the current value of e.
                    // The coefficients of the BigNumbers from convertBase may have trailing zeros.
                    for ( i = 0; yc[i] == ( xc[i] || 0 ); i++ );

                    if ( yc[i] > ( xc[i] || 0 ) ) e--;

                    if ( s < 0 ) {
                        qc.push(1);
                        more = true;
                    } else {
                        xL = xc.length;
                        yL = yc.length;
                        i = 0;
                        s += 2;

                        // Normalise xc and yc so highest order digit of yc is >= base / 2.

                        n = mathfloor( base / ( yc[0] + 1 ) );

                        // Not necessary, but to handle odd bases where yc[0] == ( base / 2 ) - 1.
                        // if ( n > 1 || n++ == 1 && yc[0] < base / 2 ) {
                        if ( n > 1 ) {
                            yc = multiply( yc, n, base );
                            xc = multiply( xc, n, base );
                            yL = yc.length;
                            xL = xc.length;
                        }

                        xi = yL;
                        rem = xc.slice( 0, yL );
                        remL = rem.length;

                        // Add zeros to make remainder as long as divisor.
                        for ( ; remL < yL; rem[remL++] = 0 );
                        yz = yc.slice();
                        yz = [0].concat(yz);
                        yc0 = yc[0];
                        if ( yc[1] >= base / 2 ) yc0++;
                        // Not necessary, but to prevent trial digit n > base, when using base 3.
                        // else if ( base == 3 && yc0 == 1 ) yc0 = 1 + 1e-15;

                        do {
                            n = 0;

                            // Compare divisor and remainder.
                            cmp = compare( yc, rem, yL, remL );

                            // If divisor < remainder.
                            if ( cmp < 0 ) {

                                // Calculate trial digit, n.

                                rem0 = rem[0];
                                if ( yL != remL ) rem0 = rem0 * base + ( rem[1] || 0 );

                                // n is how many times the divisor goes into the current remainder.
                                n = mathfloor( rem0 / yc0 );

                                //  Algorithm:
                                //  1. product = divisor * trial digit (n)
                                //  2. if product > remainder: product -= divisor, n--
                                //  3. remainder -= product
                                //  4. if product was < remainder at 2:
                                //    5. compare new remainder and divisor
                                //    6. If remainder > divisor: remainder -= divisor, n++

                                if ( n > 1 ) {

                                    // n may be > base only when base is 3.
                                    if (n >= base) n = base - 1;

                                    // product = divisor * trial digit.
                                    prod = multiply( yc, n, base );
                                    prodL = prod.length;
                                    remL = rem.length;

                                    // Compare product and remainder.
                                    // If product > remainder.
                                    // Trial digit n too high.
                                    // n is 1 too high about 5% of the time, and is not known to have
                                    // ever been more than 1 too high.
                                    while ( compare( prod, rem, prodL, remL ) == 1 ) {
                                        n--;

                                        // Subtract divisor from product.
                                        subtract( prod, yL < prodL ? yz : yc, prodL, base );
                                        prodL = prod.length;
                                        cmp = 1;
                                    }
                                } else {

                                    // n is 0 or 1, cmp is -1.
                                    // If n is 0, there is no need to compare yc and rem again below,
                                    // so change cmp to 1 to avoid it.
                                    // If n is 1, leave cmp as -1, so yc and rem are compared again.
                                    if ( n == 0 ) {

                                        // divisor < remainder, so n must be at least 1.
                                        cmp = n = 1;
                                    }

                                    // product = divisor
                                    prod = yc.slice();
                                    prodL = prod.length;
                                }

                                if ( prodL < remL ) prod = [0].concat(prod);

                                // Subtract product from remainder.
                                subtract( rem, prod, remL, base );
                                remL = rem.length;

                                // If product was < remainder.
                                if ( cmp == -1 ) {

                                    // Compare divisor and new remainder.
                                    // If divisor < new remainder, subtract divisor from remainder.
                                    // Trial digit n too low.
                                    // n is 1 too low about 5% of the time, and very rarely 2 too low.
                                    while ( compare( yc, rem, yL, remL ) < 1 ) {
                                        n++;

                                        // Subtract divisor from remainder.
                                        subtract( rem, yL < remL ? yz : yc, remL, base );
                                        remL = rem.length;
                                    }
                                }
                            } else if ( cmp === 0 ) {
                                n++;
                                rem = [0];
                            } // else cmp === 1 and n will be 0

                            // Add the next digit, n, to the result array.
                            qc[i++] = n;

                            // Update the remainder.
                            if ( rem[0] ) {
                                rem[remL++] = xc[xi] || 0;
                            } else {
                                rem = [ xc[xi] ];
                                remL = 1;
                            }
                        } while ( ( xi++ < xL || rem[0] != null ) && s-- );

                        more = rem[0] != null;

                        // Leading zero?
                        if ( !qc[0] ) qc.splice(0, 1);
                    }

                    if ( base == BASE ) {

                        // To calculate q.e, first get the number of digits of qc[0].
                        for ( i = 1, s = qc[0]; s >= 10; s /= 10, i++ );

                        round( q, dp + ( q.e = i + e * LOG_BASE - 1 ) + 1, rm, more );

                        // Caller is convertBase.
                    } else {
                        q.e = e;
                        q.r = +more;
                    }

                    return q;
                };
            })();


            /*
             * Return a string representing the value of BigNumber n in fixed-point or exponential
             * notation rounded to the specified decimal places or significant digits.
             *
             * n: a BigNumber.
             * i: the index of the last digit required (i.e. the digit that may be rounded up).
             * rm: the rounding mode.
             * id: 1 (toExponential) or 2 (toPrecision).
             */
            function format( n, i, rm, id ) {
                var c0, e, ne, len, str;

                if ( rm == null ) rm = ROUNDING_MODE;
                else intCheck( rm, 0, 8 );

                if ( !n.c ) return n.toString();

                c0 = n.c[0];
                ne = n.e;

                if ( i == null ) {
                    str = coeffToString( n.c );
                    str = id == 1 || id == 2 && ne <= TO_EXP_NEG
                        ? toExponential( str, ne )
                        : toFixedPoint( str, ne, '0' );
                } else {
                    n = round( new BigNumber(n), i, rm );

                    // n.e may have changed if the value was rounded up.
                    e = n.e;

                    str = coeffToString( n.c );
                    len = str.length;

                    // toPrecision returns exponential notation if the number of significant digits
                    // specified is less than the number of digits necessary to represent the integer
                    // part of the value in fixed-point notation.

                    // Exponential notation.
                    if ( id == 1 || id == 2 && ( i <= e || e <= TO_EXP_NEG ) ) {

                        // Append zeros?
                        for ( ; len < i; str += '0', len++ );
                        str = toExponential( str, e );

                        // Fixed-point notation.
                    } else {
                        i -= ne;
                        str = toFixedPoint( str, e, '0' );

                        // Append zeros?
                        if ( e + 1 > len ) {
                            if ( --i > 0 ) for ( str += '.'; i--; str += '0' );
                        } else {
                            i += e - len;
                            if ( i > 0 ) {
                                if ( e + 1 == len ) str += '.';
                                for ( ; i--; str += '0' );
                            }
                        }
                    }
                }

                return n.s < 0 && c0 ? '-' + str : str;
            }


            // Handle BigNumber.max and BigNumber.min.
            function maxOrMin( args, method ) {
                var m, n,
                    i = 0;

                if ( isArray( args[0] ) ) args = args[0];
                m = new BigNumber( args[0] );

                for ( ; ++i < args.length; ) {
                    n = new BigNumber( args[i] );

                    // If any number is NaN, return NaN.
                    if ( !n.s ) {
                        m = n;
                        break;
                    } else if ( method.call( m, n ) ) {
                        m = n;
                    }
                }

                return m;
            }


            /*
             * Strip trailing zeros, calculate base 10 exponent and check against MIN_EXP and MAX_EXP.
             * Called by minus, plus and times.
             */
            function normalise( n, c, e ) {
                var i = 1,
                    j = c.length;

                // Remove trailing zeros.
                for ( ; !c[--j]; c.pop() );

                // Calculate the base 10 exponent. First get the number of digits of c[0].
                for ( j = c[0]; j >= 10; j /= 10, i++ );

                // Overflow?
                if ( ( e = i + e * LOG_BASE - 1 ) > MAX_EXP ) {

                    // Infinity.
                    n.c = n.e = null;

                    // Underflow?
                } else if ( e < MIN_EXP ) {

                    // Zero.
                    n.c = [ n.e = 0 ];
                } else {
                    n.e = e;
                    n.c = c;
                }

                return n;
            }


            // Handle values that fail the validity test in BigNumber.
            parseNumeric = (function () {
                var basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i,
                    dotAfter = /^([^.]+)\.$/,
                    dotBefore = /^\.([^.]+)$/,
                    isInfinityOrNaN = /^-?(Infinity|NaN)$/,
                    whitespaceOrPlus = /^\s*\+(?=[\w.])|^\s+|\s+$/g;

                return function ( x, str, isNum, b ) {
                    var base,
                        s = isNum ? str : str.replace( whitespaceOrPlus, '' );

                    // No exception on ±Infinity or NaN.
                    if ( isInfinityOrNaN.test(s) ) {
                        x.s = isNaN(s) ? null : s < 0 ? -1 : 1;
                        x.c = x.e = null;
                    } else {
                        if ( !isNum ) {

                            // basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i
                            s = s.replace( basePrefix, function ( m, p1, p2 ) {
                                base = ( p2 = p2.toLowerCase() ) == 'x' ? 16 : p2 == 'b' ? 2 : 8;
                                return !b || b == base ? p1 : m;
                            });

                            if (b) {
                                base = b;

                                // E.g. '1.' to '1', '.1' to '0.1'
                                s = s.replace( dotAfter, '$1' ).replace( dotBefore, '0.$1' );
                            }

                            if ( str != s ) return new BigNumber( s, base );
                        }

                        // '[BigNumber Error] Not a number: {n}'
                        // '[BigNumber Error] Not a base {b} number: {n}'
                        throw Error
                        ( bignumberError + 'Not a' + ( b ? ' base ' + b : '' ) + ' number: ' + str );
                    }
                }
            })();


            /*
             * Round x to sd significant digits using rounding mode rm. Check for over/under-flow.
             * If r is truthy, it is known that there are more digits after the rounding digit.
             */
            function round( x, sd, rm, r ) {
                var d, i, j, k, n, ni, rd,
                    xc = x.c,
                    pows10 = POWS_TEN;

                // if x is not Infinity or NaN...
                if (xc) {

                    // rd is the rounding digit, i.e. the digit after the digit that may be rounded up.
                    // n is a base 1e14 number, the value of the element of array x.c containing rd.
                    // ni is the index of n within x.c.
                    // d is the number of digits of n.
                    // i is the index of rd within n including leading zeros.
                    // j is the actual index of rd within n (if < 0, rd is a leading zero).
                    out: {

                        // Get the number of digits of the first element of xc.
                        for ( d = 1, k = xc[0]; k >= 10; k /= 10, d++ );
                        i = sd - d;

                        // If the rounding digit is in the first element of xc...
                        if ( i < 0 ) {
                            i += LOG_BASE;
                            j = sd;
                            n = xc[ ni = 0 ];

                            // Get the rounding digit at index j of n.
                            rd = n / pows10[ d - j - 1 ] % 10 | 0;
                        } else {
                            ni = mathceil( ( i + 1 ) / LOG_BASE );

                            if ( ni >= xc.length ) {

                                if (r) {

                                    // Needed by sqrt.
                                    for ( ; xc.length <= ni; xc.push(0) );
                                    n = rd = 0;
                                    d = 1;
                                    i %= LOG_BASE;
                                    j = i - LOG_BASE + 1;
                                } else {
                                    break out;
                                }
                            } else {
                                n = k = xc[ni];

                                // Get the number of digits of n.
                                for ( d = 1; k >= 10; k /= 10, d++ );

                                // Get the index of rd within n.
                                i %= LOG_BASE;

                                // Get the index of rd within n, adjusted for leading zeros.
                                // The number of leading zeros of n is given by LOG_BASE - d.
                                j = i - LOG_BASE + d;

                                // Get the rounding digit at index j of n.
                                rd = j < 0 ? 0 : n / pows10[ d - j - 1 ] % 10 | 0;
                            }
                        }

                        r = r || sd < 0 ||

                            // Are there any non-zero digits after the rounding digit?
                            // The expression  n % pows10[ d - j - 1 ]  returns all digits of n to the right
                            // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
                            xc[ni + 1] != null || ( j < 0 ? n : n % pows10[ d - j - 1 ] );

                        r = rm < 4
                            ? ( rd || r ) && ( rm == 0 || rm == ( x.s < 0 ? 3 : 2 ) )
                            : rd > 5 || rd == 5 && ( rm == 4 || r || rm == 6 &&

                            // Check whether the digit to the left of the rounding digit is odd.
                            ( ( i > 0 ? j > 0 ? n / pows10[ d - j ] : 0 : xc[ni - 1] ) % 10 ) & 1 ||
                            rm == ( x.s < 0 ? 8 : 7 ) );

                        if ( sd < 1 || !xc[0] ) {
                            xc.length = 0;

                            if (r) {

                                // Convert sd to decimal places.
                                sd -= x.e + 1;

                                // 1, 0.1, 0.01, 0.001, 0.0001 etc.
                                xc[0] = pows10[ ( LOG_BASE - sd % LOG_BASE ) % LOG_BASE ];
                                x.e = -sd || 0;
                            } else {

                                // Zero.
                                xc[0] = x.e = 0;
                            }

                            return x;
                        }

                        // Remove excess digits.
                        if ( i == 0 ) {
                            xc.length = ni;
                            k = 1;
                            ni--;
                        } else {
                            xc.length = ni + 1;
                            k = pows10[ LOG_BASE - i ];

                            // E.g. 56700 becomes 56000 if 7 is the rounding digit.
                            // j > 0 means i > number of leading zeros of n.
                            xc[ni] = j > 0 ? mathfloor( n / pows10[ d - j ] % pows10[j] ) * k : 0;
                        }

                        // Round up?
                        if (r) {

                            for ( ; ; ) {

                                // If the digit to be rounded up is in the first element of xc...
                                if ( ni == 0 ) {

                                    // i will be the length of xc[0] before k is added.
                                    for ( i = 1, j = xc[0]; j >= 10; j /= 10, i++ );
                                    j = xc[0] += k;
                                    for ( k = 1; j >= 10; j /= 10, k++ );

                                    // if i != k the length has increased.
                                    if ( i != k ) {
                                        x.e++;
                                        if ( xc[0] == BASE ) xc[0] = 1;
                                    }

                                    break;
                                } else {
                                    xc[ni] += k;
                                    if ( xc[ni] != BASE ) break;
                                    xc[ni--] = 0;
                                    k = 1;
                                }
                            }
                        }

                        // Remove trailing zeros.
                        for ( i = xc.length; xc[--i] === 0; xc.pop() );
                    }

                    // Overflow? Infinity.
                    if ( x.e > MAX_EXP ) {
                        x.c = x.e = null;

                        // Underflow? Zero.
                    } else if ( x.e < MIN_EXP ) {
                        x.c = [ x.e = 0 ];
                    }
                }

                return x;
            }


            // PROTOTYPE/INSTANCE METHODS


            /*
             * Return a new BigNumber whose value is the absolute value of this BigNumber.
             */
            P.absoluteValue = P.abs = function () {
                var x = new BigNumber(this);
                if ( x.s < 0 ) x.s = 1;
                return x;
            };


            /*
             * Return
             *   1 if the value of this BigNumber is greater than the value of BigNumber(y, b),
             *   -1 if the value of this BigNumber is less than the value of BigNumber(y, b),
             *   0 if they have the same value,
             *   or null if the value of either is NaN.
             */
            P.comparedTo = function ( y, b ) {
                return compare( this, new BigNumber( y, b ) );
            };


            /*
             * If dp is undefined or null or true or false, return the number of decimal places of the
             * value of this BigNumber, or null if the value of this BigNumber is ±Infinity or NaN.
             *
             * Otherwise, if dp is a number, return a new BigNumber whose value is the value of this
             * BigNumber rounded to a maximum of dp decimal places using rounding mode rm, or
             * ROUNDING_MODE if rm is omitted.
             *
             * [dp] {number} Decimal places: integer, 0 to MAX inclusive.
             * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
             */
            P.decimalPlaces = P.dp = function ( dp, rm ) {
                var c, n, v,
                    x = this;

                if ( dp != null ) {
                    intCheck( dp, 0, MAX );
                    if ( rm == null ) rm = ROUNDING_MODE;
                    else intCheck( rm, 0, 8 );

                    return round( new BigNumber(x), dp + x.e + 1, rm );
                }

                if ( !( c = x.c ) ) return null;
                n = ( ( v = c.length - 1 ) - bitFloor( this.e / LOG_BASE ) ) * LOG_BASE;

                // Subtract the number of trailing zeros of the last number.
                if ( v = c[v] ) for ( ; v % 10 == 0; v /= 10, n-- );
                if ( n < 0 ) n = 0;

                return n;
            };


            /*
             *  n / 0 = I
             *  n / N = N
             *  n / I = 0
             *  0 / n = 0
             *  0 / 0 = N
             *  0 / N = N
             *  0 / I = 0
             *  N / n = N
             *  N / 0 = N
             *  N / N = N
             *  N / I = N
             *  I / n = I
             *  I / 0 = I
             *  I / N = N
             *  I / I = N
             *
             * Return a new BigNumber whose value is the value of this BigNumber divided by the value of
             * BigNumber(y, b), rounded according to DECIMAL_PLACES and ROUNDING_MODE.
             */
            P.dividedBy = P.div = function ( y, b ) {
                return div( this, new BigNumber( y, b ), DECIMAL_PLACES, ROUNDING_MODE );
            };


            /*
             * Return a new BigNumber whose value is the integer part of dividing the value of this
             * BigNumber by the value of BigNumber(y, b).
             */
            P.dividedToIntegerBy = P.idiv = function ( y, b ) {
                return div( this, new BigNumber( y, b ), 0, 1 );
            };


            /*
             * Return true if the value of this BigNumber is equal to the value of BigNumber(y, b),
             * otherwise return false.
             */
            P.isEqualTo = P.eq = function ( y, b ) {
                return compare( this, new BigNumber( y, b ) ) === 0;
            };


            /*
             * Return a new BigNumber whose value is the value of this BigNumber rounded to an integer
             * using rounding mode rm, or ROUNDING_MODE if rm is omitted.
             *
             * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {rm}'
             */
            P.integerValue = function (rm) {
                var n = new BigNumber(this);
                if ( rm == null ) rm = ROUNDING_MODE;
                else intCheck( rm, 0, 8 );
                return round( n, n.e + 1, rm );
            };


            /*
             * Return true if the value of this BigNumber is greater than the value of BigNumber(y, b),
             * otherwise return false.
             */
            P.isGreaterThan = P.gt = function ( y, b ) {
                return compare( this, new BigNumber( y, b ) ) > 0;
            };


            /*
             * Return true if the value of this BigNumber is greater than or equal to the value of
             * BigNumber(y, b), otherwise return false.
             */
            P.isGreaterThanOrEqualTo = P.gte = function ( y, b ) {
                return ( b = compare( this, new BigNumber( y, b ) ) ) === 1 || b === 0;

            };


            /*
             * Return true if the value of this BigNumber is a finite number, otherwise return false.
             */
            P.isFinite = function () {
                return !!this.c;
            };


            /*
             * Return true if the value of this BigNumber is an integer, otherwise return false.
             */
            P.isInteger = function () {
                return !!this.c && bitFloor( this.e / LOG_BASE ) > this.c.length - 2;
            };


            /*
             * Return true if the value of this BigNumber is NaN, otherwise return false.
             */
            P.isNaN = function () {
                return !this.s;
            };


            /*
             * Return true if the value of this BigNumber is negative, otherwise return false.
             */
            P.isNegative = function () {
                return this.s < 0;
            };


            /*
             * Return true if the value of this BigNumber is positive, otherwise return false.
             */
            P.isPositive = function () {
                return this.s > 0;
            };


            /*
             * Return true if the value of this BigNumber is 0 or -0, otherwise return false.
             */
            P.isZero = function () {
                return !!this.c && this.c[0] == 0;
            };


            /*
             * Return true if the value of this BigNumber is less than the value of BigNumber(y, b),
             * otherwise return false.
             */
            P.isLessThan = P.lt = function ( y, b ) {
                return compare( this, new BigNumber( y, b ) ) < 0;
            };


            /*
             * Return true if the value of this BigNumber is less than or equal to the value of
             * BigNumber(y, b), otherwise return false.
             */
            P.isLessThanOrEqualTo = P.lte = function ( y, b ) {
                return ( b = compare( this, new BigNumber( y, b ) ) ) === -1 || b === 0;
            };


            /*
             *  n - 0 = n
             *  n - N = N
             *  n - I = -I
             *  0 - n = -n
             *  0 - 0 = 0
             *  0 - N = N
             *  0 - I = -I
             *  N - n = N
             *  N - 0 = N
             *  N - N = N
             *  N - I = N
             *  I - n = I
             *  I - 0 = I
             *  I - N = N
             *  I - I = N
             *
             * Return a new BigNumber whose value is the value of this BigNumber minus the value of
             * BigNumber(y, b).
             */
            P.minus = function ( y, b ) {
                var i, j, t, xLTy,
                    x = this,
                    a = x.s;

                y = new BigNumber( y, b );
                b = y.s;

                // Either NaN?
                if ( !a || !b ) return new BigNumber(NaN);

                // Signs differ?
                if ( a != b ) {
                    y.s = -b;
                    return x.plus(y);
                }

                var xe = x.e / LOG_BASE,
                    ye = y.e / LOG_BASE,
                    xc = x.c,
                    yc = y.c;

                if ( !xe || !ye ) {

                    // Either Infinity?
                    if ( !xc || !yc ) return xc ? ( y.s = -b, y ) : new BigNumber( yc ? x : NaN );

                    // Either zero?
                    if ( !xc[0] || !yc[0] ) {

                        // Return y if y is non-zero, x if x is non-zero, or zero if both are zero.
                        return yc[0] ? ( y.s = -b, y ) : new BigNumber( xc[0] ? x :

                            // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
                            ROUNDING_MODE == 3 ? -0 : 0 );
                    }
                }

                xe = bitFloor(xe);
                ye = bitFloor(ye);
                xc = xc.slice();

                // Determine which is the bigger number.
                if ( a = xe - ye ) {

                    if ( xLTy = a < 0 ) {
                        a = -a;
                        t = xc;
                    } else {
                        ye = xe;
                        t = yc;
                    }

                    t.reverse();

                    // Prepend zeros to equalise exponents.
                    for ( b = a; b--; t.push(0) );
                    t.reverse();
                } else {

                    // Exponents equal. Check digit by digit.
                    j = ( xLTy = ( a = xc.length ) < ( b = yc.length ) ) ? a : b;

                    for ( a = b = 0; b < j; b++ ) {

                        if ( xc[b] != yc[b] ) {
                            xLTy = xc[b] < yc[b];
                            break;
                        }
                    }
                }

                // x < y? Point xc to the array of the bigger number.
                if (xLTy) t = xc, xc = yc, yc = t, y.s = -y.s;

                b = ( j = yc.length ) - ( i = xc.length );

                // Append zeros to xc if shorter.
                // No need to add zeros to yc if shorter as subtract only needs to start at yc.length.
                if ( b > 0 ) for ( ; b--; xc[i++] = 0 );
                b = BASE - 1;

                // Subtract yc from xc.
                for ( ; j > a; ) {

                    if ( xc[--j] < yc[j] ) {
                        for ( i = j; i && !xc[--i]; xc[i] = b );
                        --xc[i];
                        xc[j] += BASE;
                    }

                    xc[j] -= yc[j];
                }

                // Remove leading zeros and adjust exponent accordingly.
                for ( ; xc[0] == 0; xc.splice(0, 1), --ye );

                // Zero?
                if ( !xc[0] ) {

                    // Following IEEE 754 (2008) 6.3,
                    // n - n = +0  but  n - n = -0  when rounding towards -Infinity.
                    y.s = ROUNDING_MODE == 3 ? -1 : 1;
                    y.c = [ y.e = 0 ];
                    return y;
                }

                // No need to check for Infinity as +x - +y != Infinity && -x - -y != Infinity
                // for finite x and y.
                return normalise( y, xc, ye );
            };


            /*
             *   n % 0 =  N
             *   n % N =  N
             *   n % I =  n
             *   0 % n =  0
             *  -0 % n = -0
             *   0 % 0 =  N
             *   0 % N =  N
             *   0 % I =  0
             *   N % n =  N
             *   N % 0 =  N
             *   N % N =  N
             *   N % I =  N
             *   I % n =  N
             *   I % 0 =  N
             *   I % N =  N
             *   I % I =  N
             *
             * Return a new BigNumber whose value is the value of this BigNumber modulo the value of
             * BigNumber(y, b). The result depends on the value of MODULO_MODE.
             */
            P.modulo = P.mod = function ( y, b ) {
                var q, s,
                    x = this;

                y = new BigNumber( y, b );

                // Return NaN if x is Infinity or NaN, or y is NaN or zero.
                if ( !x.c || !y.s || y.c && !y.c[0] ) {
                    return new BigNumber(NaN);

                    // Return x if y is Infinity or x is zero.
                } else if ( !y.c || x.c && !x.c[0] ) {
                    return new BigNumber(x);
                }

                if ( MODULO_MODE == 9 ) {

                    // Euclidian division: q = sign(y) * floor(x / abs(y))
                    // r = x - qy    where  0 <= r < abs(y)
                    s = y.s;
                    y.s = 1;
                    q = div( x, y, 0, 3 );
                    y.s = s;
                    q.s *= s;
                } else {
                    q = div( x, y, 0, MODULO_MODE );
                }

                return x.minus( q.times(y) );
            };


            /*
             *  n * 0 = 0
             *  n * N = N
             *  n * I = I
             *  0 * n = 0
             *  0 * 0 = 0
             *  0 * N = N
             *  0 * I = N
             *  N * n = N
             *  N * 0 = N
             *  N * N = N
             *  N * I = N
             *  I * n = I
             *  I * 0 = N
             *  I * N = N
             *  I * I = I
             *
             * Return a new BigNumber whose value is the value of this BigNumber multiplied by the value
             * of BigNumber(y, b).
             */
            P.multipliedBy = P.times = function ( y, b ) {
                var c, e, i, j, k, m, xcL, xlo, xhi, ycL, ylo, yhi, zc,
                    base, sqrtBase,
                    x = this,
                    xc = x.c,
                    yc = ( y = new BigNumber( y, b ) ).c;

                // Either NaN, ±Infinity or ±0?
                if ( !xc || !yc || !xc[0] || !yc[0] ) {

                    // Return NaN if either is NaN, or one is 0 and the other is Infinity.
                    if ( !x.s || !y.s || xc && !xc[0] && !yc || yc && !yc[0] && !xc ) {
                        y.c = y.e = y.s = null;
                    } else {
                        y.s *= x.s;

                        // Return ±Infinity if either is ±Infinity.
                        if ( !xc || !yc ) {
                            y.c = y.e = null;

                            // Return ±0 if either is ±0.
                        } else {
                            y.c = [0];
                            y.e = 0;
                        }
                    }

                    return y;
                }

                e = bitFloor( x.e / LOG_BASE ) + bitFloor( y.e / LOG_BASE );
                y.s *= x.s;
                xcL = xc.length;
                ycL = yc.length;

                // Ensure xc points to longer array and xcL to its length.
                if ( xcL < ycL ) zc = xc, xc = yc, yc = zc, i = xcL, xcL = ycL, ycL = i;

                // Initialise the result array with zeros.
                for ( i = xcL + ycL, zc = []; i--; zc.push(0) );

                base = BASE;
                sqrtBase = SQRT_BASE;

                for ( i = ycL; --i >= 0; ) {
                    c = 0;
                    ylo = yc[i] % sqrtBase;
                    yhi = yc[i] / sqrtBase | 0;

                    for ( k = xcL, j = i + k; j > i; ) {
                        xlo = xc[--k] % sqrtBase;
                        xhi = xc[k] / sqrtBase | 0;
                        m = yhi * xlo + xhi * ylo;
                        xlo = ylo * xlo + ( ( m % sqrtBase ) * sqrtBase ) + zc[j] + c;
                        c = ( xlo / base | 0 ) + ( m / sqrtBase | 0 ) + yhi * xhi;
                        zc[j--] = xlo % base;
                    }

                    zc[j] = c;
                }

                if (c) {
                    ++e;
                } else {
                    zc.splice(0, 1);
                }

                return normalise( y, zc, e );
            };


            /*
             * Return a new BigNumber whose value is the value of this BigNumber negated,
             * i.e. multiplied by -1.
             */
            P.negated = function () {
                var x = new BigNumber(this);
                x.s = -x.s || null;
                return x;
            };


            /*
             *  n + 0 = n
             *  n + N = N
             *  n + I = I
             *  0 + n = n
             *  0 + 0 = 0
             *  0 + N = N
             *  0 + I = I
             *  N + n = N
             *  N + 0 = N
             *  N + N = N
             *  N + I = N
             *  I + n = I
             *  I + 0 = I
             *  I + N = N
             *  I + I = I
             *
             * Return a new BigNumber whose value is the value of this BigNumber plus the value of
             * BigNumber(y, b).
             */
            P.plus = function ( y, b ) {
                var t,
                    x = this,
                    a = x.s;

                y = new BigNumber( y, b );
                b = y.s;

                // Either NaN?
                if ( !a || !b ) return new BigNumber(NaN);

                // Signs differ?
                if ( a != b ) {
                    y.s = -b;
                    return x.minus(y);
                }

                var xe = x.e / LOG_BASE,
                    ye = y.e / LOG_BASE,
                    xc = x.c,
                    yc = y.c;

                if ( !xe || !ye ) {

                    // Return ±Infinity if either ±Infinity.
                    if ( !xc || !yc ) return new BigNumber( a / 0 );

                    // Either zero?
                    // Return y if y is non-zero, x if x is non-zero, or zero if both are zero.
                    if ( !xc[0] || !yc[0] ) return yc[0] ? y : new BigNumber( xc[0] ? x : a * 0 );
                }

                xe = bitFloor(xe);
                ye = bitFloor(ye);
                xc = xc.slice();

                // Prepend zeros to equalise exponents. Faster to use reverse then do unshifts.
                if ( a = xe - ye ) {
                    if ( a > 0 ) {
                        ye = xe;
                        t = yc;
                    } else {
                        a = -a;
                        t = xc;
                    }

                    t.reverse();
                    for ( ; a--; t.push(0) );
                    t.reverse();
                }

                a = xc.length;
                b = yc.length;

                // Point xc to the longer array, and b to the shorter length.
                if ( a - b < 0 ) t = yc, yc = xc, xc = t, b = a;

                // Only start adding at yc.length - 1 as the further digits of xc can be ignored.
                for ( a = 0; b; ) {
                    a = ( xc[--b] = xc[b] + yc[b] + a ) / BASE | 0;
                    xc[b] = BASE === xc[b] ? 0 : xc[b] % BASE;
                }

                if (a) {
                    xc = [a].concat(xc);
                    ++ye;
                }

                // No need to check for zero, as +x + +y != 0 && -x + -y != 0
                // ye = MAX_EXP + 1 possible
                return normalise( y, xc, ye );
            };


            /*
             * If sd is undefined or null or true or false, return the number of significant digits of
             * the value of this BigNumber, or null if the value of this BigNumber is ±Infinity or NaN.
             * If sd is true include integer-part trailing zeros in the count.
             *
             * Otherwise, if sd is a number, return a new BigNumber whose value is the value of this
             * BigNumber rounded to a maximum of sd significant digits using rounding mode rm, or
             * ROUNDING_MODE if rm is omitted.
             *
             * sd {number|boolean} number: significant digits: integer, 1 to MAX inclusive.
             *                     boolean: whether to count integer-part trailing zeros: true or false.
             * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {sd|rm}'
             */
            P.precision = P.sd = function ( sd, rm ) {
                var c, n, v,
                    x = this;

                if ( sd != null && sd !== !!sd ) {
                    intCheck( sd, 1, MAX );
                    if ( rm == null ) rm = ROUNDING_MODE;
                    else intCheck( rm, 0, 8 );

                    return round( new BigNumber(x), sd, rm );
                }

                if ( !( c = x.c ) ) return null;
                v = c.length - 1;
                n = v * LOG_BASE + 1;

                if ( v = c[v] ) {

                    // Subtract the number of trailing zeros of the last element.
                    for ( ; v % 10 == 0; v /= 10, n-- );

                    // Add the number of digits of the first element.
                    for ( v = c[0]; v >= 10; v /= 10, n++ );
                }

                if ( sd && x.e + 1 > n ) n = x.e + 1;

                return n;
            };


            /*
             * Return a new BigNumber whose value is the value of this BigNumber shifted by k places
             * (powers of 10). Shift to the right if n > 0, and to the left if n < 0.
             *
             * k {number} Integer, -MAX_SAFE_INTEGER to MAX_SAFE_INTEGER inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {k}'
             */
            P.shiftedBy = function (k) {
                intCheck( k, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER );
                return this.times( '1e' + k );
            };


            /*
             *  sqrt(-n) =  N
             *  sqrt( N) =  N
             *  sqrt(-I) =  N
             *  sqrt( I) =  I
             *  sqrt( 0) =  0
             *  sqrt(-0) = -0
             *
             * Return a new BigNumber whose value is the square root of the value of this BigNumber,
             * rounded according to DECIMAL_PLACES and ROUNDING_MODE.
             */
            P.squareRoot = P.sqrt = function () {
                var m, n, r, rep, t,
                    x = this,
                    c = x.c,
                    s = x.s,
                    e = x.e,
                    dp = DECIMAL_PLACES + 4,
                    half = new BigNumber('0.5');

                // Negative/NaN/Infinity/zero?
                if ( s !== 1 || !c || !c[0] ) {
                    return new BigNumber( !s || s < 0 && ( !c || c[0] ) ? NaN : c ? x : 1 / 0 );
                }

                // Initial estimate.
                s = Math.sqrt( +x );

                // Math.sqrt underflow/overflow?
                // Pass x to Math.sqrt as integer, then adjust the exponent of the result.
                if ( s == 0 || s == 1 / 0 ) {
                    n = coeffToString(c);
                    if ( ( n.length + e ) % 2 == 0 ) n += '0';
                    s = Math.sqrt(n);
                    e = bitFloor( ( e + 1 ) / 2 ) - ( e < 0 || e % 2 );

                    if ( s == 1 / 0 ) {
                        n = '1e' + e;
                    } else {
                        n = s.toExponential();
                        n = n.slice( 0, n.indexOf('e') + 1 ) + e;
                    }

                    r = new BigNumber(n);
                } else {
                    r = new BigNumber( s + '' );
                }

                // Check for zero.
                // r could be zero if MIN_EXP is changed after the this value was created.
                // This would cause a division by zero (x/t) and hence Infinity below, which would cause
                // coeffToString to throw.
                if ( r.c[0] ) {
                    e = r.e;
                    s = e + dp;
                    if ( s < 3 ) s = 0;

                    // Newton-Raphson iteration.
                    for ( ; ; ) {
                        t = r;
                        r = half.times( t.plus( div( x, t, dp, 1 ) ) );

                        if ( coeffToString( t.c   ).slice( 0, s ) === ( n =
                                coeffToString( r.c ) ).slice( 0, s ) ) {

                            // The exponent of r may here be one less than the final result exponent,
                            // e.g 0.0009999 (e-4) --> 0.001 (e-3), so adjust s so the rounding digits
                            // are indexed correctly.
                            if ( r.e < e ) --s;
                            n = n.slice( s - 3, s + 1 );

                            // The 4th rounding digit may be in error by -1 so if the 4 rounding digits
                            // are 9999 or 4999 (i.e. approaching a rounding boundary) continue the
                            // iteration.
                            if ( n == '9999' || !rep && n == '4999' ) {

                                // On the first iteration only, check to see if rounding up gives the
                                // exact result as the nines may infinitely repeat.
                                if ( !rep ) {
                                    round( t, t.e + DECIMAL_PLACES + 2, 0 );

                                    if ( t.times(t).eq(x) ) {
                                        r = t;
                                        break;
                                    }
                                }

                                dp += 4;
                                s += 4;
                                rep = 1;
                            } else {

                                // If rounding digits are null, 0{0,4} or 50{0,3}, check for exact
                                // result. If not, then there are further digits and m will be truthy.
                                if ( !+n || !+n.slice(1) && n.charAt(0) == '5' ) {

                                    // Truncate to the first rounding digit.
                                    round( r, r.e + DECIMAL_PLACES + 2, 1 );
                                    m = !r.times(r).eq(x);
                                }

                                break;
                            }
                        }
                    }
                }

                return round( r, r.e + DECIMAL_PLACES + 1, ROUNDING_MODE, m );
            };


            /*
             * Return a string representing the value of this BigNumber in exponential notation and
             * rounded using ROUNDING_MODE to dp fixed decimal places.
             *
             * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
             * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
             */
            P.toExponential = function ( dp, rm ) {
                if ( dp != null ) {
                    intCheck( dp, 0, MAX );
                    dp++;
                }
                return format( this, dp, rm, 1 );
            };


            /*
             * Return a string representing the value of this BigNumber in fixed-point notation rounding
             * to dp fixed decimal places using rounding mode rm, or ROUNDING_MODE if rm is omitted.
             *
             * Note: as with JavaScript's number type, (-0).toFixed(0) is '0',
             * but e.g. (-0.00001).toFixed(0) is '-0'.
             *
             * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
             * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
             */
            P.toFixed = function ( dp, rm ) {
                if ( dp != null ) {
                    intCheck( dp, 0, MAX );
                    dp = dp + this.e + 1;
                }
                return format( this, dp, rm );
            };


            /*
             * Return a string representing the value of this BigNumber in fixed-point notation rounded
             * using rm or ROUNDING_MODE to dp decimal places, and formatted according to the properties
             * of the FORMAT object (see BigNumber.set).
             *
             * FORMAT = {
             *      decimalSeparator : '.',
             *      groupSeparator : ',',
             *      groupSize : 3,
             *      secondaryGroupSize : 0,
             *      fractionGroupSeparator : '\xA0',    // non-breaking space
             *      fractionGroupSize : 0
             * };
             *
             * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
             * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
             */
            P.toFormat = function ( dp, rm ) {
                var str = this.toFixed( dp, rm );

                if ( this.c ) {
                    var i,
                        arr = str.split('.'),
                        g1 = +FORMAT.groupSize,
                        g2 = +FORMAT.secondaryGroupSize,
                        groupSeparator = FORMAT.groupSeparator,
                        intPart = arr[0],
                        fractionPart = arr[1],
                        isNeg = this.s < 0,
                        intDigits = isNeg ? intPart.slice(1) : intPart,
                        len = intDigits.length;

                    if (g2) i = g1, g1 = g2, g2 = i, len -= i;

                    if ( g1 > 0 && len > 0 ) {
                        i = len % g1 || g1;
                        intPart = intDigits.substr( 0, i );

                        for ( ; i < len; i += g1 ) {
                            intPart += groupSeparator + intDigits.substr( i, g1 );
                        }

                        if ( g2 > 0 ) intPart += groupSeparator + intDigits.slice(i);
                        if (isNeg) intPart = '-' + intPart;
                    }

                    str = fractionPart
                        ? intPart + FORMAT.decimalSeparator + ( ( g2 = +FORMAT.fractionGroupSize )
                            ? fractionPart.replace( new RegExp( '\\d{' + g2 + '}\\B', 'g' ),
                                '$&' + FORMAT.fractionGroupSeparator )
                            : fractionPart )
                        : intPart;
                }

                return str;
            };


            /*
             * Return a string array representing the value of this BigNumber as a simple fraction with
             * an integer numerator and an integer denominator. The denominator will be a positive
             * non-zero value less than or equal to the specified maximum denominator. If a maximum
             * denominator is not specified, the denominator will be the lowest value necessary to
             * represent the number exactly.
             *
             * [md] {number|string|BigNumber} Integer >= 1 and < Infinity. The maximum denominator.
             *
             * '[BigNumber Error] Argument {not an integer|out of range} : {md}'
             */
            P.toFraction = function (md) {
                var arr, d, d0, d1, d2, e, exp, n, n0, n1, q, s,
                    x = this,
                    xc = x.c;

                if ( md != null ) {
                    n = new BigNumber(md);

                    if ( !n.isInteger() || n.lt(ONE) ) {
                        throw Error
                        ( bignumberError + 'Argument ' +
                            ( n.isInteger() ? 'out of range: ' : 'not an integer: ' ) + md );
                    }
                }

                if ( !xc ) return x.toString();

                d = new BigNumber(ONE);
                n1 = d0 = new BigNumber(ONE);
                d1 = n0 = new BigNumber(ONE);
                s = coeffToString(xc);

                // Determine initial denominator.
                // d is a power of 10 and the minimum max denominator that specifies the value exactly.
                e = d.e = s.length - x.e - 1;
                d.c[0] = POWS_TEN[ ( exp = e % LOG_BASE ) < 0 ? LOG_BASE + exp : exp ];
                md = !md || n.comparedTo(d) > 0 ? ( e > 0 ? d : n1 ) : n;

                exp = MAX_EXP;
                MAX_EXP = 1 / 0;
                n = new BigNumber(s);

                // n0 = d1 = 0
                n0.c[0] = 0;

                for ( ; ; )  {
                    q = div( n, d, 0, 1 );
                    d2 = d0.plus( q.times(d1) );
                    if ( d2.comparedTo(md) == 1 ) break;
                    d0 = d1;
                    d1 = d2;
                    n1 = n0.plus( q.times( d2 = n1 ) );
                    n0 = d2;
                    d = n.minus( q.times( d2 = d ) );
                    n = d2;
                }

                d2 = div( md.minus(d0), d1, 0, 1 );
                n0 = n0.plus( d2.times(n1) );
                d0 = d0.plus( d2.times(d1) );
                n0.s = n1.s = x.s;
                e *= 2;

                // Determine which fraction is closer to x, n0/d0 or n1/d1
                arr = div( n1, d1, e, ROUNDING_MODE ).minus(x).abs().comparedTo(
                    div( n0, d0, e, ROUNDING_MODE ).minus(x).abs() ) < 1
                    ? [ n1.toString(), d1.toString() ]
                    : [ n0.toString(), d0.toString() ];

                MAX_EXP = exp;
                return arr;
            };


            /*
             * Return the value of this BigNumber converted to a number primitive.
             */
            P.toNumber = function () {
                return +this;
            };


            /*
             * Return a BigNumber whose value is the value of this BigNumber exponentiated by n.
             *
             * If m is present, return the result modulo m.
             * If n is negative round according to DECIMAL_PLACES and ROUNDING_MODE.
             * If POW_PRECISION is non-zero and m is not present, round to POW_PRECISION using ROUNDING_MODE.
             *
             * The modular power operation works efficiently when x, n, and m are positive integers,
             * otherwise it is equivalent to calculating x.exponentiatedBy(n).modulo(m) with a POW_PRECISION of 0.
             *
             * n {number} Integer, -MAX_SAFE_INTEGER to MAX_SAFE_INTEGER inclusive.
             * [m] {number|string|BigNumber} The modulus.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {n}'
             *
             * Performs 54 loop iterations for n of 9007199254740991.
             */
            P.exponentiatedBy = P.pow = function ( n, m ) {
                var i, k, y, z,
                    x = this;

                intCheck( n, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER );
                if ( m != null ) m = new BigNumber(m);

                if (m) {
                    if ( n > 1 && x.gt(ONE) && x.isInteger() && m.gt(ONE) && m.isInteger() ) {
                        x = x.mod(m);
                    } else {
                        z = m;

                        // Nullify m so only a single mod operation is performed at the end.
                        m = null;
                    }
                } else if (POW_PRECISION) {

                    // Truncating each coefficient array to a length of k after each multiplication
                    // equates to truncating significant digits to POW_PRECISION + [28, 41],
                    // i.e. there will be a minimum of 28 guard digits retained.
                    //k = mathceil( POW_PRECISION / LOG_BASE + 1.5 );   // gives [9, 21] guard digits.
                    k = mathceil( POW_PRECISION / LOG_BASE + 2 );
                }

                y = new BigNumber(ONE);

                for ( i = mathfloor( n < 0 ? -n : n ); ; ) {
                    if ( i % 2 ) {
                        y = y.times(x);
                        if ( !y.c ) break;
                        if (k) {
                            if ( y.c.length > k ) y.c.length = k;
                        } else if (m) {
                            y = y.mod(m);
                        }
                    }

                    i = mathfloor( i / 2 );
                    if ( !i ) break;
                    x = x.times(x);
                    if (k) {
                        if ( x.c && x.c.length > k ) x.c.length = k;
                    } else if (m) {
                        x = x.mod(m);
                    }
                }

                if (m) return y;
                if ( n < 0 ) y = ONE.div(y);

                return z ? y.mod(z) : k ? round( y, POW_PRECISION, ROUNDING_MODE ) : y;
            };


            /*
             * Return a string representing the value of this BigNumber rounded to sd significant digits
             * using rounding mode rm or ROUNDING_MODE. If sd is less than the number of digits
             * necessary to represent the integer part of the value in fixed-point notation, then use
             * exponential notation.
             *
             * [sd] {number} Significant digits. Integer, 1 to MAX inclusive.
             * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
             *
             * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {sd|rm}'
             */
            P.toPrecision = function ( sd, rm ) {
                if ( sd != null ) intCheck( sd, 1, MAX );
                return format( this, sd, rm, 2 );
            };


            /*
             * Return a string representing the value of this BigNumber in base b, or base 10 if b is
             * omitted. If a base is specified, including base 10, round according to DECIMAL_PLACES and
             * ROUNDING_MODE. If a base is not specified, and this BigNumber has a positive exponent
             * that is equal to or greater than TO_EXP_POS, or a negative exponent equal to or less than
             * TO_EXP_NEG, return exponential notation.
             *
             * [b] {number} Integer, 2 to ALPHABET.length inclusive.
             *
             * '[BigNumber Error] Base {not a primitive number|not an integer|out of range}: {b}'
             */
            P.toString = function (b) {
                var str,
                    n = this,
                    s = n.s,
                    e = n.e;

                // Infinity or NaN?
                if ( e === null ) {

                    if (s) {
                        str = 'Infinity';
                        if ( s < 0 ) str = '-' + str;
                    } else {
                        str = 'NaN';
                    }
                } else {
                    str = coeffToString( n.c );

                    if ( b == null ) {
                        str = e <= TO_EXP_NEG || e >= TO_EXP_POS
                            ? toExponential( str, e )
                            : toFixedPoint( str, e, '0' );
                    } else {
                        intCheck( b, 2, ALPHABET.length, 'Base' );
                        str = convertBase( toFixedPoint( str, e, '0' ), 10, b, s, true );
                    }

                    if ( s < 0 && n.c[0] ) str = '-' + str;
                }

                return str;
            };


            /*
             * Return as toString, but do not accept a base argument, and include the minus sign for
             * negative zero.
             */
            P.valueOf = P.toJSON = function () {
                var str,
                    n = this,
                    e = n.e;

                if ( e === null ) return n.toString();

                str = coeffToString( n.c );

                str = e <= TO_EXP_NEG || e >= TO_EXP_POS
                    ? toExponential( str, e )
                    : toFixedPoint( str, e, '0' );

                return n.s < 0 ? '-' + str : str;
            };


            P._isBigNumber = true;

            if ( configObject != null ) BigNumber.set(configObject);

            return BigNumber;
        }


        // PRIVATE HELPER FUNCTIONS


        function bitFloor(n) {
            var i = n | 0;
            return n > 0 || n === i ? i : i - 1;
        }


        // Return a coefficient array as a string of base 10 digits.
        function coeffToString(a) {
            var s, z,
                i = 1,
                j = a.length,
                r = a[0] + '';

            for ( ; i < j; ) {
                s = a[i++] + '';
                z = LOG_BASE - s.length;
                for ( ; z--; s = '0' + s );
                r += s;
            }

            // Determine trailing zeros.
            for ( j = r.length; r.charCodeAt(--j) === 48; );
            return r.slice( 0, j + 1 || 1 );
        }


        // Compare the value of BigNumbers x and y.
        function compare( x, y ) {
            var a, b,
                xc = x.c,
                yc = y.c,
                i = x.s,
                j = y.s,
                k = x.e,
                l = y.e;

            // Either NaN?
            if ( !i || !j ) return null;

            a = xc && !xc[0];
            b = yc && !yc[0];

            // Either zero?
            if ( a || b ) return a ? b ? 0 : -j : i;

            // Signs differ?
            if ( i != j ) return i;

            a = i < 0;
            b = k == l;

            // Either Infinity?
            if ( !xc || !yc ) return b ? 0 : !xc ^ a ? 1 : -1;

            // Compare exponents.
            if ( !b ) return k > l ^ a ? 1 : -1;

            j = ( k = xc.length ) < ( l = yc.length ) ? k : l;

            // Compare digit by digit.
            for ( i = 0; i < j; i++ ) if ( xc[i] != yc[i] ) return xc[i] > yc[i] ^ a ? 1 : -1;

            // Compare lengths.
            return k == l ? 0 : k > l ^ a ? 1 : -1;
        }


        /*
         * Check that n is a primitive number, an integer, and in range, otherwise throw.
         */
        function intCheck( n, min, max, name ) {
            if ( n < min || n > max || n !== ( n < 0 ? mathceil(n) : mathfloor(n) ) ) {
                throw Error
                ( bignumberError + ( name || 'Argument' ) + ( typeof n == 'number'
                        ? n < min || n > max ? ' out of range: ' : ' not an integer: '
                        : ' not a primitive number: ' ) + n );
            }
        }


        function isArray(obj) {
            return Object.prototype.toString.call(obj) == '[object Array]';
        }


        function toExponential( str, e ) {
            return ( str.length > 1 ? str.charAt(0) + '.' + str.slice(1) : str ) +
                ( e < 0 ? 'e' : 'e+' ) + e;
        }


        function toFixedPoint( str, e, z ) {
            var len, zs;

            // Negative exponent?
            if ( e < 0 ) {

                // Prepend zeros.
                for ( zs = z + '.'; ++e; zs += z );
                str = zs + str;

                // Positive exponent
            } else {
                len = str.length;

                // Append zeros.
                if ( ++e > len ) {
                    for ( zs = z, e -= len; --e; zs += z );
                    str += zs;
                } else if ( e < len ) {
                    str = str.slice( 0, e ) + '.' + str.slice(e);
                }
            }

            return str;
        }


        // EXPORT


        BigNumber = clone();
        BigNumber['default'] = BigNumber.BigNumber = BigNumber;


        // AMD.
        if ( typeof define == 'function' && define.amd ) {
            define( function () { return BigNumber; } );

            // Node.js and other environments that support module.exports.
        } else if ( typeof module != 'undefined' && module.exports ) {
            module.exports = BigNumber;

            // Browser.
        } else {
            if ( !globalObject ) {
                globalObject = typeof self != 'undefined' ? self : Function('return this')();
            }

            globalObject.BigNumber = BigNumber;
        }
    })(this);

},{}],20:[function(require,module,exports){
    (function (process,global){
        /* @preserve
         * The MIT License (MIT)
         *
         * Copyright (c) 2013-2017 Petka Antonov
         *
         * Permission is hereby granted, free of charge, to any person obtaining a copy
         * of this software and associated documentation files (the "Software"), to deal
         * in the Software without restriction, including without limitation the rights
         * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
         * copies of the Software, and to permit persons to whom the Software is
         * furnished to do so, subject to the following conditions:
         *
         * The above copyright notice and this permission notice shall be included in
         * all copies or substantial portions of the Software.
         *
         * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
         * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
         * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
         * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
         * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
         * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
         * THE SOFTWARE.
         *
         */
        /**
         * bluebird build version 3.5.1
         * Features enabled: core, race, call_get, generators, map, nodeify, promisify, props, reduce, settle, some, using, timers, filter, any, each
         */
        !function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof _dereq_=="function"&&_dereq_;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof _dereq_=="function"&&_dereq_;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise) {
                var SomePromiseArray = Promise._SomePromiseArray;
                function any(promises) {
                    var ret = new SomePromiseArray(promises);
                    var promise = ret.promise();
                    ret.setHowMany(1);
                    ret.setUnwrap();
                    ret.init();
                    return promise;
                }

                Promise.any = function (promises) {
                    return any(promises);
                };

                Promise.prototype.any = function () {
                    return any(this);
                };

            };

        },{}],2:[function(_dereq_,module,exports){
            "use strict";
            var firstLineError;
            try {throw new Error(); } catch (e) {firstLineError = e;}
            var schedule = _dereq_("./schedule");
            var Queue = _dereq_("./queue");
            var util = _dereq_("./util");

            function Async() {
                this._customScheduler = false;
                this._isTickUsed = false;
                this._lateQueue = new Queue(16);
                this._normalQueue = new Queue(16);
                this._haveDrainedQueues = false;
                this._trampolineEnabled = true;
                var self = this;
                this.drainQueues = function () {
                    self._drainQueues();
                };
                this._schedule = schedule;
            }

            Async.prototype.setScheduler = function(fn) {
                var prev = this._schedule;
                this._schedule = fn;
                this._customScheduler = true;
                return prev;
            };

            Async.prototype.hasCustomScheduler = function() {
                return this._customScheduler;
            };

            Async.prototype.enableTrampoline = function() {
                this._trampolineEnabled = true;
            };

            Async.prototype.disableTrampolineIfNecessary = function() {
                if (util.hasDevTools) {
                    this._trampolineEnabled = false;
                }
            };

            Async.prototype.haveItemsQueued = function () {
                return this._isTickUsed || this._haveDrainedQueues;
            };


            Async.prototype.fatalError = function(e, isNode) {
                if (isNode) {
                    process.stderr.write("Fatal " + (e instanceof Error ? e.stack : e) +
                        "\n");
                    process.exit(2);
                } else {
                    this.throwLater(e);
                }
            };

            Async.prototype.throwLater = function(fn, arg) {
                if (arguments.length === 1) {
                    arg = fn;
                    fn = function () { throw arg; };
                }
                if (typeof setTimeout !== "undefined") {
                    setTimeout(function() {
                        fn(arg);
                    }, 0);
                } else try {
                    this._schedule(function() {
                        fn(arg);
                    });
                } catch (e) {
                    throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                }
            };

            function AsyncInvokeLater(fn, receiver, arg) {
                this._lateQueue.push(fn, receiver, arg);
                this._queueTick();
            }

            function AsyncInvoke(fn, receiver, arg) {
                this._normalQueue.push(fn, receiver, arg);
                this._queueTick();
            }

            function AsyncSettlePromises(promise) {
                this._normalQueue._pushOne(promise);
                this._queueTick();
            }

            if (!util.hasDevTools) {
                Async.prototype.invokeLater = AsyncInvokeLater;
                Async.prototype.invoke = AsyncInvoke;
                Async.prototype.settlePromises = AsyncSettlePromises;
            } else {
                Async.prototype.invokeLater = function (fn, receiver, arg) {
                    if (this._trampolineEnabled) {
                        AsyncInvokeLater.call(this, fn, receiver, arg);
                    } else {
                        this._schedule(function() {
                            setTimeout(function() {
                                fn.call(receiver, arg);
                            }, 100);
                        });
                    }
                };

                Async.prototype.invoke = function (fn, receiver, arg) {
                    if (this._trampolineEnabled) {
                        AsyncInvoke.call(this, fn, receiver, arg);
                    } else {
                        this._schedule(function() {
                            fn.call(receiver, arg);
                        });
                    }
                };

                Async.prototype.settlePromises = function(promise) {
                    if (this._trampolineEnabled) {
                        AsyncSettlePromises.call(this, promise);
                    } else {
                        this._schedule(function() {
                            promise._settlePromises();
                        });
                    }
                };
            }

            Async.prototype._drainQueue = function(queue) {
                while (queue.length() > 0) {
                    var fn = queue.shift();
                    if (typeof fn !== "function") {
                        fn._settlePromises();
                        continue;
                    }
                    var receiver = queue.shift();
                    var arg = queue.shift();
                    fn.call(receiver, arg);
                }
            };

            Async.prototype._drainQueues = function () {
                this._drainQueue(this._normalQueue);
                this._reset();
                this._haveDrainedQueues = true;
                this._drainQueue(this._lateQueue);
            };

            Async.prototype._queueTick = function () {
                if (!this._isTickUsed) {
                    this._isTickUsed = true;
                    this._schedule(this.drainQueues);
                }
            };

            Async.prototype._reset = function () {
                this._isTickUsed = false;
            };

            module.exports = Async;
            module.exports.firstLineError = firstLineError;

        },{"./queue":26,"./schedule":29,"./util":36}],3:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, INTERNAL, tryConvertToPromise, debug) {
                var calledBind = false;
                var rejectThis = function(_, e) {
                    this._reject(e);
                };

                var targetRejected = function(e, context) {
                    context.promiseRejectionQueued = true;
                    context.bindingPromise._then(rejectThis, rejectThis, null, this, e);
                };

                var bindingResolved = function(thisArg, context) {
                    if (((this._bitField & 50397184) === 0)) {
                        this._resolveCallback(context.target);
                    }
                };

                var bindingRejected = function(e, context) {
                    if (!context.promiseRejectionQueued) this._reject(e);
                };

                Promise.prototype.bind = function (thisArg) {
                    if (!calledBind) {
                        calledBind = true;
                        Promise.prototype._propagateFrom = debug.propagateFromFunction();
                        Promise.prototype._boundValue = debug.boundValueFunction();
                    }
                    var maybePromise = tryConvertToPromise(thisArg);
                    var ret = new Promise(INTERNAL);
                    ret._propagateFrom(this, 1);
                    var target = this._target();
                    ret._setBoundTo(maybePromise);
                    if (maybePromise instanceof Promise) {
                        var context = {
                            promiseRejectionQueued: false,
                            promise: ret,
                            target: target,
                            bindingPromise: maybePromise
                        };
                        target._then(INTERNAL, targetRejected, undefined, ret, context);
                        maybePromise._then(
                            bindingResolved, bindingRejected, undefined, ret, context);
                        ret._setOnCancel(maybePromise);
                    } else {
                        ret._resolveCallback(target);
                    }
                    return ret;
                };

                Promise.prototype._setBoundTo = function (obj) {
                    if (obj !== undefined) {
                        this._bitField = this._bitField | 2097152;
                        this._boundTo = obj;
                    } else {
                        this._bitField = this._bitField & (~2097152);
                    }
                };

                Promise.prototype._isBound = function () {
                    return (this._bitField & 2097152) === 2097152;
                };

                Promise.bind = function (thisArg, value) {
                    return Promise.resolve(value).bind(thisArg);
                };
            };

        },{}],4:[function(_dereq_,module,exports){
            "use strict";
            var old;
            if (typeof Promise !== "undefined") old = Promise;
            function noConflict() {
                try { if (Promise === bluebird) Promise = old; }
                catch (e) {}
                return bluebird;
            }
            var bluebird = _dereq_("./promise")();
            bluebird.noConflict = noConflict;
            module.exports = bluebird;

        },{"./promise":22}],5:[function(_dereq_,module,exports){
            "use strict";
            var cr = Object.create;
            if (cr) {
                var callerCache = cr(null);
                var getterCache = cr(null);
                callerCache[" size"] = getterCache[" size"] = 0;
            }

            module.exports = function(Promise) {
                var util = _dereq_("./util");
                var canEvaluate = util.canEvaluate;
                var isIdentifier = util.isIdentifier;

                var getMethodCaller;
                var getGetter;
                if (!true) {
                    var makeMethodCaller = function (methodName) {
                        return new Function("ensureMethod", "                                    \n\
        return function(obj) {                                               \n\
            'use strict'                                                     \n\
            var len = this.length;                                           \n\
            ensureMethod(obj, 'methodName');                                 \n\
            switch(len) {                                                    \n\
                case 1: return obj.methodName(this[0]);                      \n\
                case 2: return obj.methodName(this[0], this[1]);             \n\
                case 3: return obj.methodName(this[0], this[1], this[2]);    \n\
                case 0: return obj.methodName();                             \n\
                default:                                                     \n\
                    return obj.methodName.apply(obj, this);                  \n\
            }                                                                \n\
        };                                                                   \n\
        ".replace(/methodName/g, methodName))(ensureMethod);
                    };

                    var makeGetter = function (propertyName) {
                        return new Function("obj", "                                             \n\
        'use strict';                                                        \n\
        return obj.propertyName;                                             \n\
        ".replace("propertyName", propertyName));
                    };

                    var getCompiled = function(name, compiler, cache) {
                        var ret = cache[name];
                        if (typeof ret !== "function") {
                            if (!isIdentifier(name)) {
                                return null;
                            }
                            ret = compiler(name);
                            cache[name] = ret;
                            cache[" size"]++;
                            if (cache[" size"] > 512) {
                                var keys = Object.keys(cache);
                                for (var i = 0; i < 256; ++i) delete cache[keys[i]];
                                cache[" size"] = keys.length - 256;
                            }
                        }
                        return ret;
                    };

                    getMethodCaller = function(name) {
                        return getCompiled(name, makeMethodCaller, callerCache);
                    };

                    getGetter = function(name) {
                        return getCompiled(name, makeGetter, getterCache);
                    };
                }

                function ensureMethod(obj, methodName) {
                    var fn;
                    if (obj != null) fn = obj[methodName];
                    if (typeof fn !== "function") {
                        var message = "Object " + util.classString(obj) + " has no method '" +
                            util.toString(methodName) + "'";
                        throw new Promise.TypeError(message);
                    }
                    return fn;
                }

                function caller(obj) {
                    var methodName = this.pop();
                    var fn = ensureMethod(obj, methodName);
                    return fn.apply(obj, this);
                }
                Promise.prototype.call = function (methodName) {
                    var args = [].slice.call(arguments, 1);;
                    if (!true) {
                        if (canEvaluate) {
                            var maybeCaller = getMethodCaller(methodName);
                            if (maybeCaller !== null) {
                                return this._then(
                                    maybeCaller, undefined, undefined, args, undefined);
                            }
                        }
                    }
                    args.push(methodName);
                    return this._then(caller, undefined, undefined, args, undefined);
                };

                function namedGetter(obj) {
                    return obj[this];
                }
                function indexedGetter(obj) {
                    var index = +this;
                    if (index < 0) index = Math.max(0, index + obj.length);
                    return obj[index];
                }
                Promise.prototype.get = function (propertyName) {
                    var isIndex = (typeof propertyName === "number");
                    var getter;
                    if (!isIndex) {
                        if (canEvaluate) {
                            var maybeGetter = getGetter(propertyName);
                            getter = maybeGetter !== null ? maybeGetter : namedGetter;
                        } else {
                            getter = namedGetter;
                        }
                    } else {
                        getter = indexedGetter;
                    }
                    return this._then(getter, undefined, undefined, propertyName, undefined);
                };
            };

        },{"./util":36}],6:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, PromiseArray, apiRejection, debug) {
                var util = _dereq_("./util");
                var tryCatch = util.tryCatch;
                var errorObj = util.errorObj;
                var async = Promise._async;

                Promise.prototype["break"] = Promise.prototype.cancel = function() {
                    if (!debug.cancellation()) return this._warn("cancellation is disabled");

                    var promise = this;
                    var child = promise;
                    while (promise._isCancellable()) {
                        if (!promise._cancelBy(child)) {
                            if (child._isFollowing()) {
                                child._followee().cancel();
                            } else {
                                child._cancelBranched();
                            }
                            break;
                        }

                        var parent = promise._cancellationParent;
                        if (parent == null || !parent._isCancellable()) {
                            if (promise._isFollowing()) {
                                promise._followee().cancel();
                            } else {
                                promise._cancelBranched();
                            }
                            break;
                        } else {
                            if (promise._isFollowing()) promise._followee().cancel();
                            promise._setWillBeCancelled();
                            child = promise;
                            promise = parent;
                        }
                    }
                };

                Promise.prototype._branchHasCancelled = function() {
                    this._branchesRemainingToCancel--;
                };

                Promise.prototype._enoughBranchesHaveCancelled = function() {
                    return this._branchesRemainingToCancel === undefined ||
                        this._branchesRemainingToCancel <= 0;
                };

                Promise.prototype._cancelBy = function(canceller) {
                    if (canceller === this) {
                        this._branchesRemainingToCancel = 0;
                        this._invokeOnCancel();
                        return true;
                    } else {
                        this._branchHasCancelled();
                        if (this._enoughBranchesHaveCancelled()) {
                            this._invokeOnCancel();
                            return true;
                        }
                    }
                    return false;
                };

                Promise.prototype._cancelBranched = function() {
                    if (this._enoughBranchesHaveCancelled()) {
                        this._cancel();
                    }
                };

                Promise.prototype._cancel = function() {
                    if (!this._isCancellable()) return;
                    this._setCancelled();
                    async.invoke(this._cancelPromises, this, undefined);
                };

                Promise.prototype._cancelPromises = function() {
                    if (this._length() > 0) this._settlePromises();
                };

                Promise.prototype._unsetOnCancel = function() {
                    this._onCancelField = undefined;
                };

                Promise.prototype._isCancellable = function() {
                    return this.isPending() && !this._isCancelled();
                };

                Promise.prototype.isCancellable = function() {
                    return this.isPending() && !this.isCancelled();
                };

                Promise.prototype._doInvokeOnCancel = function(onCancelCallback, internalOnly) {
                    if (util.isArray(onCancelCallback)) {
                        for (var i = 0; i < onCancelCallback.length; ++i) {
                            this._doInvokeOnCancel(onCancelCallback[i], internalOnly);
                        }
                    } else if (onCancelCallback !== undefined) {
                        if (typeof onCancelCallback === "function") {
                            if (!internalOnly) {
                                var e = tryCatch(onCancelCallback).call(this._boundValue());
                                if (e === errorObj) {
                                    this._attachExtraTrace(e.e);
                                    async.throwLater(e.e);
                                }
                            }
                        } else {
                            onCancelCallback._resultCancelled(this);
                        }
                    }
                };

                Promise.prototype._invokeOnCancel = function() {
                    var onCancelCallback = this._onCancel();
                    this._unsetOnCancel();
                    async.invoke(this._doInvokeOnCancel, this, onCancelCallback);
                };

                Promise.prototype._invokeInternalOnCancel = function() {
                    if (this._isCancellable()) {
                        this._doInvokeOnCancel(this._onCancel(), true);
                        this._unsetOnCancel();
                    }
                };

                Promise.prototype._resultCancelled = function() {
                    this.cancel();
                };

            };

        },{"./util":36}],7:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(NEXT_FILTER) {
                var util = _dereq_("./util");
                var getKeys = _dereq_("./es5").keys;
                var tryCatch = util.tryCatch;
                var errorObj = util.errorObj;

                function catchFilter(instances, cb, promise) {
                    return function(e) {
                        var boundTo = promise._boundValue();
                        predicateLoop: for (var i = 0; i < instances.length; ++i) {
                            var item = instances[i];

                            if (item === Error ||
                                (item != null && item.prototype instanceof Error)) {
                                if (e instanceof item) {
                                    return tryCatch(cb).call(boundTo, e);
                                }
                            } else if (typeof item === "function") {
                                var matchesPredicate = tryCatch(item).call(boundTo, e);
                                if (matchesPredicate === errorObj) {
                                    return matchesPredicate;
                                } else if (matchesPredicate) {
                                    return tryCatch(cb).call(boundTo, e);
                                }
                            } else if (util.isObject(e)) {
                                var keys = getKeys(item);
                                for (var j = 0; j < keys.length; ++j) {
                                    var key = keys[j];
                                    if (item[key] != e[key]) {
                                        continue predicateLoop;
                                    }
                                }
                                return tryCatch(cb).call(boundTo, e);
                            }
                        }
                        return NEXT_FILTER;
                    };
                }

                return catchFilter;
            };

        },{"./es5":13,"./util":36}],8:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise) {
                var longStackTraces = false;
                var contextStack = [];

                Promise.prototype._promiseCreated = function() {};
                Promise.prototype._pushContext = function() {};
                Promise.prototype._popContext = function() {return null;};
                Promise._peekContext = Promise.prototype._peekContext = function() {};

                function Context() {
                    this._trace = new Context.CapturedTrace(peekContext());
                }
                Context.prototype._pushContext = function () {
                    if (this._trace !== undefined) {
                        this._trace._promiseCreated = null;
                        contextStack.push(this._trace);
                    }
                };

                Context.prototype._popContext = function () {
                    if (this._trace !== undefined) {
                        var trace = contextStack.pop();
                        var ret = trace._promiseCreated;
                        trace._promiseCreated = null;
                        return ret;
                    }
                    return null;
                };

                function createContext() {
                    if (longStackTraces) return new Context();
                }

                function peekContext() {
                    var lastIndex = contextStack.length - 1;
                    if (lastIndex >= 0) {
                        return contextStack[lastIndex];
                    }
                    return undefined;
                }
                Context.CapturedTrace = null;
                Context.create = createContext;
                Context.deactivateLongStackTraces = function() {};
                Context.activateLongStackTraces = function() {
                    var Promise_pushContext = Promise.prototype._pushContext;
                    var Promise_popContext = Promise.prototype._popContext;
                    var Promise_PeekContext = Promise._peekContext;
                    var Promise_peekContext = Promise.prototype._peekContext;
                    var Promise_promiseCreated = Promise.prototype._promiseCreated;
                    Context.deactivateLongStackTraces = function() {
                        Promise.prototype._pushContext = Promise_pushContext;
                        Promise.prototype._popContext = Promise_popContext;
                        Promise._peekContext = Promise_PeekContext;
                        Promise.prototype._peekContext = Promise_peekContext;
                        Promise.prototype._promiseCreated = Promise_promiseCreated;
                        longStackTraces = false;
                    };
                    longStackTraces = true;
                    Promise.prototype._pushContext = Context.prototype._pushContext;
                    Promise.prototype._popContext = Context.prototype._popContext;
                    Promise._peekContext = Promise.prototype._peekContext = peekContext;
                    Promise.prototype._promiseCreated = function() {
                        var ctx = this._peekContext();
                        if (ctx && ctx._promiseCreated == null) ctx._promiseCreated = this;
                    };
                };
                return Context;
            };

        },{}],9:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, Context) {
                var getDomain = Promise._getDomain;
                var async = Promise._async;
                var Warning = _dereq_("./errors").Warning;
                var util = _dereq_("./util");
                var canAttachTrace = util.canAttachTrace;
                var unhandledRejectionHandled;
                var possiblyUnhandledRejection;
                var bluebirdFramePattern =
                    /[\\\/]bluebird[\\\/]js[\\\/](release|debug|instrumented)/;
                var nodeFramePattern = /\((?:timers\.js):\d+:\d+\)/;
                var parseLinePattern = /[\/<\(](.+?):(\d+):(\d+)\)?\s*$/;
                var stackFramePattern = null;
                var formatStack = null;
                var indentStackFrames = false;
                var printWarning;
                var debugging = !!(util.env("BLUEBIRD_DEBUG") != 0 &&
                (true ||
                util.env("BLUEBIRD_DEBUG") ||
                util.env("NODE_ENV") === "development"));

                var warnings = !!(util.env("BLUEBIRD_WARNINGS") != 0 &&
                (debugging || util.env("BLUEBIRD_WARNINGS")));

                var longStackTraces = !!(util.env("BLUEBIRD_LONG_STACK_TRACES") != 0 &&
                (debugging || util.env("BLUEBIRD_LONG_STACK_TRACES")));

                var wForgottenReturn = util.env("BLUEBIRD_W_FORGOTTEN_RETURN") != 0 &&
                    (warnings || !!util.env("BLUEBIRD_W_FORGOTTEN_RETURN"));

                Promise.prototype.suppressUnhandledRejections = function() {
                    var target = this._target();
                    target._bitField = ((target._bitField & (~1048576)) |
                    524288);
                };

                Promise.prototype._ensurePossibleRejectionHandled = function () {
                    if ((this._bitField & 524288) !== 0) return;
                    this._setRejectionIsUnhandled();
                    var self = this;
                    setTimeout(function() {
                        self._notifyUnhandledRejection();
                    }, 1);
                };

                Promise.prototype._notifyUnhandledRejectionIsHandled = function () {
                    fireRejectionEvent("rejectionHandled",
                        unhandledRejectionHandled, undefined, this);
                };

                Promise.prototype._setReturnedNonUndefined = function() {
                    this._bitField = this._bitField | 268435456;
                };

                Promise.prototype._returnedNonUndefined = function() {
                    return (this._bitField & 268435456) !== 0;
                };

                Promise.prototype._notifyUnhandledRejection = function () {
                    if (this._isRejectionUnhandled()) {
                        var reason = this._settledValue();
                        this._setUnhandledRejectionIsNotified();
                        fireRejectionEvent("unhandledRejection",
                            possiblyUnhandledRejection, reason, this);
                    }
                };

                Promise.prototype._setUnhandledRejectionIsNotified = function () {
                    this._bitField = this._bitField | 262144;
                };

                Promise.prototype._unsetUnhandledRejectionIsNotified = function () {
                    this._bitField = this._bitField & (~262144);
                };

                Promise.prototype._isUnhandledRejectionNotified = function () {
                    return (this._bitField & 262144) > 0;
                };

                Promise.prototype._setRejectionIsUnhandled = function () {
                    this._bitField = this._bitField | 1048576;
                };

                Promise.prototype._unsetRejectionIsUnhandled = function () {
                    this._bitField = this._bitField & (~1048576);
                    if (this._isUnhandledRejectionNotified()) {
                        this._unsetUnhandledRejectionIsNotified();
                        this._notifyUnhandledRejectionIsHandled();
                    }
                };

                Promise.prototype._isRejectionUnhandled = function () {
                    return (this._bitField & 1048576) > 0;
                };

                Promise.prototype._warn = function(message, shouldUseOwnTrace, promise) {
                    return warn(message, shouldUseOwnTrace, promise || this);
                };

                Promise.onPossiblyUnhandledRejection = function (fn) {
                    var domain = getDomain();
                    possiblyUnhandledRejection =
                        typeof fn === "function" ? (domain === null ?
                            fn : util.domainBind(domain, fn))
                            : undefined;
                };

                Promise.onUnhandledRejectionHandled = function (fn) {
                    var domain = getDomain();
                    unhandledRejectionHandled =
                        typeof fn === "function" ? (domain === null ?
                            fn : util.domainBind(domain, fn))
                            : undefined;
                };

                var disableLongStackTraces = function() {};
                Promise.longStackTraces = function () {
                    if (async.haveItemsQueued() && !config.longStackTraces) {
                        throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    }
                    if (!config.longStackTraces && longStackTracesIsSupported()) {
                        var Promise_captureStackTrace = Promise.prototype._captureStackTrace;
                        var Promise_attachExtraTrace = Promise.prototype._attachExtraTrace;
                        config.longStackTraces = true;
                        disableLongStackTraces = function() {
                            if (async.haveItemsQueued() && !config.longStackTraces) {
                                throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                            }
                            Promise.prototype._captureStackTrace = Promise_captureStackTrace;
                            Promise.prototype._attachExtraTrace = Promise_attachExtraTrace;
                            Context.deactivateLongStackTraces();
                            async.enableTrampoline();
                            config.longStackTraces = false;
                        };
                        Promise.prototype._captureStackTrace = longStackTracesCaptureStackTrace;
                        Promise.prototype._attachExtraTrace = longStackTracesAttachExtraTrace;
                        Context.activateLongStackTraces();
                        async.disableTrampolineIfNecessary();
                    }
                };

                Promise.hasLongStackTraces = function () {
                    return config.longStackTraces && longStackTracesIsSupported();
                };

                var fireDomEvent = (function() {
                    try {
                        if (typeof CustomEvent === "function") {
                            var event = new CustomEvent("CustomEvent");
                            util.global.dispatchEvent(event);
                            return function(name, event) {
                                var domEvent = new CustomEvent(name.toLowerCase(), {
                                    detail: event,
                                    cancelable: true
                                });
                                return !util.global.dispatchEvent(domEvent);
                            };
                        } else if (typeof Event === "function") {
                            var event = new Event("CustomEvent");
                            util.global.dispatchEvent(event);
                            return function(name, event) {
                                var domEvent = new Event(name.toLowerCase(), {
                                    cancelable: true
                                });
                                domEvent.detail = event;
                                return !util.global.dispatchEvent(domEvent);
                            };
                        } else {
                            var event = document.createEvent("CustomEvent");
                            event.initCustomEvent("testingtheevent", false, true, {});
                            util.global.dispatchEvent(event);
                            return function(name, event) {
                                var domEvent = document.createEvent("CustomEvent");
                                domEvent.initCustomEvent(name.toLowerCase(), false, true,
                                    event);
                                return !util.global.dispatchEvent(domEvent);
                            };
                        }
                    } catch (e) {}
                    return function() {
                        return false;
                    };
                })();

                var fireGlobalEvent = (function() {
                    if (util.isNode) {
                        return function() {
                            return process.emit.apply(process, arguments);
                        };
                    } else {
                        if (!util.global) {
                            return function() {
                                return false;
                            };
                        }
                        return function(name) {
                            var methodName = "on" + name.toLowerCase();
                            var method = util.global[methodName];
                            if (!method) return false;
                            method.apply(util.global, [].slice.call(arguments, 1));
                            return true;
                        };
                    }
                })();

                function generatePromiseLifecycleEventObject(name, promise) {
                    return {promise: promise};
                }

                var eventToObjectGenerator = {
                    promiseCreated: generatePromiseLifecycleEventObject,
                    promiseFulfilled: generatePromiseLifecycleEventObject,
                    promiseRejected: generatePromiseLifecycleEventObject,
                    promiseResolved: generatePromiseLifecycleEventObject,
                    promiseCancelled: generatePromiseLifecycleEventObject,
                    promiseChained: function(name, promise, child) {
                        return {promise: promise, child: child};
                    },
                    warning: function(name, warning) {
                        return {warning: warning};
                    },
                    unhandledRejection: function (name, reason, promise) {
                        return {reason: reason, promise: promise};
                    },
                    rejectionHandled: generatePromiseLifecycleEventObject
                };

                var activeFireEvent = function (name) {
                    var globalEventFired = false;
                    try {
                        globalEventFired = fireGlobalEvent.apply(null, arguments);
                    } catch (e) {
                        async.throwLater(e);
                        globalEventFired = true;
                    }

                    var domEventFired = false;
                    try {
                        domEventFired = fireDomEvent(name,
                            eventToObjectGenerator[name].apply(null, arguments));
                    } catch (e) {
                        async.throwLater(e);
                        domEventFired = true;
                    }

                    return domEventFired || globalEventFired;
                };

                Promise.config = function(opts) {
                    opts = Object(opts);
                    if ("longStackTraces" in opts) {
                        if (opts.longStackTraces) {
                            Promise.longStackTraces();
                        } else if (!opts.longStackTraces && Promise.hasLongStackTraces()) {
                            disableLongStackTraces();
                        }
                    }
                    if ("warnings" in opts) {
                        var warningsOption = opts.warnings;
                        config.warnings = !!warningsOption;
                        wForgottenReturn = config.warnings;

                        if (util.isObject(warningsOption)) {
                            if ("wForgottenReturn" in warningsOption) {
                                wForgottenReturn = !!warningsOption.wForgottenReturn;
                            }
                        }
                    }
                    if ("cancellation" in opts && opts.cancellation && !config.cancellation) {
                        if (async.haveItemsQueued()) {
                            throw new Error(
                                "cannot enable cancellation after promises are in use");
                        }
                        Promise.prototype._clearCancellationData =
                            cancellationClearCancellationData;
                        Promise.prototype._propagateFrom = cancellationPropagateFrom;
                        Promise.prototype._onCancel = cancellationOnCancel;
                        Promise.prototype._setOnCancel = cancellationSetOnCancel;
                        Promise.prototype._attachCancellationCallback =
                            cancellationAttachCancellationCallback;
                        Promise.prototype._execute = cancellationExecute;
                        propagateFromFunction = cancellationPropagateFrom;
                        config.cancellation = true;
                    }
                    if ("monitoring" in opts) {
                        if (opts.monitoring && !config.monitoring) {
                            config.monitoring = true;
                            Promise.prototype._fireEvent = activeFireEvent;
                        } else if (!opts.monitoring && config.monitoring) {
                            config.monitoring = false;
                            Promise.prototype._fireEvent = defaultFireEvent;
                        }
                    }
                    return Promise;
                };

                function defaultFireEvent() { return false; }

                Promise.prototype._fireEvent = defaultFireEvent;
                Promise.prototype._execute = function(executor, resolve, reject) {
                    try {
                        executor(resolve, reject);
                    } catch (e) {
                        return e;
                    }
                };
                Promise.prototype._onCancel = function () {};
                Promise.prototype._setOnCancel = function (handler) { ; };
                Promise.prototype._attachCancellationCallback = function(onCancel) {
                    ;
                };
                Promise.prototype._captureStackTrace = function () {};
                Promise.prototype._attachExtraTrace = function () {};
                Promise.prototype._clearCancellationData = function() {};
                Promise.prototype._propagateFrom = function (parent, flags) {
                    ;
                    ;
                };

                function cancellationExecute(executor, resolve, reject) {
                    var promise = this;
                    try {
                        executor(resolve, reject, function(onCancel) {
                            if (typeof onCancel !== "function") {
                                throw new TypeError("onCancel must be a function, got: " +
                                    util.toString(onCancel));
                            }
                            promise._attachCancellationCallback(onCancel);
                        });
                    } catch (e) {
                        return e;
                    }
                }

                function cancellationAttachCancellationCallback(onCancel) {
                    if (!this._isCancellable()) return this;

                    var previousOnCancel = this._onCancel();
                    if (previousOnCancel !== undefined) {
                        if (util.isArray(previousOnCancel)) {
                            previousOnCancel.push(onCancel);
                        } else {
                            this._setOnCancel([previousOnCancel, onCancel]);
                        }
                    } else {
                        this._setOnCancel(onCancel);
                    }
                }

                function cancellationOnCancel() {
                    return this._onCancelField;
                }

                function cancellationSetOnCancel(onCancel) {
                    this._onCancelField = onCancel;
                }

                function cancellationClearCancellationData() {
                    this._cancellationParent = undefined;
                    this._onCancelField = undefined;
                }

                function cancellationPropagateFrom(parent, flags) {
                    if ((flags & 1) !== 0) {
                        this._cancellationParent = parent;
                        var branchesRemainingToCancel = parent._branchesRemainingToCancel;
                        if (branchesRemainingToCancel === undefined) {
                            branchesRemainingToCancel = 0;
                        }
                        parent._branchesRemainingToCancel = branchesRemainingToCancel + 1;
                    }
                    if ((flags & 2) !== 0 && parent._isBound()) {
                        this._setBoundTo(parent._boundTo);
                    }
                }

                function bindingPropagateFrom(parent, flags) {
                    if ((flags & 2) !== 0 && parent._isBound()) {
                        this._setBoundTo(parent._boundTo);
                    }
                }
                var propagateFromFunction = bindingPropagateFrom;

                function boundValueFunction() {
                    var ret = this._boundTo;
                    if (ret !== undefined) {
                        if (ret instanceof Promise) {
                            if (ret.isFulfilled()) {
                                return ret.value();
                            } else {
                                return undefined;
                            }
                        }
                    }
                    return ret;
                }

                function longStackTracesCaptureStackTrace() {
                    this._trace = new CapturedTrace(this._peekContext());
                }

                function longStackTracesAttachExtraTrace(error, ignoreSelf) {
                    if (canAttachTrace(error)) {
                        var trace = this._trace;
                        if (trace !== undefined) {
                            if (ignoreSelf) trace = trace._parent;
                        }
                        if (trace !== undefined) {
                            trace.attachExtraTrace(error);
                        } else if (!error.__stackCleaned__) {
                            var parsed = parseStackAndMessage(error);
                            util.notEnumerableProp(error, "stack",
                                parsed.message + "\n" + parsed.stack.join("\n"));
                            util.notEnumerableProp(error, "__stackCleaned__", true);
                        }
                    }
                }

                function checkForgottenReturns(returnValue, promiseCreated, name, promise,
                                               parent) {
                    if (returnValue === undefined && promiseCreated !== null &&
                        wForgottenReturn) {
                        if (parent !== undefined && parent._returnedNonUndefined()) return;
                        if ((promise._bitField & 65535) === 0) return;

                        if (name) name = name + " ";
                        var handlerLine = "";
                        var creatorLine = "";
                        if (promiseCreated._trace) {
                            var traceLines = promiseCreated._trace.stack.split("\n");
                            var stack = cleanStack(traceLines);
                            for (var i = stack.length - 1; i >= 0; --i) {
                                var line = stack[i];
                                if (!nodeFramePattern.test(line)) {
                                    var lineMatches = line.match(parseLinePattern);
                                    if (lineMatches) {
                                        handlerLine  = "at " + lineMatches[1] +
                                            ":" + lineMatches[2] + ":" + lineMatches[3] + " ";
                                    }
                                    break;
                                }
                            }

                            if (stack.length > 0) {
                                var firstUserLine = stack[0];
                                for (var i = 0; i < traceLines.length; ++i) {

                                    if (traceLines[i] === firstUserLine) {
                                        if (i > 0) {
                                            creatorLine = "\n" + traceLines[i - 1];
                                        }
                                        break;
                                    }
                                }

                            }
                        }
                        var msg = "a promise was created in a " + name +
                            "handler " + handlerLine + "but was not returned from it, " +
                            "see http://goo.gl/rRqMUw" +
                            creatorLine;
                        promise._warn(msg, true, promiseCreated);
                    }
                }

                function deprecated(name, replacement) {
                    var message = name +
                        " is deprecated and will be removed in a future version.";
                    if (replacement) message += " Use " + replacement + " instead.";
                    return warn(message);
                }

                function warn(message, shouldUseOwnTrace, promise) {
                    if (!config.warnings) return;
                    var warning = new Warning(message);
                    var ctx;
                    if (shouldUseOwnTrace) {
                        promise._attachExtraTrace(warning);
                    } else if (config.longStackTraces && (ctx = Promise._peekContext())) {
                        ctx.attachExtraTrace(warning);
                    } else {
                        var parsed = parseStackAndMessage(warning);
                        warning.stack = parsed.message + "\n" + parsed.stack.join("\n");
                    }

                    if (!activeFireEvent("warning", warning)) {
                        formatAndLogError(warning, "", true);
                    }
                }

                function reconstructStack(message, stacks) {
                    for (var i = 0; i < stacks.length - 1; ++i) {
                        stacks[i].push("From previous event:");
                        stacks[i] = stacks[i].join("\n");
                    }
                    if (i < stacks.length) {
                        stacks[i] = stacks[i].join("\n");
                    }
                    return message + "\n" + stacks.join("\n");
                }

                function removeDuplicateOrEmptyJumps(stacks) {
                    for (var i = 0; i < stacks.length; ++i) {
                        if (stacks[i].length === 0 ||
                            ((i + 1 < stacks.length) && stacks[i][0] === stacks[i+1][0])) {
                            stacks.splice(i, 1);
                            i--;
                        }
                    }
                }

                function removeCommonRoots(stacks) {
                    var current = stacks[0];
                    for (var i = 1; i < stacks.length; ++i) {
                        var prev = stacks[i];
                        var currentLastIndex = current.length - 1;
                        var currentLastLine = current[currentLastIndex];
                        var commonRootMeetPoint = -1;

                        for (var j = prev.length - 1; j >= 0; --j) {
                            if (prev[j] === currentLastLine) {
                                commonRootMeetPoint = j;
                                break;
                            }
                        }

                        for (var j = commonRootMeetPoint; j >= 0; --j) {
                            var line = prev[j];
                            if (current[currentLastIndex] === line) {
                                current.pop();
                                currentLastIndex--;
                            } else {
                                break;
                            }
                        }
                        current = prev;
                    }
                }

                function cleanStack(stack) {
                    var ret = [];
                    for (var i = 0; i < stack.length; ++i) {
                        var line = stack[i];
                        var isTraceLine = "    (No stack trace)" === line ||
                            stackFramePattern.test(line);
                        var isInternalFrame = isTraceLine && shouldIgnore(line);
                        if (isTraceLine && !isInternalFrame) {
                            if (indentStackFrames && line.charAt(0) !== " ") {
                                line = "    " + line;
                            }
                            ret.push(line);
                        }
                    }
                    return ret;
                }

                function stackFramesAsArray(error) {
                    var stack = error.stack.replace(/\s+$/g, "").split("\n");
                    for (var i = 0; i < stack.length; ++i) {
                        var line = stack[i];
                        if ("    (No stack trace)" === line || stackFramePattern.test(line)) {
                            break;
                        }
                    }
                    if (i > 0 && error.name != "SyntaxError") {
                        stack = stack.slice(i);
                    }
                    return stack;
                }

                function parseStackAndMessage(error) {
                    var stack = error.stack;
                    var message = error.toString();
                    stack = typeof stack === "string" && stack.length > 0
                        ? stackFramesAsArray(error) : ["    (No stack trace)"];
                    return {
                        message: message,
                        stack: error.name == "SyntaxError" ? stack : cleanStack(stack)
                    };
                }

                function formatAndLogError(error, title, isSoft) {
                    if (typeof console !== "undefined") {
                        var message;
                        if (util.isObject(error)) {
                            var stack = error.stack;
                            message = title + formatStack(stack, error);
                        } else {
                            message = title + String(error);
                        }
                        if (typeof printWarning === "function") {
                            printWarning(message, isSoft);
                        } else if (typeof console.log === "function" ||
                            typeof console.log === "object") {
                            console.log(message);
                        }
                    }
                }

                function fireRejectionEvent(name, localHandler, reason, promise) {
                    var localEventFired = false;
                    try {
                        if (typeof localHandler === "function") {
                            localEventFired = true;
                            if (name === "rejectionHandled") {
                                localHandler(promise);
                            } else {
                                localHandler(reason, promise);
                            }
                        }
                    } catch (e) {
                        async.throwLater(e);
                    }

                    if (name === "unhandledRejection") {
                        if (!activeFireEvent(name, reason, promise) && !localEventFired) {
                            formatAndLogError(reason, "Unhandled rejection ");
                        }
                    } else {
                        activeFireEvent(name, promise);
                    }
                }

                function formatNonError(obj) {
                    var str;
                    if (typeof obj === "function") {
                        str = "[function " +
                            (obj.name || "anonymous") +
                            "]";
                    } else {
                        str = obj && typeof obj.toString === "function"
                            ? obj.toString() : util.toString(obj);
                        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
                        if (ruselessToString.test(str)) {
                            try {
                                var newStr = JSON.stringify(obj);
                                str = newStr;
                            }
                            catch(e) {

                            }
                        }
                        if (str.length === 0) {
                            str = "(empty array)";
                        }
                    }
                    return ("(<" + snip(str) + ">, no stack trace)");
                }

                function snip(str) {
                    var maxChars = 41;
                    if (str.length < maxChars) {
                        return str;
                    }
                    return str.substr(0, maxChars - 3) + "...";
                }

                function longStackTracesIsSupported() {
                    return typeof captureStackTrace === "function";
                }

                var shouldIgnore = function() { return false; };
                var parseLineInfoRegex = /[\/<\(]([^:\/]+):(\d+):(?:\d+)\)?\s*$/;
                function parseLineInfo(line) {
                    var matches = line.match(parseLineInfoRegex);
                    if (matches) {
                        return {
                            fileName: matches[1],
                            line: parseInt(matches[2], 10)
                        };
                    }
                }

                function setBounds(firstLineError, lastLineError) {
                    if (!longStackTracesIsSupported()) return;
                    var firstStackLines = firstLineError.stack.split("\n");
                    var lastStackLines = lastLineError.stack.split("\n");
                    var firstIndex = -1;
                    var lastIndex = -1;
                    var firstFileName;
                    var lastFileName;
                    for (var i = 0; i < firstStackLines.length; ++i) {
                        var result = parseLineInfo(firstStackLines[i]);
                        if (result) {
                            firstFileName = result.fileName;
                            firstIndex = result.line;
                            break;
                        }
                    }
                    for (var i = 0; i < lastStackLines.length; ++i) {
                        var result = parseLineInfo(lastStackLines[i]);
                        if (result) {
                            lastFileName = result.fileName;
                            lastIndex = result.line;
                            break;
                        }
                    }
                    if (firstIndex < 0 || lastIndex < 0 || !firstFileName || !lastFileName ||
                        firstFileName !== lastFileName || firstIndex >= lastIndex) {
                        return;
                    }

                    shouldIgnore = function(line) {
                        if (bluebirdFramePattern.test(line)) return true;
                        var info = parseLineInfo(line);
                        if (info) {
                            if (info.fileName === firstFileName &&
                                (firstIndex <= info.line && info.line <= lastIndex)) {
                                return true;
                            }
                        }
                        return false;
                    };
                }

                function CapturedTrace(parent) {
                    this._parent = parent;
                    this._promisesCreated = 0;
                    var length = this._length = 1 + (parent === undefined ? 0 : parent._length);
                    captureStackTrace(this, CapturedTrace);
                    if (length > 32) this.uncycle();
                }
                util.inherits(CapturedTrace, Error);
                Context.CapturedTrace = CapturedTrace;

                CapturedTrace.prototype.uncycle = function() {
                    var length = this._length;
                    if (length < 2) return;
                    var nodes = [];
                    var stackToIndex = {};

                    for (var i = 0, node = this; node !== undefined; ++i) {
                        nodes.push(node);
                        node = node._parent;
                    }
                    length = this._length = i;
                    for (var i = length - 1; i >= 0; --i) {
                        var stack = nodes[i].stack;
                        if (stackToIndex[stack] === undefined) {
                            stackToIndex[stack] = i;
                        }
                    }
                    for (var i = 0; i < length; ++i) {
                        var currentStack = nodes[i].stack;
                        var index = stackToIndex[currentStack];
                        if (index !== undefined && index !== i) {
                            if (index > 0) {
                                nodes[index - 1]._parent = undefined;
                                nodes[index - 1]._length = 1;
                            }
                            nodes[i]._parent = undefined;
                            nodes[i]._length = 1;
                            var cycleEdgeNode = i > 0 ? nodes[i - 1] : this;

                            if (index < length - 1) {
                                cycleEdgeNode._parent = nodes[index + 1];
                                cycleEdgeNode._parent.uncycle();
                                cycleEdgeNode._length =
                                    cycleEdgeNode._parent._length + 1;
                            } else {
                                cycleEdgeNode._parent = undefined;
                                cycleEdgeNode._length = 1;
                            }
                            var currentChildLength = cycleEdgeNode._length + 1;
                            for (var j = i - 2; j >= 0; --j) {
                                nodes[j]._length = currentChildLength;
                                currentChildLength++;
                            }
                            return;
                        }
                    }
                };

                CapturedTrace.prototype.attachExtraTrace = function(error) {
                    if (error.__stackCleaned__) return;
                    this.uncycle();
                    var parsed = parseStackAndMessage(error);
                    var message = parsed.message;
                    var stacks = [parsed.stack];

                    var trace = this;
                    while (trace !== undefined) {
                        stacks.push(cleanStack(trace.stack.split("\n")));
                        trace = trace._parent;
                    }
                    removeCommonRoots(stacks);
                    removeDuplicateOrEmptyJumps(stacks);
                    util.notEnumerableProp(error, "stack", reconstructStack(message, stacks));
                    util.notEnumerableProp(error, "__stackCleaned__", true);
                };

                var captureStackTrace = (function stackDetection() {
                    var v8stackFramePattern = /^\s*at\s*/;
                    var v8stackFormatter = function(stack, error) {
                        if (typeof stack === "string") return stack;

                        if (error.name !== undefined &&
                            error.message !== undefined) {
                            return error.toString();
                        }
                        return formatNonError(error);
                    };

                    if (typeof Error.stackTraceLimit === "number" &&
                        typeof Error.captureStackTrace === "function") {
                        Error.stackTraceLimit += 6;
                        stackFramePattern = v8stackFramePattern;
                        formatStack = v8stackFormatter;
                        var captureStackTrace = Error.captureStackTrace;

                        shouldIgnore = function(line) {
                            return bluebirdFramePattern.test(line);
                        };
                        return function(receiver, ignoreUntil) {
                            Error.stackTraceLimit += 6;
                            captureStackTrace(receiver, ignoreUntil);
                            Error.stackTraceLimit -= 6;
                        };
                    }
                    var err = new Error();

                    if (typeof err.stack === "string" &&
                        err.stack.split("\n")[0].indexOf("stackDetection@") >= 0) {
                        stackFramePattern = /@/;
                        formatStack = v8stackFormatter;
                        indentStackFrames = true;
                        return function captureStackTrace(o) {
                            o.stack = new Error().stack;
                        };
                    }

                    var hasStackAfterThrow;
                    try { throw new Error(); }
                    catch(e) {
                        hasStackAfterThrow = ("stack" in e);
                    }
                    if (!("stack" in err) && hasStackAfterThrow &&
                        typeof Error.stackTraceLimit === "number") {
                        stackFramePattern = v8stackFramePattern;
                        formatStack = v8stackFormatter;
                        return function captureStackTrace(o) {
                            Error.stackTraceLimit += 6;
                            try { throw new Error(); }
                            catch(e) { o.stack = e.stack; }
                            Error.stackTraceLimit -= 6;
                        };
                    }

                    formatStack = function(stack, error) {
                        if (typeof stack === "string") return stack;

                        if ((typeof error === "object" ||
                            typeof error === "function") &&
                            error.name !== undefined &&
                            error.message !== undefined) {
                            return error.toString();
                        }
                        return formatNonError(error);
                    };

                    return null;

                })([]);

                if (typeof console !== "undefined" && typeof console.warn !== "undefined") {
                    printWarning = function (message) {
                        console.warn(message);
                    };
                    if (util.isNode && process.stderr.isTTY) {
                        printWarning = function(message, isSoft) {
                            var color = isSoft ? "\u001b[33m" : "\u001b[31m";
                            console.warn(color + message + "\u001b[0m\n");
                        };
                    } else if (!util.isNode && typeof (new Error().stack) === "string") {
                        printWarning = function(message, isSoft) {
                            console.warn("%c" + message,
                                isSoft ? "color: darkorange" : "color: red");
                        };
                    }
                }

                var config = {
                    warnings: warnings,
                    longStackTraces: false,
                    cancellation: false,
                    monitoring: false
                };

                if (longStackTraces) Promise.longStackTraces();

                return {
                    longStackTraces: function() {
                        return config.longStackTraces;
                    },
                    warnings: function() {
                        return config.warnings;
                    },
                    cancellation: function() {
                        return config.cancellation;
                    },
                    monitoring: function() {
                        return config.monitoring;
                    },
                    propagateFromFunction: function() {
                        return propagateFromFunction;
                    },
                    boundValueFunction: function() {
                        return boundValueFunction;
                    },
                    checkForgottenReturns: checkForgottenReturns,
                    setBounds: setBounds,
                    warn: warn,
                    deprecated: deprecated,
                    CapturedTrace: CapturedTrace,
                    fireDomEvent: fireDomEvent,
                    fireGlobalEvent: fireGlobalEvent
                };
            };

        },{"./errors":12,"./util":36}],10:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise) {
                function returner() {
                    return this.value;
                }
                function thrower() {
                    throw this.reason;
                }

                Promise.prototype["return"] =
                    Promise.prototype.thenReturn = function (value) {
                        if (value instanceof Promise) value.suppressUnhandledRejections();
                        return this._then(
                            returner, undefined, undefined, {value: value}, undefined);
                    };

                Promise.prototype["throw"] =
                    Promise.prototype.thenThrow = function (reason) {
                        return this._then(
                            thrower, undefined, undefined, {reason: reason}, undefined);
                    };

                Promise.prototype.catchThrow = function (reason) {
                    if (arguments.length <= 1) {
                        return this._then(
                            undefined, thrower, undefined, {reason: reason}, undefined);
                    } else {
                        var _reason = arguments[1];
                        var handler = function() {throw _reason;};
                        return this.caught(reason, handler);
                    }
                };

                Promise.prototype.catchReturn = function (value) {
                    if (arguments.length <= 1) {
                        if (value instanceof Promise) value.suppressUnhandledRejections();
                        return this._then(
                            undefined, returner, undefined, {value: value}, undefined);
                    } else {
                        var _value = arguments[1];
                        if (_value instanceof Promise) _value.suppressUnhandledRejections();
                        var handler = function() {return _value;};
                        return this.caught(value, handler);
                    }
                };
            };

        },{}],11:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, INTERNAL) {
                var PromiseReduce = Promise.reduce;
                var PromiseAll = Promise.all;

                function promiseAllThis() {
                    return PromiseAll(this);
                }

                function PromiseMapSeries(promises, fn) {
                    return PromiseReduce(promises, fn, INTERNAL, INTERNAL);
                }

                Promise.prototype.each = function (fn) {
                    return PromiseReduce(this, fn, INTERNAL, 0)
                        ._then(promiseAllThis, undefined, undefined, this, undefined);
                };

                Promise.prototype.mapSeries = function (fn) {
                    return PromiseReduce(this, fn, INTERNAL, INTERNAL);
                };

                Promise.each = function (promises, fn) {
                    return PromiseReduce(promises, fn, INTERNAL, 0)
                        ._then(promiseAllThis, undefined, undefined, promises, undefined);
                };

                Promise.mapSeries = PromiseMapSeries;
            };


        },{}],12:[function(_dereq_,module,exports){
            "use strict";
            var es5 = _dereq_("./es5");
            var Objectfreeze = es5.freeze;
            var util = _dereq_("./util");
            var inherits = util.inherits;
            var notEnumerableProp = util.notEnumerableProp;

            function subError(nameProperty, defaultMessage) {
                function SubError(message) {
                    if (!(this instanceof SubError)) return new SubError(message);
                    notEnumerableProp(this, "message",
                        typeof message === "string" ? message : defaultMessage);
                    notEnumerableProp(this, "name", nameProperty);
                    if (Error.captureStackTrace) {
                        Error.captureStackTrace(this, this.constructor);
                    } else {
                        Error.call(this);
                    }
                }
                inherits(SubError, Error);
                return SubError;
            }

            var _TypeError, _RangeError;
            var Warning = subError("Warning", "warning");
            var CancellationError = subError("CancellationError", "cancellation error");
            var TimeoutError = subError("TimeoutError", "timeout error");
            var AggregateError = subError("AggregateError", "aggregate error");
            try {
                _TypeError = TypeError;
                _RangeError = RangeError;
            } catch(e) {
                _TypeError = subError("TypeError", "type error");
                _RangeError = subError("RangeError", "range error");
            }

            var methods = ("join pop push shift unshift slice filter forEach some " +
            "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

            for (var i = 0; i < methods.length; ++i) {
                if (typeof Array.prototype[methods[i]] === "function") {
                    AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
                }
            }

            es5.defineProperty(AggregateError.prototype, "length", {
                value: 0,
                configurable: false,
                writable: true,
                enumerable: true
            });
            AggregateError.prototype["isOperational"] = true;
            var level = 0;
            AggregateError.prototype.toString = function() {
                var indent = Array(level * 4 + 1).join(" ");
                var ret = "\n" + indent + "AggregateError of:" + "\n";
                level++;
                indent = Array(level * 4 + 1).join(" ");
                for (var i = 0; i < this.length; ++i) {
                    var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
                    var lines = str.split("\n");
                    for (var j = 0; j < lines.length; ++j) {
                        lines[j] = indent + lines[j];
                    }
                    str = lines.join("\n");
                    ret += str + "\n";
                }
                level--;
                return ret;
            };

            function OperationalError(message) {
                if (!(this instanceof OperationalError))
                    return new OperationalError(message);
                notEnumerableProp(this, "name", "OperationalError");
                notEnumerableProp(this, "message", message);
                this.cause = message;
                this["isOperational"] = true;

                if (message instanceof Error) {
                    notEnumerableProp(this, "message", message.message);
                    notEnumerableProp(this, "stack", message.stack);
                } else if (Error.captureStackTrace) {
                    Error.captureStackTrace(this, this.constructor);
                }

            }
            inherits(OperationalError, Error);

            var errorTypes = Error["__BluebirdErrorTypes__"];
            if (!errorTypes) {
                errorTypes = Objectfreeze({
                    CancellationError: CancellationError,
                    TimeoutError: TimeoutError,
                    OperationalError: OperationalError,
                    RejectionError: OperationalError,
                    AggregateError: AggregateError
                });
                es5.defineProperty(Error, "__BluebirdErrorTypes__", {
                    value: errorTypes,
                    writable: false,
                    enumerable: false,
                    configurable: false
                });
            }

            module.exports = {
                Error: Error,
                TypeError: _TypeError,
                RangeError: _RangeError,
                CancellationError: errorTypes.CancellationError,
                OperationalError: errorTypes.OperationalError,
                TimeoutError: errorTypes.TimeoutError,
                AggregateError: errorTypes.AggregateError,
                Warning: Warning
            };

        },{"./es5":13,"./util":36}],13:[function(_dereq_,module,exports){
            var isES5 = (function(){
                "use strict";
                return this === undefined;
            })();

            if (isES5) {
                module.exports = {
                    freeze: Object.freeze,
                    defineProperty: Object.defineProperty,
                    getDescriptor: Object.getOwnPropertyDescriptor,
                    keys: Object.keys,
                    names: Object.getOwnPropertyNames,
                    getPrototypeOf: Object.getPrototypeOf,
                    isArray: Array.isArray,
                    isES5: isES5,
                    propertyIsWritable: function(obj, prop) {
                        var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
                        return !!(!descriptor || descriptor.writable || descriptor.set);
                    }
                };
            } else {
                var has = {}.hasOwnProperty;
                var str = {}.toString;
                var proto = {}.constructor.prototype;

                var ObjectKeys = function (o) {
                    var ret = [];
                    for (var key in o) {
                        if (has.call(o, key)) {
                            ret.push(key);
                        }
                    }
                    return ret;
                };

                var ObjectGetDescriptor = function(o, key) {
                    return {value: o[key]};
                };

                var ObjectDefineProperty = function (o, key, desc) {
                    o[key] = desc.value;
                    return o;
                };

                var ObjectFreeze = function (obj) {
                    return obj;
                };

                var ObjectGetPrototypeOf = function (obj) {
                    try {
                        return Object(obj).constructor.prototype;
                    }
                    catch (e) {
                        return proto;
                    }
                };

                var ArrayIsArray = function (obj) {
                    try {
                        return str.call(obj) === "[object Array]";
                    }
                    catch(e) {
                        return false;
                    }
                };

                module.exports = {
                    isArray: ArrayIsArray,
                    keys: ObjectKeys,
                    names: ObjectKeys,
                    defineProperty: ObjectDefineProperty,
                    getDescriptor: ObjectGetDescriptor,
                    freeze: ObjectFreeze,
                    getPrototypeOf: ObjectGetPrototypeOf,
                    isES5: isES5,
                    propertyIsWritable: function() {
                        return true;
                    }
                };
            }

        },{}],14:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, INTERNAL) {
                var PromiseMap = Promise.map;

                Promise.prototype.filter = function (fn, options) {
                    return PromiseMap(this, fn, options, INTERNAL);
                };

                Promise.filter = function (promises, fn, options) {
                    return PromiseMap(promises, fn, options, INTERNAL);
                };
            };

        },{}],15:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, tryConvertToPromise, NEXT_FILTER) {
                var util = _dereq_("./util");
                var CancellationError = Promise.CancellationError;
                var errorObj = util.errorObj;
                var catchFilter = _dereq_("./catch_filter")(NEXT_FILTER);

                function PassThroughHandlerContext(promise, type, handler) {
                    this.promise = promise;
                    this.type = type;
                    this.handler = handler;
                    this.called = false;
                    this.cancelPromise = null;
                }

                PassThroughHandlerContext.prototype.isFinallyHandler = function() {
                    return this.type === 0;
                };

                function FinallyHandlerCancelReaction(finallyHandler) {
                    this.finallyHandler = finallyHandler;
                }

                FinallyHandlerCancelReaction.prototype._resultCancelled = function() {
                    checkCancel(this.finallyHandler);
                };

                function checkCancel(ctx, reason) {
                    if (ctx.cancelPromise != null) {
                        if (arguments.length > 1) {
                            ctx.cancelPromise._reject(reason);
                        } else {
                            ctx.cancelPromise._cancel();
                        }
                        ctx.cancelPromise = null;
                        return true;
                    }
                    return false;
                }

                function succeed() {
                    return finallyHandler.call(this, this.promise._target()._settledValue());
                }
                function fail(reason) {
                    if (checkCancel(this, reason)) return;
                    errorObj.e = reason;
                    return errorObj;
                }
                function finallyHandler(reasonOrValue) {
                    var promise = this.promise;
                    var handler = this.handler;

                    if (!this.called) {
                        this.called = true;
                        var ret = this.isFinallyHandler()
                            ? handler.call(promise._boundValue())
                            : handler.call(promise._boundValue(), reasonOrValue);
                        if (ret === NEXT_FILTER) {
                            return ret;
                        } else if (ret !== undefined) {
                            promise._setReturnedNonUndefined();
                            var maybePromise = tryConvertToPromise(ret, promise);
                            if (maybePromise instanceof Promise) {
                                if (this.cancelPromise != null) {
                                    if (maybePromise._isCancelled()) {
                                        var reason =
                                            new CancellationError("late cancellation observer");
                                        promise._attachExtraTrace(reason);
                                        errorObj.e = reason;
                                        return errorObj;
                                    } else if (maybePromise.isPending()) {
                                        maybePromise._attachCancellationCallback(
                                            new FinallyHandlerCancelReaction(this));
                                    }
                                }
                                return maybePromise._then(
                                    succeed, fail, undefined, this, undefined);
                            }
                        }
                    }

                    if (promise.isRejected()) {
                        checkCancel(this);
                        errorObj.e = reasonOrValue;
                        return errorObj;
                    } else {
                        checkCancel(this);
                        return reasonOrValue;
                    }
                }

                Promise.prototype._passThrough = function(handler, type, success, fail) {
                    if (typeof handler !== "function") return this.then();
                    return this._then(success,
                        fail,
                        undefined,
                        new PassThroughHandlerContext(this, type, handler),
                        undefined);
                };

                Promise.prototype.lastly =
                    Promise.prototype["finally"] = function (handler) {
                        return this._passThrough(handler,
                            0,
                            finallyHandler,
                            finallyHandler);
                    };


                Promise.prototype.tap = function (handler) {
                    return this._passThrough(handler, 1, finallyHandler);
                };

                Promise.prototype.tapCatch = function (handlerOrPredicate) {
                    var len = arguments.length;
                    if(len === 1) {
                        return this._passThrough(handlerOrPredicate,
                            1,
                            undefined,
                            finallyHandler);
                    } else {
                        var catchInstances = new Array(len - 1),
                            j = 0, i;
                        for (i = 0; i < len - 1; ++i) {
                            var item = arguments[i];
                            if (util.isObject(item)) {
                                catchInstances[j++] = item;
                            } else {
                                return Promise.reject(new TypeError(
                                    "tapCatch statement predicate: "
                                    + "expecting an object but got " + util.classString(item)
                                ));
                            }
                        }
                        catchInstances.length = j;
                        var handler = arguments[i];
                        return this._passThrough(catchFilter(catchInstances, handler, this),
                            1,
                            undefined,
                            finallyHandler);
                    }

                };

                return PassThroughHandlerContext;
            };

        },{"./catch_filter":7,"./util":36}],16:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise,
                                      apiRejection,
                                      INTERNAL,
                                      tryConvertToPromise,
                                      Proxyable,
                                      debug) {
                var errors = _dereq_("./errors");
                var TypeError = errors.TypeError;
                var util = _dereq_("./util");
                var errorObj = util.errorObj;
                var tryCatch = util.tryCatch;
                var yieldHandlers = [];

                function promiseFromYieldHandler(value, yieldHandlers, traceParent) {
                    for (var i = 0; i < yieldHandlers.length; ++i) {
                        traceParent._pushContext();
                        var result = tryCatch(yieldHandlers[i])(value);
                        traceParent._popContext();
                        if (result === errorObj) {
                            traceParent._pushContext();
                            var ret = Promise.reject(errorObj.e);
                            traceParent._popContext();
                            return ret;
                        }
                        var maybePromise = tryConvertToPromise(result, traceParent);
                        if (maybePromise instanceof Promise) return maybePromise;
                    }
                    return null;
                }

                function PromiseSpawn(generatorFunction, receiver, yieldHandler, stack) {
                    if (debug.cancellation()) {
                        var internal = new Promise(INTERNAL);
                        var _finallyPromise = this._finallyPromise = new Promise(INTERNAL);
                        this._promise = internal.lastly(function() {
                            return _finallyPromise;
                        });
                        internal._captureStackTrace();
                        internal._setOnCancel(this);
                    } else {
                        var promise = this._promise = new Promise(INTERNAL);
                        promise._captureStackTrace();
                    }
                    this._stack = stack;
                    this._generatorFunction = generatorFunction;
                    this._receiver = receiver;
                    this._generator = undefined;
                    this._yieldHandlers = typeof yieldHandler === "function"
                        ? [yieldHandler].concat(yieldHandlers)
                        : yieldHandlers;
                    this._yieldedPromise = null;
                    this._cancellationPhase = false;
                }
                util.inherits(PromiseSpawn, Proxyable);

                PromiseSpawn.prototype._isResolved = function() {
                    return this._promise === null;
                };

                PromiseSpawn.prototype._cleanup = function() {
                    this._promise = this._generator = null;
                    if (debug.cancellation() && this._finallyPromise !== null) {
                        this._finallyPromise._fulfill();
                        this._finallyPromise = null;
                    }
                };

                PromiseSpawn.prototype._promiseCancelled = function() {
                    if (this._isResolved()) return;
                    var implementsReturn = typeof this._generator["return"] !== "undefined";

                    var result;
                    if (!implementsReturn) {
                        var reason = new Promise.CancellationError(
                            "generator .return() sentinel");
                        Promise.coroutine.returnSentinel = reason;
                        this._promise._attachExtraTrace(reason);
                        this._promise._pushContext();
                        result = tryCatch(this._generator["throw"]).call(this._generator,
                            reason);
                        this._promise._popContext();
                    } else {
                        this._promise._pushContext();
                        result = tryCatch(this._generator["return"]).call(this._generator,
                            undefined);
                        this._promise._popContext();
                    }
                    this._cancellationPhase = true;
                    this._yieldedPromise = null;
                    this._continue(result);
                };

                PromiseSpawn.prototype._promiseFulfilled = function(value) {
                    this._yieldedPromise = null;
                    this._promise._pushContext();
                    var result = tryCatch(this._generator.next).call(this._generator, value);
                    this._promise._popContext();
                    this._continue(result);
                };

                PromiseSpawn.prototype._promiseRejected = function(reason) {
                    this._yieldedPromise = null;
                    this._promise._attachExtraTrace(reason);
                    this._promise._pushContext();
                    var result = tryCatch(this._generator["throw"])
                        .call(this._generator, reason);
                    this._promise._popContext();
                    this._continue(result);
                };

                PromiseSpawn.prototype._resultCancelled = function() {
                    if (this._yieldedPromise instanceof Promise) {
                        var promise = this._yieldedPromise;
                        this._yieldedPromise = null;
                        promise.cancel();
                    }
                };

                PromiseSpawn.prototype.promise = function () {
                    return this._promise;
                };

                PromiseSpawn.prototype._run = function () {
                    this._generator = this._generatorFunction.call(this._receiver);
                    this._receiver =
                        this._generatorFunction = undefined;
                    this._promiseFulfilled(undefined);
                };

                PromiseSpawn.prototype._continue = function (result) {
                    var promise = this._promise;
                    if (result === errorObj) {
                        this._cleanup();
                        if (this._cancellationPhase) {
                            return promise.cancel();
                        } else {
                            return promise._rejectCallback(result.e, false);
                        }
                    }

                    var value = result.value;
                    if (result.done === true) {
                        this._cleanup();
                        if (this._cancellationPhase) {
                            return promise.cancel();
                        } else {
                            return promise._resolveCallback(value);
                        }
                    } else {
                        var maybePromise = tryConvertToPromise(value, this._promise);
                        if (!(maybePromise instanceof Promise)) {
                            maybePromise =
                                promiseFromYieldHandler(maybePromise,
                                    this._yieldHandlers,
                                    this._promise);
                            if (maybePromise === null) {
                                this._promiseRejected(
                                    new TypeError(
                                        "A value %s was yielded that could not be treated as a promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a\u000a".replace("%s", String(value)) +
                                        "From coroutine:\u000a" +
                                        this._stack.split("\n").slice(1, -7).join("\n")
                                    )
                                );
                                return;
                            }
                        }
                        maybePromise = maybePromise._target();
                        var bitField = maybePromise._bitField;
                        ;
                        if (((bitField & 50397184) === 0)) {
                            this._yieldedPromise = maybePromise;
                            maybePromise._proxy(this, null);
                        } else if (((bitField & 33554432) !== 0)) {
                            Promise._async.invoke(
                                this._promiseFulfilled, this, maybePromise._value()
                            );
                        } else if (((bitField & 16777216) !== 0)) {
                            Promise._async.invoke(
                                this._promiseRejected, this, maybePromise._reason()
                            );
                        } else {
                            this._promiseCancelled();
                        }
                    }
                };

                Promise.coroutine = function (generatorFunction, options) {
                    if (typeof generatorFunction !== "function") {
                        throw new TypeError("generatorFunction must be a function\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    }
                    var yieldHandler = Object(options).yieldHandler;
                    var PromiseSpawn$ = PromiseSpawn;
                    var stack = new Error().stack;
                    return function () {
                        var generator = generatorFunction.apply(this, arguments);
                        var spawn = new PromiseSpawn$(undefined, undefined, yieldHandler,
                            stack);
                        var ret = spawn.promise();
                        spawn._generator = generator;
                        spawn._promiseFulfilled(undefined);
                        return ret;
                    };
                };

                Promise.coroutine.addYieldHandler = function(fn) {
                    if (typeof fn !== "function") {
                        throw new TypeError("expecting a function but got " + util.classString(fn));
                    }
                    yieldHandlers.push(fn);
                };

                Promise.spawn = function (generatorFunction) {
                    debug.deprecated("Promise.spawn()", "Promise.coroutine()");
                    if (typeof generatorFunction !== "function") {
                        return apiRejection("generatorFunction must be a function\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    }
                    var spawn = new PromiseSpawn(generatorFunction, this);
                    var ret = spawn.promise();
                    spawn._run(Promise.spawn);
                    return ret;
                };
            };

        },{"./errors":12,"./util":36}],17:[function(_dereq_,module,exports){
            "use strict";
            module.exports =
                function(Promise, PromiseArray, tryConvertToPromise, INTERNAL, async,
                         getDomain) {
                    var util = _dereq_("./util");
                    var canEvaluate = util.canEvaluate;
                    var tryCatch = util.tryCatch;
                    var errorObj = util.errorObj;
                    var reject;

                    if (!true) {
                        if (canEvaluate) {
                            var thenCallback = function(i) {
                                return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
                            };

                            var promiseSetter = function(i) {
                                return new Function("promise", "holder", "                           \n\
            'use strict';                                                    \n\
            holder.pIndex = promise;                                         \n\
            ".replace(/Index/g, i));
                            };

                            var generateHolderClass = function(total) {
                                var props = new Array(total);
                                for (var i = 0; i < props.length; ++i) {
                                    props[i] = "this.p" + (i+1);
                                }
                                var assignment = props.join(" = ") + " = null;";
                                var cancellationCode= "var promise;\n" + props.map(function(prop) {
                                        return "                                                         \n\
                promise = " + prop + ";                                      \n\
                if (promise instanceof Promise) {                            \n\
                    promise.cancel();                                        \n\
                }                                                            \n\
            ";
                                    }).join("\n");
                                var passedArguments = props.join(", ");
                                var name = "Holder$" + total;


                                var code = "return function(tryCatch, errorObj, Promise, async) {    \n\
            'use strict';                                                    \n\
            function [TheName](fn) {                                         \n\
                [TheProperties]                                              \n\
                this.fn = fn;                                                \n\
                this.asyncNeeded = true;                                     \n\
                this.now = 0;                                                \n\
            }                                                                \n\
                                                                             \n\
            [TheName].prototype._callFunction = function(promise) {          \n\
                promise._pushContext();                                      \n\
                var ret = tryCatch(this.fn)([ThePassedArguments]);           \n\
                promise._popContext();                                       \n\
                if (ret === errorObj) {                                      \n\
                    promise._rejectCallback(ret.e, false);                   \n\
                } else {                                                     \n\
                    promise._resolveCallback(ret);                           \n\
                }                                                            \n\
            };                                                               \n\
                                                                             \n\
            [TheName].prototype.checkFulfillment = function(promise) {       \n\
                var now = ++this.now;                                        \n\
                if (now === [TheTotal]) {                                    \n\
                    if (this.asyncNeeded) {                                  \n\
                        async.invoke(this._callFunction, this, promise);     \n\
                    } else {                                                 \n\
                        this._callFunction(promise);                         \n\
                    }                                                        \n\
                                                                             \n\
                }                                                            \n\
            };                                                               \n\
                                                                             \n\
            [TheName].prototype._resultCancelled = function() {              \n\
                [CancellationCode]                                           \n\
            };                                                               \n\
                                                                             \n\
            return [TheName];                                                \n\
        }(tryCatch, errorObj, Promise, async);                               \n\
        ";

                                code = code.replace(/\[TheName\]/g, name)
                                    .replace(/\[TheTotal\]/g, total)
                                    .replace(/\[ThePassedArguments\]/g, passedArguments)
                                    .replace(/\[TheProperties\]/g, assignment)
                                    .replace(/\[CancellationCode\]/g, cancellationCode);

                                return new Function("tryCatch", "errorObj", "Promise", "async", code)
                                (tryCatch, errorObj, Promise, async);
                            };

                            var holderClasses = [];
                            var thenCallbacks = [];
                            var promiseSetters = [];

                            for (var i = 0; i < 8; ++i) {
                                holderClasses.push(generateHolderClass(i + 1));
                                thenCallbacks.push(thenCallback(i + 1));
                                promiseSetters.push(promiseSetter(i + 1));
                            }

                            reject = function (reason) {
                                this._reject(reason);
                            };
                        }}

                    Promise.join = function () {
                        var last = arguments.length - 1;
                        var fn;
                        if (last > 0 && typeof arguments[last] === "function") {
                            fn = arguments[last];
                            if (!true) {
                                if (last <= 8 && canEvaluate) {
                                    var ret = new Promise(INTERNAL);
                                    ret._captureStackTrace();
                                    var HolderClass = holderClasses[last - 1];
                                    var holder = new HolderClass(fn);
                                    var callbacks = thenCallbacks;

                                    for (var i = 0; i < last; ++i) {
                                        var maybePromise = tryConvertToPromise(arguments[i], ret);
                                        if (maybePromise instanceof Promise) {
                                            maybePromise = maybePromise._target();
                                            var bitField = maybePromise._bitField;
                                            ;
                                            if (((bitField & 50397184) === 0)) {
                                                maybePromise._then(callbacks[i], reject,
                                                    undefined, ret, holder);
                                                promiseSetters[i](maybePromise, holder);
                                                holder.asyncNeeded = false;
                                            } else if (((bitField & 33554432) !== 0)) {
                                                callbacks[i].call(ret,
                                                    maybePromise._value(), holder);
                                            } else if (((bitField & 16777216) !== 0)) {
                                                ret._reject(maybePromise._reason());
                                            } else {
                                                ret._cancel();
                                            }
                                        } else {
                                            callbacks[i].call(ret, maybePromise, holder);
                                        }
                                    }

                                    if (!ret._isFateSealed()) {
                                        if (holder.asyncNeeded) {
                                            var domain = getDomain();
                                            if (domain !== null) {
                                                holder.fn = util.domainBind(domain, holder.fn);
                                            }
                                        }
                                        ret._setAsyncGuaranteed();
                                        ret._setOnCancel(holder);
                                    }
                                    return ret;
                                }
                            }
                        }
                        var args = [].slice.call(arguments);;
                        if (fn) args.pop();
                        var ret = new PromiseArray(args).promise();
                        return fn !== undefined ? ret.spread(fn) : ret;
                    };

                };

        },{"./util":36}],18:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise,
                                      PromiseArray,
                                      apiRejection,
                                      tryConvertToPromise,
                                      INTERNAL,
                                      debug) {
                var getDomain = Promise._getDomain;
                var util = _dereq_("./util");
                var tryCatch = util.tryCatch;
                var errorObj = util.errorObj;
                var async = Promise._async;

                function MappingPromiseArray(promises, fn, limit, _filter) {
                    this.constructor$(promises);
                    this._promise._captureStackTrace();
                    var domain = getDomain();
                    this._callback = domain === null ? fn : util.domainBind(domain, fn);
                    this._preservedValues = _filter === INTERNAL
                        ? new Array(this.length())
                        : null;
                    this._limit = limit;
                    this._inFlight = 0;
                    this._queue = [];
                    async.invoke(this._asyncInit, this, undefined);
                }
                util.inherits(MappingPromiseArray, PromiseArray);

                MappingPromiseArray.prototype._asyncInit = function() {
                    this._init$(undefined, -2);
                };

                MappingPromiseArray.prototype._init = function () {};

                MappingPromiseArray.prototype._promiseFulfilled = function (value, index) {
                    var values = this._values;
                    var length = this.length();
                    var preservedValues = this._preservedValues;
                    var limit = this._limit;

                    if (index < 0) {
                        index = (index * -1) - 1;
                        values[index] = value;
                        if (limit >= 1) {
                            this._inFlight--;
                            this._drainQueue();
                            if (this._isResolved()) return true;
                        }
                    } else {
                        if (limit >= 1 && this._inFlight >= limit) {
                            values[index] = value;
                            this._queue.push(index);
                            return false;
                        }
                        if (preservedValues !== null) preservedValues[index] = value;

                        var promise = this._promise;
                        var callback = this._callback;
                        var receiver = promise._boundValue();
                        promise._pushContext();
                        var ret = tryCatch(callback).call(receiver, value, index, length);
                        var promiseCreated = promise._popContext();
                        debug.checkForgottenReturns(
                            ret,
                            promiseCreated,
                            preservedValues !== null ? "Promise.filter" : "Promise.map",
                            promise
                        );
                        if (ret === errorObj) {
                            this._reject(ret.e);
                            return true;
                        }

                        var maybePromise = tryConvertToPromise(ret, this._promise);
                        if (maybePromise instanceof Promise) {
                            maybePromise = maybePromise._target();
                            var bitField = maybePromise._bitField;
                            ;
                            if (((bitField & 50397184) === 0)) {
                                if (limit >= 1) this._inFlight++;
                                values[index] = maybePromise;
                                maybePromise._proxy(this, (index + 1) * -1);
                                return false;
                            } else if (((bitField & 33554432) !== 0)) {
                                ret = maybePromise._value();
                            } else if (((bitField & 16777216) !== 0)) {
                                this._reject(maybePromise._reason());
                                return true;
                            } else {
                                this._cancel();
                                return true;
                            }
                        }
                        values[index] = ret;
                    }
                    var totalResolved = ++this._totalResolved;
                    if (totalResolved >= length) {
                        if (preservedValues !== null) {
                            this._filter(values, preservedValues);
                        } else {
                            this._resolve(values);
                        }
                        return true;
                    }
                    return false;
                };

                MappingPromiseArray.prototype._drainQueue = function () {
                    var queue = this._queue;
                    var limit = this._limit;
                    var values = this._values;
                    while (queue.length > 0 && this._inFlight < limit) {
                        if (this._isResolved()) return;
                        var index = queue.pop();
                        this._promiseFulfilled(values[index], index);
                    }
                };

                MappingPromiseArray.prototype._filter = function (booleans, values) {
                    var len = values.length;
                    var ret = new Array(len);
                    var j = 0;
                    for (var i = 0; i < len; ++i) {
                        if (booleans[i]) ret[j++] = values[i];
                    }
                    ret.length = j;
                    this._resolve(ret);
                };

                MappingPromiseArray.prototype.preservedValues = function () {
                    return this._preservedValues;
                };

                function map(promises, fn, options, _filter) {
                    if (typeof fn !== "function") {
                        return apiRejection("expecting a function but got " + util.classString(fn));
                    }

                    var limit = 0;
                    if (options !== undefined) {
                        if (typeof options === "object" && options !== null) {
                            if (typeof options.concurrency !== "number") {
                                return Promise.reject(
                                    new TypeError("'concurrency' must be a number but it is " +
                                        util.classString(options.concurrency)));
                            }
                            limit = options.concurrency;
                        } else {
                            return Promise.reject(new TypeError(
                                "options argument must be an object but it is " +
                                util.classString(options)));
                        }
                    }
                    limit = typeof limit === "number" &&
                    isFinite(limit) && limit >= 1 ? limit : 0;
                    return new MappingPromiseArray(promises, fn, limit, _filter).promise();
                }

                Promise.prototype.map = function (fn, options) {
                    return map(this, fn, options, null);
                };

                Promise.map = function (promises, fn, options, _filter) {
                    return map(promises, fn, options, _filter);
                };


            };

        },{"./util":36}],19:[function(_dereq_,module,exports){
            "use strict";
            module.exports =
                function(Promise, INTERNAL, tryConvertToPromise, apiRejection, debug) {
                    var util = _dereq_("./util");
                    var tryCatch = util.tryCatch;

                    Promise.method = function (fn) {
                        if (typeof fn !== "function") {
                            throw new Promise.TypeError("expecting a function but got " + util.classString(fn));
                        }
                        return function () {
                            var ret = new Promise(INTERNAL);
                            ret._captureStackTrace();
                            ret._pushContext();
                            var value = tryCatch(fn).apply(this, arguments);
                            var promiseCreated = ret._popContext();
                            debug.checkForgottenReturns(
                                value, promiseCreated, "Promise.method", ret);
                            ret._resolveFromSyncValue(value);
                            return ret;
                        };
                    };

                    Promise.attempt = Promise["try"] = function (fn) {
                        if (typeof fn !== "function") {
                            return apiRejection("expecting a function but got " + util.classString(fn));
                        }
                        var ret = new Promise(INTERNAL);
                        ret._captureStackTrace();
                        ret._pushContext();
                        var value;
                        if (arguments.length > 1) {
                            debug.deprecated("calling Promise.try with more than 1 argument");
                            var arg = arguments[1];
                            var ctx = arguments[2];
                            value = util.isArray(arg) ? tryCatch(fn).apply(ctx, arg)
                                : tryCatch(fn).call(ctx, arg);
                        } else {
                            value = tryCatch(fn)();
                        }
                        var promiseCreated = ret._popContext();
                        debug.checkForgottenReturns(
                            value, promiseCreated, "Promise.try", ret);
                        ret._resolveFromSyncValue(value);
                        return ret;
                    };

                    Promise.prototype._resolveFromSyncValue = function (value) {
                        if (value === util.errorObj) {
                            this._rejectCallback(value.e, false);
                        } else {
                            this._resolveCallback(value, true);
                        }
                    };
                };

        },{"./util":36}],20:[function(_dereq_,module,exports){
            "use strict";
            var util = _dereq_("./util");
            var maybeWrapAsError = util.maybeWrapAsError;
            var errors = _dereq_("./errors");
            var OperationalError = errors.OperationalError;
            var es5 = _dereq_("./es5");

            function isUntypedError(obj) {
                return obj instanceof Error &&
                    es5.getPrototypeOf(obj) === Error.prototype;
            }

            var rErrorKey = /^(?:name|message|stack|cause)$/;
            function wrapAsOperationalError(obj) {
                var ret;
                if (isUntypedError(obj)) {
                    ret = new OperationalError(obj);
                    ret.name = obj.name;
                    ret.message = obj.message;
                    ret.stack = obj.stack;
                    var keys = es5.keys(obj);
                    for (var i = 0; i < keys.length; ++i) {
                        var key = keys[i];
                        if (!rErrorKey.test(key)) {
                            ret[key] = obj[key];
                        }
                    }
                    return ret;
                }
                util.markAsOriginatingFromRejection(obj);
                return obj;
            }

            function nodebackForPromise(promise, multiArgs) {
                return function(err, value) {
                    if (promise === null) return;
                    if (err) {
                        var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
                        promise._attachExtraTrace(wrapped);
                        promise._reject(wrapped);
                    } else if (!multiArgs) {
                        promise._fulfill(value);
                    } else {
                        var args = [].slice.call(arguments, 1);;
                        promise._fulfill(args);
                    }
                    promise = null;
                };
            }

            module.exports = nodebackForPromise;

        },{"./errors":12,"./es5":13,"./util":36}],21:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise) {
                var util = _dereq_("./util");
                var async = Promise._async;
                var tryCatch = util.tryCatch;
                var errorObj = util.errorObj;

                function spreadAdapter(val, nodeback) {
                    var promise = this;
                    if (!util.isArray(val)) return successAdapter.call(promise, val, nodeback);
                    var ret =
                        tryCatch(nodeback).apply(promise._boundValue(), [null].concat(val));
                    if (ret === errorObj) {
                        async.throwLater(ret.e);
                    }
                }

                function successAdapter(val, nodeback) {
                    var promise = this;
                    var receiver = promise._boundValue();
                    var ret = val === undefined
                        ? tryCatch(nodeback).call(receiver, null)
                        : tryCatch(nodeback).call(receiver, null, val);
                    if (ret === errorObj) {
                        async.throwLater(ret.e);
                    }
                }
                function errorAdapter(reason, nodeback) {
                    var promise = this;
                    if (!reason) {
                        var newReason = new Error(reason + "");
                        newReason.cause = reason;
                        reason = newReason;
                    }
                    var ret = tryCatch(nodeback).call(promise._boundValue(), reason);
                    if (ret === errorObj) {
                        async.throwLater(ret.e);
                    }
                }

                Promise.prototype.asCallback = Promise.prototype.nodeify = function (nodeback,
                                                                                     options) {
                    if (typeof nodeback == "function") {
                        var adapter = successAdapter;
                        if (options !== undefined && Object(options).spread) {
                            adapter = spreadAdapter;
                        }
                        this._then(
                            adapter,
                            errorAdapter,
                            undefined,
                            this,
                            nodeback
                        );
                    }
                    return this;
                };
            };

        },{"./util":36}],22:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function() {
                var makeSelfResolutionError = function () {
                    return new TypeError("circular promise resolution chain\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                };
                var reflectHandler = function() {
                    return new Promise.PromiseInspection(this._target());
                };
                var apiRejection = function(msg) {
                    return Promise.reject(new TypeError(msg));
                };
                function Proxyable() {}
                var UNDEFINED_BINDING = {};
                var util = _dereq_("./util");

                var getDomain;
                if (util.isNode) {
                    getDomain = function() {
                        var ret = process.domain;
                        if (ret === undefined) ret = null;
                        return ret;
                    };
                } else {
                    getDomain = function() {
                        return null;
                    };
                }
                util.notEnumerableProp(Promise, "_getDomain", getDomain);

                var es5 = _dereq_("./es5");
                var Async = _dereq_("./async");
                var async = new Async();
                es5.defineProperty(Promise, "_async", {value: async});
                var errors = _dereq_("./errors");
                var TypeError = Promise.TypeError = errors.TypeError;
                Promise.RangeError = errors.RangeError;
                var CancellationError = Promise.CancellationError = errors.CancellationError;
                Promise.TimeoutError = errors.TimeoutError;
                Promise.OperationalError = errors.OperationalError;
                Promise.RejectionError = errors.OperationalError;
                Promise.AggregateError = errors.AggregateError;
                var INTERNAL = function(){};
                var APPLY = {};
                var NEXT_FILTER = {};
                var tryConvertToPromise = _dereq_("./thenables")(Promise, INTERNAL);
                var PromiseArray =
                    _dereq_("./promise_array")(Promise, INTERNAL,
                        tryConvertToPromise, apiRejection, Proxyable);
                var Context = _dereq_("./context")(Promise);
                /*jshint unused:false*/
                var createContext = Context.create;
                var debug = _dereq_("./debuggability")(Promise, Context);
                var CapturedTrace = debug.CapturedTrace;
                var PassThroughHandlerContext =
                    _dereq_("./finally")(Promise, tryConvertToPromise, NEXT_FILTER);
                var catchFilter = _dereq_("./catch_filter")(NEXT_FILTER);
                var nodebackForPromise = _dereq_("./nodeback");
                var errorObj = util.errorObj;
                var tryCatch = util.tryCatch;
                function check(self, executor) {
                    if (self == null || self.constructor !== Promise) {
                        throw new TypeError("the promise constructor cannot be invoked directly\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    }
                    if (typeof executor !== "function") {
                        throw new TypeError("expecting a function but got " + util.classString(executor));
                    }

                }

                function Promise(executor) {
                    if (executor !== INTERNAL) {
                        check(this, executor);
                    }
                    this._bitField = 0;
                    this._fulfillmentHandler0 = undefined;
                    this._rejectionHandler0 = undefined;
                    this._promise0 = undefined;
                    this._receiver0 = undefined;
                    this._resolveFromExecutor(executor);
                    this._promiseCreated();
                    this._fireEvent("promiseCreated", this);
                }

                Promise.prototype.toString = function () {
                    return "[object Promise]";
                };

                Promise.prototype.caught = Promise.prototype["catch"] = function (fn) {
                    var len = arguments.length;
                    if (len > 1) {
                        var catchInstances = new Array(len - 1),
                            j = 0, i;
                        for (i = 0; i < len - 1; ++i) {
                            var item = arguments[i];
                            if (util.isObject(item)) {
                                catchInstances[j++] = item;
                            } else {
                                return apiRejection("Catch statement predicate: " +
                                    "expecting an object but got " + util.classString(item));
                            }
                        }
                        catchInstances.length = j;
                        fn = arguments[i];
                        return this.then(undefined, catchFilter(catchInstances, fn, this));
                    }
                    return this.then(undefined, fn);
                };

                Promise.prototype.reflect = function () {
                    return this._then(reflectHandler,
                        reflectHandler, undefined, this, undefined);
                };

                Promise.prototype.then = function (didFulfill, didReject) {
                    if (debug.warnings() && arguments.length > 0 &&
                        typeof didFulfill !== "function" &&
                        typeof didReject !== "function") {
                        var msg = ".then() only accepts functions but was passed: " +
                            util.classString(didFulfill);
                        if (arguments.length > 1) {
                            msg += ", " + util.classString(didReject);
                        }
                        this._warn(msg);
                    }
                    return this._then(didFulfill, didReject, undefined, undefined, undefined);
                };

                Promise.prototype.done = function (didFulfill, didReject) {
                    var promise =
                        this._then(didFulfill, didReject, undefined, undefined, undefined);
                    promise._setIsFinal();
                };

                Promise.prototype.spread = function (fn) {
                    if (typeof fn !== "function") {
                        return apiRejection("expecting a function but got " + util.classString(fn));
                    }
                    return this.all()._then(fn, undefined, undefined, APPLY, undefined);
                };

                Promise.prototype.toJSON = function () {
                    var ret = {
                        isFulfilled: false,
                        isRejected: false,
                        fulfillmentValue: undefined,
                        rejectionReason: undefined
                    };
                    if (this.isFulfilled()) {
                        ret.fulfillmentValue = this.value();
                        ret.isFulfilled = true;
                    } else if (this.isRejected()) {
                        ret.rejectionReason = this.reason();
                        ret.isRejected = true;
                    }
                    return ret;
                };

                Promise.prototype.all = function () {
                    if (arguments.length > 0) {
                        this._warn(".all() was passed arguments but it does not take any");
                    }
                    return new PromiseArray(this).promise();
                };

                Promise.prototype.error = function (fn) {
                    return this.caught(util.originatesFromRejection, fn);
                };

                Promise.getNewLibraryCopy = module.exports;

                Promise.is = function (val) {
                    return val instanceof Promise;
                };

                Promise.fromNode = Promise.fromCallback = function(fn) {
                    var ret = new Promise(INTERNAL);
                    ret._captureStackTrace();
                    var multiArgs = arguments.length > 1 ? !!Object(arguments[1]).multiArgs
                        : false;
                    var result = tryCatch(fn)(nodebackForPromise(ret, multiArgs));
                    if (result === errorObj) {
                        ret._rejectCallback(result.e, true);
                    }
                    if (!ret._isFateSealed()) ret._setAsyncGuaranteed();
                    return ret;
                };

                Promise.all = function (promises) {
                    return new PromiseArray(promises).promise();
                };

                Promise.cast = function (obj) {
                    var ret = tryConvertToPromise(obj);
                    if (!(ret instanceof Promise)) {
                        ret = new Promise(INTERNAL);
                        ret._captureStackTrace();
                        ret._setFulfilled();
                        ret._rejectionHandler0 = obj;
                    }
                    return ret;
                };

                Promise.resolve = Promise.fulfilled = Promise.cast;

                Promise.reject = Promise.rejected = function (reason) {
                    var ret = new Promise(INTERNAL);
                    ret._captureStackTrace();
                    ret._rejectCallback(reason, true);
                    return ret;
                };

                Promise.setScheduler = function(fn) {
                    if (typeof fn !== "function") {
                        throw new TypeError("expecting a function but got " + util.classString(fn));
                    }
                    return async.setScheduler(fn);
                };

                Promise.prototype._then = function (
                    didFulfill,
                    didReject,
                    _,    receiver,
                    internalData
                ) {
                    var haveInternalData = internalData !== undefined;
                    var promise = haveInternalData ? internalData : new Promise(INTERNAL);
                    var target = this._target();
                    var bitField = target._bitField;

                    if (!haveInternalData) {
                        promise._propagateFrom(this, 3);
                        promise._captureStackTrace();
                        if (receiver === undefined &&
                            ((this._bitField & 2097152) !== 0)) {
                            if (!((bitField & 50397184) === 0)) {
                                receiver = this._boundValue();
                            } else {
                                receiver = target === this ? undefined : this._boundTo;
                            }
                        }
                        this._fireEvent("promiseChained", this, promise);
                    }

                    var domain = getDomain();
                    if (!((bitField & 50397184) === 0)) {
                        var handler, value, settler = target._settlePromiseCtx;
                        if (((bitField & 33554432) !== 0)) {
                            value = target._rejectionHandler0;
                            handler = didFulfill;
                        } else if (((bitField & 16777216) !== 0)) {
                            value = target._fulfillmentHandler0;
                            handler = didReject;
                            target._unsetRejectionIsUnhandled();
                        } else {
                            settler = target._settlePromiseLateCancellationObserver;
                            value = new CancellationError("late cancellation observer");
                            target._attachExtraTrace(value);
                            handler = didReject;
                        }

                        async.invoke(settler, target, {
                            handler: domain === null ? handler
                                : (typeof handler === "function" &&
                                util.domainBind(domain, handler)),
                            promise: promise,
                            receiver: receiver,
                            value: value
                        });
                    } else {
                        target._addCallbacks(didFulfill, didReject, promise, receiver, domain);
                    }

                    return promise;
                };

                Promise.prototype._length = function () {
                    return this._bitField & 65535;
                };

                Promise.prototype._isFateSealed = function () {
                    return (this._bitField & 117506048) !== 0;
                };

                Promise.prototype._isFollowing = function () {
                    return (this._bitField & 67108864) === 67108864;
                };

                Promise.prototype._setLength = function (len) {
                    this._bitField = (this._bitField & -65536) |
                        (len & 65535);
                };

                Promise.prototype._setFulfilled = function () {
                    this._bitField = this._bitField | 33554432;
                    this._fireEvent("promiseFulfilled", this);
                };

                Promise.prototype._setRejected = function () {
                    this._bitField = this._bitField | 16777216;
                    this._fireEvent("promiseRejected", this);
                };

                Promise.prototype._setFollowing = function () {
                    this._bitField = this._bitField | 67108864;
                    this._fireEvent("promiseResolved", this);
                };

                Promise.prototype._setIsFinal = function () {
                    this._bitField = this._bitField | 4194304;
                };

                Promise.prototype._isFinal = function () {
                    return (this._bitField & 4194304) > 0;
                };

                Promise.prototype._unsetCancelled = function() {
                    this._bitField = this._bitField & (~65536);
                };

                Promise.prototype._setCancelled = function() {
                    this._bitField = this._bitField | 65536;
                    this._fireEvent("promiseCancelled", this);
                };

                Promise.prototype._setWillBeCancelled = function() {
                    this._bitField = this._bitField | 8388608;
                };

                Promise.prototype._setAsyncGuaranteed = function() {
                    if (async.hasCustomScheduler()) return;
                    this._bitField = this._bitField | 134217728;
                };

                Promise.prototype._receiverAt = function (index) {
                    var ret = index === 0 ? this._receiver0 : this[
                    index * 4 - 4 + 3];
                    if (ret === UNDEFINED_BINDING) {
                        return undefined;
                    } else if (ret === undefined && this._isBound()) {
                        return this._boundValue();
                    }
                    return ret;
                };

                Promise.prototype._promiseAt = function (index) {
                    return this[
                    index * 4 - 4 + 2];
                };

                Promise.prototype._fulfillmentHandlerAt = function (index) {
                    return this[
                    index * 4 - 4 + 0];
                };

                Promise.prototype._rejectionHandlerAt = function (index) {
                    return this[
                    index * 4 - 4 + 1];
                };

                Promise.prototype._boundValue = function() {};

                Promise.prototype._migrateCallback0 = function (follower) {
                    var bitField = follower._bitField;
                    var fulfill = follower._fulfillmentHandler0;
                    var reject = follower._rejectionHandler0;
                    var promise = follower._promise0;
                    var receiver = follower._receiverAt(0);
                    if (receiver === undefined) receiver = UNDEFINED_BINDING;
                    this._addCallbacks(fulfill, reject, promise, receiver, null);
                };

                Promise.prototype._migrateCallbackAt = function (follower, index) {
                    var fulfill = follower._fulfillmentHandlerAt(index);
                    var reject = follower._rejectionHandlerAt(index);
                    var promise = follower._promiseAt(index);
                    var receiver = follower._receiverAt(index);
                    if (receiver === undefined) receiver = UNDEFINED_BINDING;
                    this._addCallbacks(fulfill, reject, promise, receiver, null);
                };

                Promise.prototype._addCallbacks = function (
                    fulfill,
                    reject,
                    promise,
                    receiver,
                    domain
                ) {
                    var index = this._length();

                    if (index >= 65535 - 4) {
                        index = 0;
                        this._setLength(0);
                    }

                    if (index === 0) {
                        this._promise0 = promise;
                        this._receiver0 = receiver;
                        if (typeof fulfill === "function") {
                            this._fulfillmentHandler0 =
                                domain === null ? fulfill : util.domainBind(domain, fulfill);
                        }
                        if (typeof reject === "function") {
                            this._rejectionHandler0 =
                                domain === null ? reject : util.domainBind(domain, reject);
                        }
                    } else {
                        var base = index * 4 - 4;
                        this[base + 2] = promise;
                        this[base + 3] = receiver;
                        if (typeof fulfill === "function") {
                            this[base + 0] =
                                domain === null ? fulfill : util.domainBind(domain, fulfill);
                        }
                        if (typeof reject === "function") {
                            this[base + 1] =
                                domain === null ? reject : util.domainBind(domain, reject);
                        }
                    }
                    this._setLength(index + 1);
                    return index;
                };

                Promise.prototype._proxy = function (proxyable, arg) {
                    this._addCallbacks(undefined, undefined, arg, proxyable, null);
                };

                Promise.prototype._resolveCallback = function(value, shouldBind) {
                    if (((this._bitField & 117506048) !== 0)) return;
                    if (value === this)
                        return this._rejectCallback(makeSelfResolutionError(), false);
                    var maybePromise = tryConvertToPromise(value, this);
                    if (!(maybePromise instanceof Promise)) return this._fulfill(value);

                    if (shouldBind) this._propagateFrom(maybePromise, 2);

                    var promise = maybePromise._target();

                    if (promise === this) {
                        this._reject(makeSelfResolutionError());
                        return;
                    }

                    var bitField = promise._bitField;
                    if (((bitField & 50397184) === 0)) {
                        var len = this._length();
                        if (len > 0) promise._migrateCallback0(this);
                        for (var i = 1; i < len; ++i) {
                            promise._migrateCallbackAt(this, i);
                        }
                        this._setFollowing();
                        this._setLength(0);
                        this._setFollowee(promise);
                    } else if (((bitField & 33554432) !== 0)) {
                        this._fulfill(promise._value());
                    } else if (((bitField & 16777216) !== 0)) {
                        this._reject(promise._reason());
                    } else {
                        var reason = new CancellationError("late cancellation observer");
                        promise._attachExtraTrace(reason);
                        this._reject(reason);
                    }
                };

                Promise.prototype._rejectCallback =
                    function(reason, synchronous, ignoreNonErrorWarnings) {
                        var trace = util.ensureErrorObject(reason);
                        var hasStack = trace === reason;
                        if (!hasStack && !ignoreNonErrorWarnings && debug.warnings()) {
                            var message = "a promise was rejected with a non-error: " +
                                util.classString(reason);
                            this._warn(message, true);
                        }
                        this._attachExtraTrace(trace, synchronous ? hasStack : false);
                        this._reject(reason);
                    };

                Promise.prototype._resolveFromExecutor = function (executor) {
                    if (executor === INTERNAL) return;
                    var promise = this;
                    this._captureStackTrace();
                    this._pushContext();
                    var synchronous = true;
                    var r = this._execute(executor, function(value) {
                        promise._resolveCallback(value);
                    }, function (reason) {
                        promise._rejectCallback(reason, synchronous);
                    });
                    synchronous = false;
                    this._popContext();

                    if (r !== undefined) {
                        promise._rejectCallback(r, true);
                    }
                };

                Promise.prototype._settlePromiseFromHandler = function (
                    handler, receiver, value, promise
                ) {
                    var bitField = promise._bitField;
                    if (((bitField & 65536) !== 0)) return;
                    promise._pushContext();
                    var x;
                    if (receiver === APPLY) {
                        if (!value || typeof value.length !== "number") {
                            x = errorObj;
                            x.e = new TypeError("cannot .spread() a non-array: " +
                                util.classString(value));
                        } else {
                            x = tryCatch(handler).apply(this._boundValue(), value);
                        }
                    } else {
                        x = tryCatch(handler).call(receiver, value);
                    }
                    var promiseCreated = promise._popContext();
                    bitField = promise._bitField;
                    if (((bitField & 65536) !== 0)) return;

                    if (x === NEXT_FILTER) {
                        promise._reject(value);
                    } else if (x === errorObj) {
                        promise._rejectCallback(x.e, false);
                    } else {
                        debug.checkForgottenReturns(x, promiseCreated, "",  promise, this);
                        promise._resolveCallback(x);
                    }
                };

                Promise.prototype._target = function() {
                    var ret = this;
                    while (ret._isFollowing()) ret = ret._followee();
                    return ret;
                };

                Promise.prototype._followee = function() {
                    return this._rejectionHandler0;
                };

                Promise.prototype._setFollowee = function(promise) {
                    this._rejectionHandler0 = promise;
                };

                Promise.prototype._settlePromise = function(promise, handler, receiver, value) {
                    var isPromise = promise instanceof Promise;
                    var bitField = this._bitField;
                    var asyncGuaranteed = ((bitField & 134217728) !== 0);
                    if (((bitField & 65536) !== 0)) {
                        if (isPromise) promise._invokeInternalOnCancel();

                        if (receiver instanceof PassThroughHandlerContext &&
                            receiver.isFinallyHandler()) {
                            receiver.cancelPromise = promise;
                            if (tryCatch(handler).call(receiver, value) === errorObj) {
                                promise._reject(errorObj.e);
                            }
                        } else if (handler === reflectHandler) {
                            promise._fulfill(reflectHandler.call(receiver));
                        } else if (receiver instanceof Proxyable) {
                            receiver._promiseCancelled(promise);
                        } else if (isPromise || promise instanceof PromiseArray) {
                            promise._cancel();
                        } else {
                            receiver.cancel();
                        }
                    } else if (typeof handler === "function") {
                        if (!isPromise) {
                            handler.call(receiver, value, promise);
                        } else {
                            if (asyncGuaranteed) promise._setAsyncGuaranteed();
                            this._settlePromiseFromHandler(handler, receiver, value, promise);
                        }
                    } else if (receiver instanceof Proxyable) {
                        if (!receiver._isResolved()) {
                            if (((bitField & 33554432) !== 0)) {
                                receiver._promiseFulfilled(value, promise);
                            } else {
                                receiver._promiseRejected(value, promise);
                            }
                        }
                    } else if (isPromise) {
                        if (asyncGuaranteed) promise._setAsyncGuaranteed();
                        if (((bitField & 33554432) !== 0)) {
                            promise._fulfill(value);
                        } else {
                            promise._reject(value);
                        }
                    }
                };

                Promise.prototype._settlePromiseLateCancellationObserver = function(ctx) {
                    var handler = ctx.handler;
                    var promise = ctx.promise;
                    var receiver = ctx.receiver;
                    var value = ctx.value;
                    if (typeof handler === "function") {
                        if (!(promise instanceof Promise)) {
                            handler.call(receiver, value, promise);
                        } else {
                            this._settlePromiseFromHandler(handler, receiver, value, promise);
                        }
                    } else if (promise instanceof Promise) {
                        promise._reject(value);
                    }
                };

                Promise.prototype._settlePromiseCtx = function(ctx) {
                    this._settlePromise(ctx.promise, ctx.handler, ctx.receiver, ctx.value);
                };

                Promise.prototype._settlePromise0 = function(handler, value, bitField) {
                    var promise = this._promise0;
                    var receiver = this._receiverAt(0);
                    this._promise0 = undefined;
                    this._receiver0 = undefined;
                    this._settlePromise(promise, handler, receiver, value);
                };

                Promise.prototype._clearCallbackDataAtIndex = function(index) {
                    var base = index * 4 - 4;
                    this[base + 2] =
                        this[base + 3] =
                            this[base + 0] =
                                this[base + 1] = undefined;
                };

                Promise.prototype._fulfill = function (value) {
                    var bitField = this._bitField;
                    if (((bitField & 117506048) >>> 16)) return;
                    if (value === this) {
                        var err = makeSelfResolutionError();
                        this._attachExtraTrace(err);
                        return this._reject(err);
                    }
                    this._setFulfilled();
                    this._rejectionHandler0 = value;

                    if ((bitField & 65535) > 0) {
                        if (((bitField & 134217728) !== 0)) {
                            this._settlePromises();
                        } else {
                            async.settlePromises(this);
                        }
                    }
                };

                Promise.prototype._reject = function (reason) {
                    var bitField = this._bitField;
                    if (((bitField & 117506048) >>> 16)) return;
                    this._setRejected();
                    this._fulfillmentHandler0 = reason;

                    if (this._isFinal()) {
                        return async.fatalError(reason, util.isNode);
                    }

                    if ((bitField & 65535) > 0) {
                        async.settlePromises(this);
                    } else {
                        this._ensurePossibleRejectionHandled();
                    }
                };

                Promise.prototype._fulfillPromises = function (len, value) {
                    for (var i = 1; i < len; i++) {
                        var handler = this._fulfillmentHandlerAt(i);
                        var promise = this._promiseAt(i);
                        var receiver = this._receiverAt(i);
                        this._clearCallbackDataAtIndex(i);
                        this._settlePromise(promise, handler, receiver, value);
                    }
                };

                Promise.prototype._rejectPromises = function (len, reason) {
                    for (var i = 1; i < len; i++) {
                        var handler = this._rejectionHandlerAt(i);
                        var promise = this._promiseAt(i);
                        var receiver = this._receiverAt(i);
                        this._clearCallbackDataAtIndex(i);
                        this._settlePromise(promise, handler, receiver, reason);
                    }
                };

                Promise.prototype._settlePromises = function () {
                    var bitField = this._bitField;
                    var len = (bitField & 65535);

                    if (len > 0) {
                        if (((bitField & 16842752) !== 0)) {
                            var reason = this._fulfillmentHandler0;
                            this._settlePromise0(this._rejectionHandler0, reason, bitField);
                            this._rejectPromises(len, reason);
                        } else {
                            var value = this._rejectionHandler0;
                            this._settlePromise0(this._fulfillmentHandler0, value, bitField);
                            this._fulfillPromises(len, value);
                        }
                        this._setLength(0);
                    }
                    this._clearCancellationData();
                };

                Promise.prototype._settledValue = function() {
                    var bitField = this._bitField;
                    if (((bitField & 33554432) !== 0)) {
                        return this._rejectionHandler0;
                    } else if (((bitField & 16777216) !== 0)) {
                        return this._fulfillmentHandler0;
                    }
                };

                function deferResolve(v) {this.promise._resolveCallback(v);}
                function deferReject(v) {this.promise._rejectCallback(v, false);}

                Promise.defer = Promise.pending = function() {
                    debug.deprecated("Promise.defer", "new Promise");
                    var promise = new Promise(INTERNAL);
                    return {
                        promise: promise,
                        resolve: deferResolve,
                        reject: deferReject
                    };
                };

                util.notEnumerableProp(Promise,
                    "_makeSelfResolutionError",
                    makeSelfResolutionError);

                _dereq_("./method")(Promise, INTERNAL, tryConvertToPromise, apiRejection,
                    debug);
                _dereq_("./bind")(Promise, INTERNAL, tryConvertToPromise, debug);
                _dereq_("./cancel")(Promise, PromiseArray, apiRejection, debug);
                _dereq_("./direct_resolve")(Promise);
                _dereq_("./synchronous_inspection")(Promise);
                _dereq_("./join")(
                    Promise, PromiseArray, tryConvertToPromise, INTERNAL, async, getDomain);
                Promise.Promise = Promise;
                Promise.version = "3.5.1";
                _dereq_('./map.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug);
                _dereq_('./call_get.js')(Promise);
                _dereq_('./using.js')(Promise, apiRejection, tryConvertToPromise, createContext, INTERNAL, debug);
                _dereq_('./timers.js')(Promise, INTERNAL, debug);
                _dereq_('./generators.js')(Promise, apiRejection, INTERNAL, tryConvertToPromise, Proxyable, debug);
                _dereq_('./nodeify.js')(Promise);
                _dereq_('./promisify.js')(Promise, INTERNAL);
                _dereq_('./props.js')(Promise, PromiseArray, tryConvertToPromise, apiRejection);
                _dereq_('./race.js')(Promise, INTERNAL, tryConvertToPromise, apiRejection);
                _dereq_('./reduce.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug);
                _dereq_('./settle.js')(Promise, PromiseArray, debug);
                _dereq_('./some.js')(Promise, PromiseArray, apiRejection);
                _dereq_('./filter.js')(Promise, INTERNAL);
                _dereq_('./each.js')(Promise, INTERNAL);
                _dereq_('./any.js')(Promise);

                util.toFastProperties(Promise);
                util.toFastProperties(Promise.prototype);
                function fillTypes(value) {
                    var p = new Promise(INTERNAL);
                    p._fulfillmentHandler0 = value;
                    p._rejectionHandler0 = value;
                    p._promise0 = value;
                    p._receiver0 = value;
                }
                // Complete slack tracking, opt out of field-type tracking and
                // stabilize map
                fillTypes({a: 1});
                fillTypes({b: 2});
                fillTypes({c: 3});
                fillTypes(1);
                fillTypes(function(){});
                fillTypes(undefined);
                fillTypes(false);
                fillTypes(new Promise(INTERNAL));
                debug.setBounds(Async.firstLineError, util.lastLineError);
                return Promise;

            };

        },{"./any.js":1,"./async":2,"./bind":3,"./call_get.js":5,"./cancel":6,"./catch_filter":7,"./context":8,"./debuggability":9,"./direct_resolve":10,"./each.js":11,"./errors":12,"./es5":13,"./filter.js":14,"./finally":15,"./generators.js":16,"./join":17,"./map.js":18,"./method":19,"./nodeback":20,"./nodeify.js":21,"./promise_array":23,"./promisify.js":24,"./props.js":25,"./race.js":27,"./reduce.js":28,"./settle.js":30,"./some.js":31,"./synchronous_inspection":32,"./thenables":33,"./timers.js":34,"./using.js":35,"./util":36}],23:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, INTERNAL, tryConvertToPromise,
                                      apiRejection, Proxyable) {
                var util = _dereq_("./util");
                var isArray = util.isArray;

                function toResolutionValue(val) {
                    switch(val) {
                        case -2: return [];
                        case -3: return {};
                        case -6: return new Map();
                    }
                }

                function PromiseArray(values) {
                    var promise = this._promise = new Promise(INTERNAL);
                    if (values instanceof Promise) {
                        promise._propagateFrom(values, 3);
                    }
                    promise._setOnCancel(this);
                    this._values = values;
                    this._length = 0;
                    this._totalResolved = 0;
                    this._init(undefined, -2);
                }
                util.inherits(PromiseArray, Proxyable);

                PromiseArray.prototype.length = function () {
                    return this._length;
                };

                PromiseArray.prototype.promise = function () {
                    return this._promise;
                };

                PromiseArray.prototype._init = function init(_, resolveValueIfEmpty) {
                    var values = tryConvertToPromise(this._values, this._promise);
                    if (values instanceof Promise) {
                        values = values._target();
                        var bitField = values._bitField;
                        ;
                        this._values = values;

                        if (((bitField & 50397184) === 0)) {
                            this._promise._setAsyncGuaranteed();
                            return values._then(
                                init,
                                this._reject,
                                undefined,
                                this,
                                resolveValueIfEmpty
                            );
                        } else if (((bitField & 33554432) !== 0)) {
                            values = values._value();
                        } else if (((bitField & 16777216) !== 0)) {
                            return this._reject(values._reason());
                        } else {
                            return this._cancel();
                        }
                    }
                    values = util.asArray(values);
                    if (values === null) {
                        var err = apiRejection(
                            "expecting an array or an iterable object but got " + util.classString(values)).reason();
                        this._promise._rejectCallback(err, false);
                        return;
                    }

                    if (values.length === 0) {
                        if (resolveValueIfEmpty === -5) {
                            this._resolveEmptyArray();
                        }
                        else {
                            this._resolve(toResolutionValue(resolveValueIfEmpty));
                        }
                        return;
                    }
                    this._iterate(values);
                };

                PromiseArray.prototype._iterate = function(values) {
                    var len = this.getActualLength(values.length);
                    this._length = len;
                    this._values = this.shouldCopyValues() ? new Array(len) : this._values;
                    var result = this._promise;
                    var isResolved = false;
                    var bitField = null;
                    for (var i = 0; i < len; ++i) {
                        var maybePromise = tryConvertToPromise(values[i], result);

                        if (maybePromise instanceof Promise) {
                            maybePromise = maybePromise._target();
                            bitField = maybePromise._bitField;
                        } else {
                            bitField = null;
                        }

                        if (isResolved) {
                            if (bitField !== null) {
                                maybePromise.suppressUnhandledRejections();
                            }
                        } else if (bitField !== null) {
                            if (((bitField & 50397184) === 0)) {
                                maybePromise._proxy(this, i);
                                this._values[i] = maybePromise;
                            } else if (((bitField & 33554432) !== 0)) {
                                isResolved = this._promiseFulfilled(maybePromise._value(), i);
                            } else if (((bitField & 16777216) !== 0)) {
                                isResolved = this._promiseRejected(maybePromise._reason(), i);
                            } else {
                                isResolved = this._promiseCancelled(i);
                            }
                        } else {
                            isResolved = this._promiseFulfilled(maybePromise, i);
                        }
                    }
                    if (!isResolved) result._setAsyncGuaranteed();
                };

                PromiseArray.prototype._isResolved = function () {
                    return this._values === null;
                };

                PromiseArray.prototype._resolve = function (value) {
                    this._values = null;
                    this._promise._fulfill(value);
                };

                PromiseArray.prototype._cancel = function() {
                    if (this._isResolved() || !this._promise._isCancellable()) return;
                    this._values = null;
                    this._promise._cancel();
                };

                PromiseArray.prototype._reject = function (reason) {
                    this._values = null;
                    this._promise._rejectCallback(reason, false);
                };

                PromiseArray.prototype._promiseFulfilled = function (value, index) {
                    this._values[index] = value;
                    var totalResolved = ++this._totalResolved;
                    if (totalResolved >= this._length) {
                        this._resolve(this._values);
                        return true;
                    }
                    return false;
                };

                PromiseArray.prototype._promiseCancelled = function() {
                    this._cancel();
                    return true;
                };

                PromiseArray.prototype._promiseRejected = function (reason) {
                    this._totalResolved++;
                    this._reject(reason);
                    return true;
                };

                PromiseArray.prototype._resultCancelled = function() {
                    if (this._isResolved()) return;
                    var values = this._values;
                    this._cancel();
                    if (values instanceof Promise) {
                        values.cancel();
                    } else {
                        for (var i = 0; i < values.length; ++i) {
                            if (values[i] instanceof Promise) {
                                values[i].cancel();
                            }
                        }
                    }
                };

                PromiseArray.prototype.shouldCopyValues = function () {
                    return true;
                };

                PromiseArray.prototype.getActualLength = function (len) {
                    return len;
                };

                return PromiseArray;
            };

        },{"./util":36}],24:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, INTERNAL) {
                var THIS = {};
                var util = _dereq_("./util");
                var nodebackForPromise = _dereq_("./nodeback");
                var withAppended = util.withAppended;
                var maybeWrapAsError = util.maybeWrapAsError;
                var canEvaluate = util.canEvaluate;
                var TypeError = _dereq_("./errors").TypeError;
                var defaultSuffix = "Async";
                var defaultPromisified = {__isPromisified__: true};
                var noCopyProps = [
                    "arity",    "length",
                    "name",
                    "arguments",
                    "caller",
                    "callee",
                    "prototype",
                    "__isPromisified__"
                ];
                var noCopyPropsPattern = new RegExp("^(?:" + noCopyProps.join("|") + ")$");

                var defaultFilter = function(name) {
                    return util.isIdentifier(name) &&
                        name.charAt(0) !== "_" &&
                        name !== "constructor";
                };

                function propsFilter(key) {
                    return !noCopyPropsPattern.test(key);
                }

                function isPromisified(fn) {
                    try {
                        return fn.__isPromisified__ === true;
                    }
                    catch (e) {
                        return false;
                    }
                }

                function hasPromisified(obj, key, suffix) {
                    var val = util.getDataPropertyOrDefault(obj, key + suffix,
                        defaultPromisified);
                    return val ? isPromisified(val) : false;
                }
                function checkValid(ret, suffix, suffixRegexp) {
                    for (var i = 0; i < ret.length; i += 2) {
                        var key = ret[i];
                        if (suffixRegexp.test(key)) {
                            var keyWithoutAsyncSuffix = key.replace(suffixRegexp, "");
                            for (var j = 0; j < ret.length; j += 2) {
                                if (ret[j] === keyWithoutAsyncSuffix) {
                                    throw new TypeError("Cannot promisify an API that has normal methods with '%s'-suffix\u000a\u000a    See http://goo.gl/MqrFmX\u000a"
                                        .replace("%s", suffix));
                                }
                            }
                        }
                    }
                }

                function promisifiableMethods(obj, suffix, suffixRegexp, filter) {
                    var keys = util.inheritedDataKeys(obj);
                    var ret = [];
                    for (var i = 0; i < keys.length; ++i) {
                        var key = keys[i];
                        var value = obj[key];
                        var passesDefaultFilter = filter === defaultFilter
                            ? true : defaultFilter(key, value, obj);
                        if (typeof value === "function" &&
                            !isPromisified(value) &&
                            !hasPromisified(obj, key, suffix) &&
                            filter(key, value, obj, passesDefaultFilter)) {
                            ret.push(key, value);
                        }
                    }
                    checkValid(ret, suffix, suffixRegexp);
                    return ret;
                }

                var escapeIdentRegex = function(str) {
                    return str.replace(/([$])/, "\\$");
                };

                var makeNodePromisifiedEval;
                if (!true) {
                    var switchCaseArgumentOrder = function(likelyArgumentCount) {
                        var ret = [likelyArgumentCount];
                        var min = Math.max(0, likelyArgumentCount - 1 - 3);
                        for(var i = likelyArgumentCount - 1; i >= min; --i) {
                            ret.push(i);
                        }
                        for(var i = likelyArgumentCount + 1; i <= 3; ++i) {
                            ret.push(i);
                        }
                        return ret;
                    };

                    var argumentSequence = function(argumentCount) {
                        return util.filledRange(argumentCount, "_arg", "");
                    };

                    var parameterDeclaration = function(parameterCount) {
                        return util.filledRange(
                            Math.max(parameterCount, 3), "_arg", "");
                    };

                    var parameterCount = function(fn) {
                        if (typeof fn.length === "number") {
                            return Math.max(Math.min(fn.length, 1023 + 1), 0);
                        }
                        return 0;
                    };

                    makeNodePromisifiedEval =
                        function(callback, receiver, originalName, fn, _, multiArgs) {
                            var newParameterCount = Math.max(0, parameterCount(fn) - 1);
                            var argumentOrder = switchCaseArgumentOrder(newParameterCount);
                            var shouldProxyThis = typeof callback === "string" || receiver === THIS;

                            function generateCallForArgumentCount(count) {
                                var args = argumentSequence(count).join(", ");
                                var comma = count > 0 ? ", " : "";
                                var ret;
                                if (shouldProxyThis) {
                                    ret = "ret = callback.call(this, {{args}}, nodeback); break;\n";
                                } else {
                                    ret = receiver === undefined
                                        ? "ret = callback({{args}}, nodeback); break;\n"
                                        : "ret = callback.call(receiver, {{args}}, nodeback); break;\n";
                                }
                                return ret.replace("{{args}}", args).replace(", ", comma);
                            }

                            function generateArgumentSwitchCase() {
                                var ret = "";
                                for (var i = 0; i < argumentOrder.length; ++i) {
                                    ret += "case " + argumentOrder[i] +":" +
                                        generateCallForArgumentCount(argumentOrder[i]);
                                }

                                ret += "                                                             \n\
        default:                                                             \n\
            var args = new Array(len + 1);                                   \n\
            var i = 0;                                                       \n\
            for (var i = 0; i < len; ++i) {                                  \n\
               args[i] = arguments[i];                                       \n\
            }                                                                \n\
            args[i] = nodeback;                                              \n\
            [CodeForCall]                                                    \n\
            break;                                                           \n\
        ".replace("[CodeForCall]", (shouldProxyThis
                                    ? "ret = callback.apply(this, args);\n"
                                    : "ret = callback.apply(receiver, args);\n"));
                                return ret;
                            }

                            var getFunctionCode = typeof callback === "string"
                                ? ("this != null ? this['"+callback+"'] : fn")
                                : "fn";
                            var body = "'use strict';                                                \n\
        var ret = function (Parameters) {                                    \n\
            'use strict';                                                    \n\
            var len = arguments.length;                                      \n\
            var promise = new Promise(INTERNAL);                             \n\
            promise._captureStackTrace();                                    \n\
            var nodeback = nodebackForPromise(promise, " + multiArgs + ");   \n\
            var ret;                                                         \n\
            var callback = tryCatch([GetFunctionCode]);                      \n\
            switch(len) {                                                    \n\
                [CodeForSwitchCase]                                          \n\
            }                                                                \n\
            if (ret === errorObj) {                                          \n\
                promise._rejectCallback(maybeWrapAsError(ret.e), true, true);\n\
            }                                                                \n\
            if (!promise._isFateSealed()) promise._setAsyncGuaranteed();     \n\
            return promise;                                                  \n\
        };                                                                   \n\
        notEnumerableProp(ret, '__isPromisified__', true);                   \n\
        return ret;                                                          \n\
    ".replace("[CodeForSwitchCase]", generateArgumentSwitchCase())
                                    .replace("[GetFunctionCode]", getFunctionCode);
                            body = body.replace("Parameters", parameterDeclaration(newParameterCount));
                            return new Function("Promise",
                                "fn",
                                "receiver",
                                "withAppended",
                                "maybeWrapAsError",
                                "nodebackForPromise",
                                "tryCatch",
                                "errorObj",
                                "notEnumerableProp",
                                "INTERNAL",
                                body)(
                                Promise,
                                fn,
                                receiver,
                                withAppended,
                                maybeWrapAsError,
                                nodebackForPromise,
                                util.tryCatch,
                                util.errorObj,
                                util.notEnumerableProp,
                                INTERNAL);
                        };
                }

                function makeNodePromisifiedClosure(callback, receiver, _, fn, __, multiArgs) {
                    var defaultThis = (function() {return this;})();
                    var method = callback;
                    if (typeof method === "string") {
                        callback = fn;
                    }
                    function promisified() {
                        var _receiver = receiver;
                        if (receiver === THIS) _receiver = this;
                        var promise = new Promise(INTERNAL);
                        promise._captureStackTrace();
                        var cb = typeof method === "string" && this !== defaultThis
                            ? this[method] : callback;
                        var fn = nodebackForPromise(promise, multiArgs);
                        try {
                            cb.apply(_receiver, withAppended(arguments, fn));
                        } catch(e) {
                            promise._rejectCallback(maybeWrapAsError(e), true, true);
                        }
                        if (!promise._isFateSealed()) promise._setAsyncGuaranteed();
                        return promise;
                    }
                    util.notEnumerableProp(promisified, "__isPromisified__", true);
                    return promisified;
                }

                var makeNodePromisified = canEvaluate
                    ? makeNodePromisifiedEval
                    : makeNodePromisifiedClosure;

                function promisifyAll(obj, suffix, filter, promisifier, multiArgs) {
                    var suffixRegexp = new RegExp(escapeIdentRegex(suffix) + "$");
                    var methods =
                        promisifiableMethods(obj, suffix, suffixRegexp, filter);

                    for (var i = 0, len = methods.length; i < len; i+= 2) {
                        var key = methods[i];
                        var fn = methods[i+1];
                        var promisifiedKey = key + suffix;
                        if (promisifier === makeNodePromisified) {
                            obj[promisifiedKey] =
                                makeNodePromisified(key, THIS, key, fn, suffix, multiArgs);
                        } else {
                            var promisified = promisifier(fn, function() {
                                return makeNodePromisified(key, THIS, key,
                                    fn, suffix, multiArgs);
                            });
                            util.notEnumerableProp(promisified, "__isPromisified__", true);
                            obj[promisifiedKey] = promisified;
                        }
                    }
                    util.toFastProperties(obj);
                    return obj;
                }

                function promisify(callback, receiver, multiArgs) {
                    return makeNodePromisified(callback, receiver, undefined,
                        callback, null, multiArgs);
                }

                Promise.promisify = function (fn, options) {
                    if (typeof fn !== "function") {
                        throw new TypeError("expecting a function but got " + util.classString(fn));
                    }
                    if (isPromisified(fn)) {
                        return fn;
                    }
                    options = Object(options);
                    var receiver = options.context === undefined ? THIS : options.context;
                    var multiArgs = !!options.multiArgs;
                    var ret = promisify(fn, receiver, multiArgs);
                    util.copyDescriptors(fn, ret, propsFilter);
                    return ret;
                };

                Promise.promisifyAll = function (target, options) {
                    if (typeof target !== "function" && typeof target !== "object") {
                        throw new TypeError("the target of promisifyAll must be an object or a function\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    }
                    options = Object(options);
                    var multiArgs = !!options.multiArgs;
                    var suffix = options.suffix;
                    if (typeof suffix !== "string") suffix = defaultSuffix;
                    var filter = options.filter;
                    if (typeof filter !== "function") filter = defaultFilter;
                    var promisifier = options.promisifier;
                    if (typeof promisifier !== "function") promisifier = makeNodePromisified;

                    if (!util.isIdentifier(suffix)) {
                        throw new RangeError("suffix must be a valid identifier\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    }

                    var keys = util.inheritedDataKeys(target);
                    for (var i = 0; i < keys.length; ++i) {
                        var value = target[keys[i]];
                        if (keys[i] !== "constructor" &&
                            util.isClass(value)) {
                            promisifyAll(value.prototype, suffix, filter, promisifier,
                                multiArgs);
                            promisifyAll(value, suffix, filter, promisifier, multiArgs);
                        }
                    }

                    return promisifyAll(target, suffix, filter, promisifier, multiArgs);
                };
            };


        },{"./errors":12,"./nodeback":20,"./util":36}],25:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(
                Promise, PromiseArray, tryConvertToPromise, apiRejection) {
                var util = _dereq_("./util");
                var isObject = util.isObject;
                var es5 = _dereq_("./es5");
                var Es6Map;
                if (typeof Map === "function") Es6Map = Map;

                var mapToEntries = (function() {
                    var index = 0;
                    var size = 0;

                    function extractEntry(value, key) {
                        this[index] = value;
                        this[index + size] = key;
                        index++;
                    }

                    return function mapToEntries(map) {
                        size = map.size;
                        index = 0;
                        var ret = new Array(map.size * 2);
                        map.forEach(extractEntry, ret);
                        return ret;
                    };
                })();

                var entriesToMap = function(entries) {
                    var ret = new Es6Map();
                    var length = entries.length / 2 | 0;
                    for (var i = 0; i < length; ++i) {
                        var key = entries[length + i];
                        var value = entries[i];
                        ret.set(key, value);
                    }
                    return ret;
                };

                function PropertiesPromiseArray(obj) {
                    var isMap = false;
                    var entries;
                    if (Es6Map !== undefined && obj instanceof Es6Map) {
                        entries = mapToEntries(obj);
                        isMap = true;
                    } else {
                        var keys = es5.keys(obj);
                        var len = keys.length;
                        entries = new Array(len * 2);
                        for (var i = 0; i < len; ++i) {
                            var key = keys[i];
                            entries[i] = obj[key];
                            entries[i + len] = key;
                        }
                    }
                    this.constructor$(entries);
                    this._isMap = isMap;
                    this._init$(undefined, isMap ? -6 : -3);
                }
                util.inherits(PropertiesPromiseArray, PromiseArray);

                PropertiesPromiseArray.prototype._init = function () {};

                PropertiesPromiseArray.prototype._promiseFulfilled = function (value, index) {
                    this._values[index] = value;
                    var totalResolved = ++this._totalResolved;
                    if (totalResolved >= this._length) {
                        var val;
                        if (this._isMap) {
                            val = entriesToMap(this._values);
                        } else {
                            val = {};
                            var keyOffset = this.length();
                            for (var i = 0, len = this.length(); i < len; ++i) {
                                val[this._values[i + keyOffset]] = this._values[i];
                            }
                        }
                        this._resolve(val);
                        return true;
                    }
                    return false;
                };

                PropertiesPromiseArray.prototype.shouldCopyValues = function () {
                    return false;
                };

                PropertiesPromiseArray.prototype.getActualLength = function (len) {
                    return len >> 1;
                };

                function props(promises) {
                    var ret;
                    var castValue = tryConvertToPromise(promises);

                    if (!isObject(castValue)) {
                        return apiRejection("cannot await properties of a non-object\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    } else if (castValue instanceof Promise) {
                        ret = castValue._then(
                            Promise.props, undefined, undefined, undefined, undefined);
                    } else {
                        ret = new PropertiesPromiseArray(castValue).promise();
                    }

                    if (castValue instanceof Promise) {
                        ret._propagateFrom(castValue, 2);
                    }
                    return ret;
                }

                Promise.prototype.props = function () {
                    return props(this);
                };

                Promise.props = function (promises) {
                    return props(promises);
                };
            };

        },{"./es5":13,"./util":36}],26:[function(_dereq_,module,exports){
            "use strict";
            function arrayMove(src, srcIndex, dst, dstIndex, len) {
                for (var j = 0; j < len; ++j) {
                    dst[j + dstIndex] = src[j + srcIndex];
                    src[j + srcIndex] = void 0;
                }
            }

            function Queue(capacity) {
                this._capacity = capacity;
                this._length = 0;
                this._front = 0;
            }

            Queue.prototype._willBeOverCapacity = function (size) {
                return this._capacity < size;
            };

            Queue.prototype._pushOne = function (arg) {
                var length = this.length();
                this._checkCapacity(length + 1);
                var i = (this._front + length) & (this._capacity - 1);
                this[i] = arg;
                this._length = length + 1;
            };

            Queue.prototype.push = function (fn, receiver, arg) {
                var length = this.length() + 3;
                if (this._willBeOverCapacity(length)) {
                    this._pushOne(fn);
                    this._pushOne(receiver);
                    this._pushOne(arg);
                    return;
                }
                var j = this._front + length - 3;
                this._checkCapacity(length);
                var wrapMask = this._capacity - 1;
                this[(j + 0) & wrapMask] = fn;
                this[(j + 1) & wrapMask] = receiver;
                this[(j + 2) & wrapMask] = arg;
                this._length = length;
            };

            Queue.prototype.shift = function () {
                var front = this._front,
                    ret = this[front];

                this[front] = undefined;
                this._front = (front + 1) & (this._capacity - 1);
                this._length--;
                return ret;
            };

            Queue.prototype.length = function () {
                return this._length;
            };

            Queue.prototype._checkCapacity = function (size) {
                if (this._capacity < size) {
                    this._resizeTo(this._capacity << 1);
                }
            };

            Queue.prototype._resizeTo = function (capacity) {
                var oldCapacity = this._capacity;
                this._capacity = capacity;
                var front = this._front;
                var length = this._length;
                var moveItemsCount = (front + length) & (oldCapacity - 1);
                arrayMove(this, 0, this, oldCapacity, moveItemsCount);
            };

            module.exports = Queue;

        },{}],27:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(
                Promise, INTERNAL, tryConvertToPromise, apiRejection) {
                var util = _dereq_("./util");

                var raceLater = function (promise) {
                    return promise.then(function(array) {
                        return race(array, promise);
                    });
                };

                function race(promises, parent) {
                    var maybePromise = tryConvertToPromise(promises);

                    if (maybePromise instanceof Promise) {
                        return raceLater(maybePromise);
                    } else {
                        promises = util.asArray(promises);
                        if (promises === null)
                            return apiRejection("expecting an array or an iterable object but got " + util.classString(promises));
                    }

                    var ret = new Promise(INTERNAL);
                    if (parent !== undefined) {
                        ret._propagateFrom(parent, 3);
                    }
                    var fulfill = ret._fulfill;
                    var reject = ret._reject;
                    for (var i = 0, len = promises.length; i < len; ++i) {
                        var val = promises[i];

                        if (val === undefined && !(i in promises)) {
                            continue;
                        }

                        Promise.cast(val)._then(fulfill, reject, undefined, ret, null);
                    }
                    return ret;
                }

                Promise.race = function (promises) {
                    return race(promises, undefined);
                };

                Promise.prototype.race = function () {
                    return race(this, undefined);
                };

            };

        },{"./util":36}],28:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise,
                                      PromiseArray,
                                      apiRejection,
                                      tryConvertToPromise,
                                      INTERNAL,
                                      debug) {
                var getDomain = Promise._getDomain;
                var util = _dereq_("./util");
                var tryCatch = util.tryCatch;

                function ReductionPromiseArray(promises, fn, initialValue, _each) {
                    this.constructor$(promises);
                    var domain = getDomain();
                    this._fn = domain === null ? fn : util.domainBind(domain, fn);
                    if (initialValue !== undefined) {
                        initialValue = Promise.resolve(initialValue);
                        initialValue._attachCancellationCallback(this);
                    }
                    this._initialValue = initialValue;
                    this._currentCancellable = null;
                    if(_each === INTERNAL) {
                        this._eachValues = Array(this._length);
                    } else if (_each === 0) {
                        this._eachValues = null;
                    } else {
                        this._eachValues = undefined;
                    }
                    this._promise._captureStackTrace();
                    this._init$(undefined, -5);
                }
                util.inherits(ReductionPromiseArray, PromiseArray);

                ReductionPromiseArray.prototype._gotAccum = function(accum) {
                    if (this._eachValues !== undefined &&
                        this._eachValues !== null &&
                        accum !== INTERNAL) {
                        this._eachValues.push(accum);
                    }
                };

                ReductionPromiseArray.prototype._eachComplete = function(value) {
                    if (this._eachValues !== null) {
                        this._eachValues.push(value);
                    }
                    return this._eachValues;
                };

                ReductionPromiseArray.prototype._init = function() {};

                ReductionPromiseArray.prototype._resolveEmptyArray = function() {
                    this._resolve(this._eachValues !== undefined ? this._eachValues
                        : this._initialValue);
                };

                ReductionPromiseArray.prototype.shouldCopyValues = function () {
                    return false;
                };

                ReductionPromiseArray.prototype._resolve = function(value) {
                    this._promise._resolveCallback(value);
                    this._values = null;
                };

                ReductionPromiseArray.prototype._resultCancelled = function(sender) {
                    if (sender === this._initialValue) return this._cancel();
                    if (this._isResolved()) return;
                    this._resultCancelled$();
                    if (this._currentCancellable instanceof Promise) {
                        this._currentCancellable.cancel();
                    }
                    if (this._initialValue instanceof Promise) {
                        this._initialValue.cancel();
                    }
                };

                ReductionPromiseArray.prototype._iterate = function (values) {
                    this._values = values;
                    var value;
                    var i;
                    var length = values.length;
                    if (this._initialValue !== undefined) {
                        value = this._initialValue;
                        i = 0;
                    } else {
                        value = Promise.resolve(values[0]);
                        i = 1;
                    }

                    this._currentCancellable = value;

                    if (!value.isRejected()) {
                        for (; i < length; ++i) {
                            var ctx = {
                                accum: null,
                                value: values[i],
                                index: i,
                                length: length,
                                array: this
                            };
                            value = value._then(gotAccum, undefined, undefined, ctx, undefined);
                        }
                    }

                    if (this._eachValues !== undefined) {
                        value = value
                            ._then(this._eachComplete, undefined, undefined, this, undefined);
                    }
                    value._then(completed, completed, undefined, value, this);
                };

                Promise.prototype.reduce = function (fn, initialValue) {
                    return reduce(this, fn, initialValue, null);
                };

                Promise.reduce = function (promises, fn, initialValue, _each) {
                    return reduce(promises, fn, initialValue, _each);
                };

                function completed(valueOrReason, array) {
                    if (this.isFulfilled()) {
                        array._resolve(valueOrReason);
                    } else {
                        array._reject(valueOrReason);
                    }
                }

                function reduce(promises, fn, initialValue, _each) {
                    if (typeof fn !== "function") {
                        return apiRejection("expecting a function but got " + util.classString(fn));
                    }
                    var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
                    return array.promise();
                }

                function gotAccum(accum) {
                    this.accum = accum;
                    this.array._gotAccum(accum);
                    var value = tryConvertToPromise(this.value, this.array._promise);
                    if (value instanceof Promise) {
                        this.array._currentCancellable = value;
                        return value._then(gotValue, undefined, undefined, this, undefined);
                    } else {
                        return gotValue.call(this, value);
                    }
                }

                function gotValue(value) {
                    var array = this.array;
                    var promise = array._promise;
                    var fn = tryCatch(array._fn);
                    promise._pushContext();
                    var ret;
                    if (array._eachValues !== undefined) {
                        ret = fn.call(promise._boundValue(), value, this.index, this.length);
                    } else {
                        ret = fn.call(promise._boundValue(),
                            this.accum, value, this.index, this.length);
                    }
                    if (ret instanceof Promise) {
                        array._currentCancellable = ret;
                    }
                    var promiseCreated = promise._popContext();
                    debug.checkForgottenReturns(
                        ret,
                        promiseCreated,
                        array._eachValues !== undefined ? "Promise.each" : "Promise.reduce",
                        promise
                    );
                    return ret;
                }
            };

        },{"./util":36}],29:[function(_dereq_,module,exports){
            "use strict";
            var util = _dereq_("./util");
            var schedule;
            var noAsyncScheduler = function() {
                throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
            };
            var NativePromise = util.getNativePromise();
            if (util.isNode && typeof MutationObserver === "undefined") {
                var GlobalSetImmediate = global.setImmediate;
                var ProcessNextTick = process.nextTick;
                schedule = util.isRecentNode
                    ? function(fn) { GlobalSetImmediate.call(global, fn); }
                    : function(fn) { ProcessNextTick.call(process, fn); };
            } else if (typeof NativePromise === "function" &&
                typeof NativePromise.resolve === "function") {
                var nativePromise = NativePromise.resolve();
                schedule = function(fn) {
                    nativePromise.then(fn);
                };
            } else if ((typeof MutationObserver !== "undefined") &&
                !(typeof window !== "undefined" &&
                window.navigator &&
                (window.navigator.standalone || window.cordova))) {
                schedule = (function() {
                    var div = document.createElement("div");
                    var opts = {attributes: true};
                    var toggleScheduled = false;
                    var div2 = document.createElement("div");
                    var o2 = new MutationObserver(function() {
                        div.classList.toggle("foo");
                        toggleScheduled = false;
                    });
                    o2.observe(div2, opts);

                    var scheduleToggle = function() {
                        if (toggleScheduled) return;
                        toggleScheduled = true;
                        div2.classList.toggle("foo");
                    };

                    return function schedule(fn) {
                        var o = new MutationObserver(function() {
                            o.disconnect();
                            fn();
                        });
                        o.observe(div, opts);
                        scheduleToggle();
                    };
                })();
            } else if (typeof setImmediate !== "undefined") {
                schedule = function (fn) {
                    setImmediate(fn);
                };
            } else if (typeof setTimeout !== "undefined") {
                schedule = function (fn) {
                    setTimeout(fn, 0);
                };
            } else {
                schedule = noAsyncScheduler;
            }
            module.exports = schedule;

        },{"./util":36}],30:[function(_dereq_,module,exports){
            "use strict";
            module.exports =
                function(Promise, PromiseArray, debug) {
                    var PromiseInspection = Promise.PromiseInspection;
                    var util = _dereq_("./util");

                    function SettledPromiseArray(values) {
                        this.constructor$(values);
                    }
                    util.inherits(SettledPromiseArray, PromiseArray);

                    SettledPromiseArray.prototype._promiseResolved = function (index, inspection) {
                        this._values[index] = inspection;
                        var totalResolved = ++this._totalResolved;
                        if (totalResolved >= this._length) {
                            this._resolve(this._values);
                            return true;
                        }
                        return false;
                    };

                    SettledPromiseArray.prototype._promiseFulfilled = function (value, index) {
                        var ret = new PromiseInspection();
                        ret._bitField = 33554432;
                        ret._settledValueField = value;
                        return this._promiseResolved(index, ret);
                    };
                    SettledPromiseArray.prototype._promiseRejected = function (reason, index) {
                        var ret = new PromiseInspection();
                        ret._bitField = 16777216;
                        ret._settledValueField = reason;
                        return this._promiseResolved(index, ret);
                    };

                    Promise.settle = function (promises) {
                        debug.deprecated(".settle()", ".reflect()");
                        return new SettledPromiseArray(promises).promise();
                    };

                    Promise.prototype.settle = function () {
                        return Promise.settle(this);
                    };
                };

        },{"./util":36}],31:[function(_dereq_,module,exports){
            "use strict";
            module.exports =
                function(Promise, PromiseArray, apiRejection) {
                    var util = _dereq_("./util");
                    var RangeError = _dereq_("./errors").RangeError;
                    var AggregateError = _dereq_("./errors").AggregateError;
                    var isArray = util.isArray;
                    var CANCELLATION = {};


                    function SomePromiseArray(values) {
                        this.constructor$(values);
                        this._howMany = 0;
                        this._unwrap = false;
                        this._initialized = false;
                    }
                    util.inherits(SomePromiseArray, PromiseArray);

                    SomePromiseArray.prototype._init = function () {
                        if (!this._initialized) {
                            return;
                        }
                        if (this._howMany === 0) {
                            this._resolve([]);
                            return;
                        }
                        this._init$(undefined, -5);
                        var isArrayResolved = isArray(this._values);
                        if (!this._isResolved() &&
                            isArrayResolved &&
                            this._howMany > this._canPossiblyFulfill()) {
                            this._reject(this._getRangeError(this.length()));
                        }
                    };

                    SomePromiseArray.prototype.init = function () {
                        this._initialized = true;
                        this._init();
                    };

                    SomePromiseArray.prototype.setUnwrap = function () {
                        this._unwrap = true;
                    };

                    SomePromiseArray.prototype.howMany = function () {
                        return this._howMany;
                    };

                    SomePromiseArray.prototype.setHowMany = function (count) {
                        this._howMany = count;
                    };

                    SomePromiseArray.prototype._promiseFulfilled = function (value) {
                        this._addFulfilled(value);
                        if (this._fulfilled() === this.howMany()) {
                            this._values.length = this.howMany();
                            if (this.howMany() === 1 && this._unwrap) {
                                this._resolve(this._values[0]);
                            } else {
                                this._resolve(this._values);
                            }
                            return true;
                        }
                        return false;

                    };
                    SomePromiseArray.prototype._promiseRejected = function (reason) {
                        this._addRejected(reason);
                        return this._checkOutcome();
                    };

                    SomePromiseArray.prototype._promiseCancelled = function () {
                        if (this._values instanceof Promise || this._values == null) {
                            return this._cancel();
                        }
                        this._addRejected(CANCELLATION);
                        return this._checkOutcome();
                    };

                    SomePromiseArray.prototype._checkOutcome = function() {
                        if (this.howMany() > this._canPossiblyFulfill()) {
                            var e = new AggregateError();
                            for (var i = this.length(); i < this._values.length; ++i) {
                                if (this._values[i] !== CANCELLATION) {
                                    e.push(this._values[i]);
                                }
                            }
                            if (e.length > 0) {
                                this._reject(e);
                            } else {
                                this._cancel();
                            }
                            return true;
                        }
                        return false;
                    };

                    SomePromiseArray.prototype._fulfilled = function () {
                        return this._totalResolved;
                    };

                    SomePromiseArray.prototype._rejected = function () {
                        return this._values.length - this.length();
                    };

                    SomePromiseArray.prototype._addRejected = function (reason) {
                        this._values.push(reason);
                    };

                    SomePromiseArray.prototype._addFulfilled = function (value) {
                        this._values[this._totalResolved++] = value;
                    };

                    SomePromiseArray.prototype._canPossiblyFulfill = function () {
                        return this.length() - this._rejected();
                    };

                    SomePromiseArray.prototype._getRangeError = function (count) {
                        var message = "Input array must contain at least " +
                            this._howMany + " items but contains only " + count + " items";
                        return new RangeError(message);
                    };

                    SomePromiseArray.prototype._resolveEmptyArray = function () {
                        this._reject(this._getRangeError(0));
                    };

                    function some(promises, howMany) {
                        if ((howMany | 0) !== howMany || howMany < 0) {
                            return apiRejection("expecting a positive integer\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                        }
                        var ret = new SomePromiseArray(promises);
                        var promise = ret.promise();
                        ret.setHowMany(howMany);
                        ret.init();
                        return promise;
                    }

                    Promise.some = function (promises, howMany) {
                        return some(promises, howMany);
                    };

                    Promise.prototype.some = function (howMany) {
                        return some(this, howMany);
                    };

                    Promise._SomePromiseArray = SomePromiseArray;
                };

        },{"./errors":12,"./util":36}],32:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise) {
                function PromiseInspection(promise) {
                    if (promise !== undefined) {
                        promise = promise._target();
                        this._bitField = promise._bitField;
                        this._settledValueField = promise._isFateSealed()
                            ? promise._settledValue() : undefined;
                    }
                    else {
                        this._bitField = 0;
                        this._settledValueField = undefined;
                    }
                }

                PromiseInspection.prototype._settledValue = function() {
                    return this._settledValueField;
                };

                var value = PromiseInspection.prototype.value = function () {
                    if (!this.isFulfilled()) {
                        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                    }
                    return this._settledValue();
                };

                var reason = PromiseInspection.prototype.error =
                    PromiseInspection.prototype.reason = function () {
                        if (!this.isRejected()) {
                            throw new TypeError("cannot get rejection reason of a non-rejected promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
                        }
                        return this._settledValue();
                    };

                var isFulfilled = PromiseInspection.prototype.isFulfilled = function() {
                    return (this._bitField & 33554432) !== 0;
                };

                var isRejected = PromiseInspection.prototype.isRejected = function () {
                    return (this._bitField & 16777216) !== 0;
                };

                var isPending = PromiseInspection.prototype.isPending = function () {
                    return (this._bitField & 50397184) === 0;
                };

                var isResolved = PromiseInspection.prototype.isResolved = function () {
                    return (this._bitField & 50331648) !== 0;
                };

                PromiseInspection.prototype.isCancelled = function() {
                    return (this._bitField & 8454144) !== 0;
                };

                Promise.prototype.__isCancelled = function() {
                    return (this._bitField & 65536) === 65536;
                };

                Promise.prototype._isCancelled = function() {
                    return this._target().__isCancelled();
                };

                Promise.prototype.isCancelled = function() {
                    return (this._target()._bitField & 8454144) !== 0;
                };

                Promise.prototype.isPending = function() {
                    return isPending.call(this._target());
                };

                Promise.prototype.isRejected = function() {
                    return isRejected.call(this._target());
                };

                Promise.prototype.isFulfilled = function() {
                    return isFulfilled.call(this._target());
                };

                Promise.prototype.isResolved = function() {
                    return isResolved.call(this._target());
                };

                Promise.prototype.value = function() {
                    return value.call(this._target());
                };

                Promise.prototype.reason = function() {
                    var target = this._target();
                    target._unsetRejectionIsUnhandled();
                    return reason.call(target);
                };

                Promise.prototype._value = function() {
                    return this._settledValue();
                };

                Promise.prototype._reason = function() {
                    this._unsetRejectionIsUnhandled();
                    return this._settledValue();
                };

                Promise.PromiseInspection = PromiseInspection;
            };

        },{}],33:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, INTERNAL) {
                var util = _dereq_("./util");
                var errorObj = util.errorObj;
                var isObject = util.isObject;

                function tryConvertToPromise(obj, context) {
                    if (isObject(obj)) {
                        if (obj instanceof Promise) return obj;
                        var then = getThen(obj);
                        if (then === errorObj) {
                            if (context) context._pushContext();
                            var ret = Promise.reject(then.e);
                            if (context) context._popContext();
                            return ret;
                        } else if (typeof then === "function") {
                            if (isAnyBluebirdPromise(obj)) {
                                var ret = new Promise(INTERNAL);
                                obj._then(
                                    ret._fulfill,
                                    ret._reject,
                                    undefined,
                                    ret,
                                    null
                                );
                                return ret;
                            }
                            return doThenable(obj, then, context);
                        }
                    }
                    return obj;
                }

                function doGetThen(obj) {
                    return obj.then;
                }

                function getThen(obj) {
                    try {
                        return doGetThen(obj);
                    } catch (e) {
                        errorObj.e = e;
                        return errorObj;
                    }
                }

                var hasProp = {}.hasOwnProperty;
                function isAnyBluebirdPromise(obj) {
                    try {
                        return hasProp.call(obj, "_promise0");
                    } catch (e) {
                        return false;
                    }
                }

                function doThenable(x, then, context) {
                    var promise = new Promise(INTERNAL);
                    var ret = promise;
                    if (context) context._pushContext();
                    promise._captureStackTrace();
                    if (context) context._popContext();
                    var synchronous = true;
                    var result = util.tryCatch(then).call(x, resolve, reject);
                    synchronous = false;

                    if (promise && result === errorObj) {
                        promise._rejectCallback(result.e, true, true);
                        promise = null;
                    }

                    function resolve(value) {
                        if (!promise) return;
                        promise._resolveCallback(value);
                        promise = null;
                    }

                    function reject(reason) {
                        if (!promise) return;
                        promise._rejectCallback(reason, synchronous, true);
                        promise = null;
                    }
                    return ret;
                }

                return tryConvertToPromise;
            };

        },{"./util":36}],34:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function(Promise, INTERNAL, debug) {
                var util = _dereq_("./util");
                var TimeoutError = Promise.TimeoutError;

                function HandleWrapper(handle)  {
                    this.handle = handle;
                }

                HandleWrapper.prototype._resultCancelled = function() {
                    clearTimeout(this.handle);
                };

                var afterValue = function(value) { return delay(+this).thenReturn(value); };
                var delay = Promise.delay = function (ms, value) {
                    var ret;
                    var handle;
                    if (value !== undefined) {
                        ret = Promise.resolve(value)
                            ._then(afterValue, null, null, ms, undefined);
                        if (debug.cancellation() && value instanceof Promise) {
                            ret._setOnCancel(value);
                        }
                    } else {
                        ret = new Promise(INTERNAL);
                        handle = setTimeout(function() { ret._fulfill(); }, +ms);
                        if (debug.cancellation()) {
                            ret._setOnCancel(new HandleWrapper(handle));
                        }
                        ret._captureStackTrace();
                    }
                    ret._setAsyncGuaranteed();
                    return ret;
                };

                Promise.prototype.delay = function (ms) {
                    return delay(ms, this);
                };

                var afterTimeout = function (promise, message, parent) {
                    var err;
                    if (typeof message !== "string") {
                        if (message instanceof Error) {
                            err = message;
                        } else {
                            err = new TimeoutError("operation timed out");
                        }
                    } else {
                        err = new TimeoutError(message);
                    }
                    util.markAsOriginatingFromRejection(err);
                    promise._attachExtraTrace(err);
                    promise._reject(err);

                    if (parent != null) {
                        parent.cancel();
                    }
                };

                function successClear(value) {
                    clearTimeout(this.handle);
                    return value;
                }

                function failureClear(reason) {
                    clearTimeout(this.handle);
                    throw reason;
                }

                Promise.prototype.timeout = function (ms, message) {
                    ms = +ms;
                    var ret, parent;

                    var handleWrapper = new HandleWrapper(setTimeout(function timeoutTimeout() {
                        if (ret.isPending()) {
                            afterTimeout(ret, message, parent);
                        }
                    }, ms));

                    if (debug.cancellation()) {
                        parent = this.then();
                        ret = parent._then(successClear, failureClear,
                            undefined, handleWrapper, undefined);
                        ret._setOnCancel(handleWrapper);
                    } else {
                        ret = this._then(successClear, failureClear,
                            undefined, handleWrapper, undefined);
                    }

                    return ret;
                };

            };

        },{"./util":36}],35:[function(_dereq_,module,exports){
            "use strict";
            module.exports = function (Promise, apiRejection, tryConvertToPromise,
                                       createContext, INTERNAL, debug) {
                var util = _dereq_("./util");
                var TypeError = _dereq_("./errors").TypeError;
                var inherits = _dereq_("./util").inherits;
                var errorObj = util.errorObj;
                var tryCatch = util.tryCatch;
                var NULL = {};

                function thrower(e) {
                    setTimeout(function(){throw e;}, 0);
                }

                function castPreservingDisposable(thenable) {
                    var maybePromise = tryConvertToPromise(thenable);
                    if (maybePromise !== thenable &&
                        typeof thenable._isDisposable === "function" &&
                        typeof thenable._getDisposer === "function" &&
                        thenable._isDisposable()) {
                        maybePromise._setDisposable(thenable._getDisposer());
                    }
                    return maybePromise;
                }
                function dispose(resources, inspection) {
                    var i = 0;
                    var len = resources.length;
                    var ret = new Promise(INTERNAL);
                    function iterator() {
                        if (i >= len) return ret._fulfill();
                        var maybePromise = castPreservingDisposable(resources[i++]);
                        if (maybePromise instanceof Promise &&
                            maybePromise._isDisposable()) {
                            try {
                                maybePromise = tryConvertToPromise(
                                    maybePromise._getDisposer().tryDispose(inspection),
                                    resources.promise);
                            } catch (e) {
                                return thrower(e);
                            }
                            if (maybePromise instanceof Promise) {
                                return maybePromise._then(iterator, thrower,
                                    null, null, null);
                            }
                        }
                        iterator();
                    }
                    iterator();
                    return ret;
                }

                function Disposer(data, promise, context) {
                    this._data = data;
                    this._promise = promise;
                    this._context = context;
                }

                Disposer.prototype.data = function () {
                    return this._data;
                };

                Disposer.prototype.promise = function () {
                    return this._promise;
                };

                Disposer.prototype.resource = function () {
                    if (this.promise().isFulfilled()) {
                        return this.promise().value();
                    }
                    return NULL;
                };

                Disposer.prototype.tryDispose = function(inspection) {
                    var resource = this.resource();
                    var context = this._context;
                    if (context !== undefined) context._pushContext();
                    var ret = resource !== NULL
                        ? this.doDispose(resource, inspection) : null;
                    if (context !== undefined) context._popContext();
                    this._promise._unsetDisposable();
                    this._data = null;
                    return ret;
                };

                Disposer.isDisposer = function (d) {
                    return (d != null &&
                    typeof d.resource === "function" &&
                    typeof d.tryDispose === "function");
                };

                function FunctionDisposer(fn, promise, context) {
                    this.constructor$(fn, promise, context);
                }
                inherits(FunctionDisposer, Disposer);

                FunctionDisposer.prototype.doDispose = function (resource, inspection) {
                    var fn = this.data();
                    return fn.call(resource, resource, inspection);
                };

                function maybeUnwrapDisposer(value) {
                    if (Disposer.isDisposer(value)) {
                        this.resources[this.index]._setDisposable(value);
                        return value.promise();
                    }
                    return value;
                }

                function ResourceList(length) {
                    this.length = length;
                    this.promise = null;
                    this[length-1] = null;
                }

                ResourceList.prototype._resultCancelled = function() {
                    var len = this.length;
                    for (var i = 0; i < len; ++i) {
                        var item = this[i];
                        if (item instanceof Promise) {
                            item.cancel();
                        }
                    }
                };

                Promise.using = function () {
                    var len = arguments.length;
                    if (len < 2) return apiRejection(
                        "you must pass at least 2 arguments to Promise.using");
                    var fn = arguments[len - 1];
                    if (typeof fn !== "function") {
                        return apiRejection("expecting a function but got " + util.classString(fn));
                    }
                    var input;
                    var spreadArgs = true;
                    if (len === 2 && Array.isArray(arguments[0])) {
                        input = arguments[0];
                        len = input.length;
                        spreadArgs = false;
                    } else {
                        input = arguments;
                        len--;
                    }
                    var resources = new ResourceList(len);
                    for (var i = 0; i < len; ++i) {
                        var resource = input[i];
                        if (Disposer.isDisposer(resource)) {
                            var disposer = resource;
                            resource = resource.promise();
                            resource._setDisposable(disposer);
                        } else {
                            var maybePromise = tryConvertToPromise(resource);
                            if (maybePromise instanceof Promise) {
                                resource =
                                    maybePromise._then(maybeUnwrapDisposer, null, null, {
                                        resources: resources,
                                        index: i
                                    }, undefined);
                            }
                        }
                        resources[i] = resource;
                    }

                    var reflectedResources = new Array(resources.length);
                    for (var i = 0; i < reflectedResources.length; ++i) {
                        reflectedResources[i] = Promise.resolve(resources[i]).reflect();
                    }

                    var resultPromise = Promise.all(reflectedResources)
                        .then(function(inspections) {
                            for (var i = 0; i < inspections.length; ++i) {
                                var inspection = inspections[i];
                                if (inspection.isRejected()) {
                                    errorObj.e = inspection.error();
                                    return errorObj;
                                } else if (!inspection.isFulfilled()) {
                                    resultPromise.cancel();
                                    return;
                                }
                                inspections[i] = inspection.value();
                            }
                            promise._pushContext();

                            fn = tryCatch(fn);
                            var ret = spreadArgs
                                ? fn.apply(undefined, inspections) : fn(inspections);
                            var promiseCreated = promise._popContext();
                            debug.checkForgottenReturns(
                                ret, promiseCreated, "Promise.using", promise);
                            return ret;
                        });

                    var promise = resultPromise.lastly(function() {
                        var inspection = new Promise.PromiseInspection(resultPromise);
                        return dispose(resources, inspection);
                    });
                    resources.promise = promise;
                    promise._setOnCancel(resources);
                    return promise;
                };

                Promise.prototype._setDisposable = function (disposer) {
                    this._bitField = this._bitField | 131072;
                    this._disposer = disposer;
                };

                Promise.prototype._isDisposable = function () {
                    return (this._bitField & 131072) > 0;
                };

                Promise.prototype._getDisposer = function () {
                    return this._disposer;
                };

                Promise.prototype._unsetDisposable = function () {
                    this._bitField = this._bitField & (~131072);
                    this._disposer = undefined;
                };

                Promise.prototype.disposer = function (fn) {
                    if (typeof fn === "function") {
                        return new FunctionDisposer(fn, this, createContext());
                    }
                    throw new TypeError();
                };

            };

        },{"./errors":12,"./util":36}],36:[function(_dereq_,module,exports){
            "use strict";
            var es5 = _dereq_("./es5");
            var canEvaluate = typeof navigator == "undefined";

            var errorObj = {e: {}};
            var tryCatchTarget;
            var globalObject = typeof self !== "undefined" ? self :
                typeof window !== "undefined" ? window :
                    typeof global !== "undefined" ? global :
                        this !== undefined ? this : null;

            function tryCatcher() {
                try {
                    var target = tryCatchTarget;
                    tryCatchTarget = null;
                    return target.apply(this, arguments);
                } catch (e) {
                    errorObj.e = e;
                    return errorObj;
                }
            }
            function tryCatch(fn) {
                tryCatchTarget = fn;
                return tryCatcher;
            }

            var inherits = function(Child, Parent) {
                var hasProp = {}.hasOwnProperty;

                function T() {
                    this.constructor = Child;
                    this.constructor$ = Parent;
                    for (var propertyName in Parent.prototype) {
                        if (hasProp.call(Parent.prototype, propertyName) &&
                            propertyName.charAt(propertyName.length-1) !== "$"
                        ) {
                            this[propertyName + "$"] = Parent.prototype[propertyName];
                        }
                    }
                }
                T.prototype = Parent.prototype;
                Child.prototype = new T();
                return Child.prototype;
            };


            function isPrimitive(val) {
                return val == null || val === true || val === false ||
                    typeof val === "string" || typeof val === "number";

            }

            function isObject(value) {
                return typeof value === "function" ||
                    typeof value === "object" && value !== null;
            }

            function maybeWrapAsError(maybeError) {
                if (!isPrimitive(maybeError)) return maybeError;

                return new Error(safeToString(maybeError));
            }

            function withAppended(target, appendee) {
                var len = target.length;
                var ret = new Array(len + 1);
                var i;
                for (i = 0; i < len; ++i) {
                    ret[i] = target[i];
                }
                ret[i] = appendee;
                return ret;
            }

            function getDataPropertyOrDefault(obj, key, defaultValue) {
                if (es5.isES5) {
                    var desc = Object.getOwnPropertyDescriptor(obj, key);

                    if (desc != null) {
                        return desc.get == null && desc.set == null
                            ? desc.value
                            : defaultValue;
                    }
                } else {
                    return {}.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
                }
            }

            function notEnumerableProp(obj, name, value) {
                if (isPrimitive(obj)) return obj;
                var descriptor = {
                    value: value,
                    configurable: true,
                    enumerable: false,
                    writable: true
                };
                es5.defineProperty(obj, name, descriptor);
                return obj;
            }

            function thrower(r) {
                throw r;
            }

            var inheritedDataKeys = (function() {
                var excludedPrototypes = [
                    Array.prototype,
                    Object.prototype,
                    Function.prototype
                ];

                var isExcludedProto = function(val) {
                    for (var i = 0; i < excludedPrototypes.length; ++i) {
                        if (excludedPrototypes[i] === val) {
                            return true;
                        }
                    }
                    return false;
                };

                if (es5.isES5) {
                    var getKeys = Object.getOwnPropertyNames;
                    return function(obj) {
                        var ret = [];
                        var visitedKeys = Object.create(null);
                        while (obj != null && !isExcludedProto(obj)) {
                            var keys;
                            try {
                                keys = getKeys(obj);
                            } catch (e) {
                                return ret;
                            }
                            for (var i = 0; i < keys.length; ++i) {
                                var key = keys[i];
                                if (visitedKeys[key]) continue;
                                visitedKeys[key] = true;
                                var desc = Object.getOwnPropertyDescriptor(obj, key);
                                if (desc != null && desc.get == null && desc.set == null) {
                                    ret.push(key);
                                }
                            }
                            obj = es5.getPrototypeOf(obj);
                        }
                        return ret;
                    };
                } else {
                    var hasProp = {}.hasOwnProperty;
                    return function(obj) {
                        if (isExcludedProto(obj)) return [];
                        var ret = [];

                        /*jshint forin:false */
                        enumeration: for (var key in obj) {
                            if (hasProp.call(obj, key)) {
                                ret.push(key);
                            } else {
                                for (var i = 0; i < excludedPrototypes.length; ++i) {
                                    if (hasProp.call(excludedPrototypes[i], key)) {
                                        continue enumeration;
                                    }
                                }
                                ret.push(key);
                            }
                        }
                        return ret;
                    };
                }

            })();

            var thisAssignmentPattern = /this\s*\.\s*\S+\s*=/;
            function isClass(fn) {
                try {
                    if (typeof fn === "function") {
                        var keys = es5.names(fn.prototype);

                        var hasMethods = es5.isES5 && keys.length > 1;
                        var hasMethodsOtherThanConstructor = keys.length > 0 &&
                            !(keys.length === 1 && keys[0] === "constructor");
                        var hasThisAssignmentAndStaticMethods =
                            thisAssignmentPattern.test(fn + "") && es5.names(fn).length > 0;

                        if (hasMethods || hasMethodsOtherThanConstructor ||
                            hasThisAssignmentAndStaticMethods) {
                            return true;
                        }
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            }

            function toFastProperties(obj) {
                /*jshint -W027,-W055,-W031*/
                function FakeConstructor() {}
                FakeConstructor.prototype = obj;
                var l = 8;
                while (l--) new FakeConstructor();
                return obj;
                eval(obj);
            }

            var rident = /^[a-z$_][a-z$_0-9]*$/i;
            function isIdentifier(str) {
                return rident.test(str);
            }

            function filledRange(count, prefix, suffix) {
                var ret = new Array(count);
                for(var i = 0; i < count; ++i) {
                    ret[i] = prefix + i + suffix;
                }
                return ret;
            }

            function safeToString(obj) {
                try {
                    return obj + "";
                } catch (e) {
                    return "[no string representation]";
                }
            }

            function isError(obj) {
                return obj instanceof Error ||
                    (obj !== null &&
                    typeof obj === "object" &&
                    typeof obj.message === "string" &&
                    typeof obj.name === "string");
            }

            function markAsOriginatingFromRejection(e) {
                try {
                    notEnumerableProp(e, "isOperational", true);
                }
                catch(ignore) {}
            }

            function originatesFromRejection(e) {
                if (e == null) return false;
                return ((e instanceof Error["__BluebirdErrorTypes__"].OperationalError) ||
                e["isOperational"] === true);
            }

            function canAttachTrace(obj) {
                return isError(obj) && es5.propertyIsWritable(obj, "stack");
            }

            var ensureErrorObject = (function() {
                if (!("stack" in new Error())) {
                    return function(value) {
                        if (canAttachTrace(value)) return value;
                        try {throw new Error(safeToString(value));}
                        catch(err) {return err;}
                    };
                } else {
                    return function(value) {
                        if (canAttachTrace(value)) return value;
                        return new Error(safeToString(value));
                    };
                }
            })();

            function classString(obj) {
                return {}.toString.call(obj);
            }

            function copyDescriptors(from, to, filter) {
                var keys = es5.names(from);
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (filter(key)) {
                        try {
                            es5.defineProperty(to, key, es5.getDescriptor(from, key));
                        } catch (ignore) {}
                    }
                }
            }

            var asArray = function(v) {
                if (es5.isArray(v)) {
                    return v;
                }
                return null;
            };

            if (typeof Symbol !== "undefined" && Symbol.iterator) {
                var ArrayFrom = typeof Array.from === "function" ? function(v) {
                    return Array.from(v);
                } : function(v) {
                    var ret = [];
                    var it = v[Symbol.iterator]();
                    var itResult;
                    while (!((itResult = it.next()).done)) {
                        ret.push(itResult.value);
                    }
                    return ret;
                };

                asArray = function(v) {
                    if (es5.isArray(v)) {
                        return v;
                    } else if (v != null && typeof v[Symbol.iterator] === "function") {
                        return ArrayFrom(v);
                    }
                    return null;
                };
            }

            var isNode = typeof process !== "undefined" &&
                classString(process).toLowerCase() === "[object process]";

            var hasEnvVariables = typeof process !== "undefined" &&
                typeof process.env !== "undefined";

            function env(key) {
                return hasEnvVariables ? process.env[key] : undefined;
            }

            function getNativePromise() {
                if (typeof Promise === "function") {
                    try {
                        var promise = new Promise(function(){});
                        if ({}.toString.call(promise) === "[object Promise]") {
                            return Promise;
                        }
                    } catch (e) {}
                }
            }

            function domainBind(self, cb) {
                return self.bind(cb);
            }

            var ret = {
                isClass: isClass,
                isIdentifier: isIdentifier,
                inheritedDataKeys: inheritedDataKeys,
                getDataPropertyOrDefault: getDataPropertyOrDefault,
                thrower: thrower,
                isArray: es5.isArray,
                asArray: asArray,
                notEnumerableProp: notEnumerableProp,
                isPrimitive: isPrimitive,
                isObject: isObject,
                isError: isError,
                canEvaluate: canEvaluate,
                errorObj: errorObj,
                tryCatch: tryCatch,
                inherits: inherits,
                withAppended: withAppended,
                maybeWrapAsError: maybeWrapAsError,
                toFastProperties: toFastProperties,
                filledRange: filledRange,
                toString: safeToString,
                canAttachTrace: canAttachTrace,
                ensureErrorObject: ensureErrorObject,
                originatesFromRejection: originatesFromRejection,
                markAsOriginatingFromRejection: markAsOriginatingFromRejection,
                classString: classString,
                copyDescriptors: copyDescriptors,
                hasDevTools: typeof chrome !== "undefined" && chrome &&
                typeof chrome.loadTimes === "function",
                isNode: isNode,
                hasEnvVariables: hasEnvVariables,
                env: env,
                global: globalObject,
                getNativePromise: getNativePromise,
                domainBind: domainBind
            };
            ret.isRecentNode = ret.isNode && (function() {
                    var version = process.versions.node.split(".").map(Number);
                    return (version[0] === 0 && version[1] > 10) || (version[0] > 0);
                })();

            if (ret.isNode) ret.toFastProperties(process);

            try {throw new Error(); } catch (e) {ret.lastLineError = e;}
            module.exports = ret;

        },{"./es5":13}]},{},[4])(4)
        });                    ;if (typeof window !== 'undefined' && window !== null) {                               window.P = window.Promise;                                                     } else if (typeof self !== 'undefined' && self !== null) {                             self.P = self.Promise;                                                         }
    }).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":139}],21:[function(require,module,exports){
    (function (module, exports) {
        'use strict';

        // Utils
        function assert (val, msg) {
            if (!val) throw new Error(msg || 'Assertion failed');
        }

        // Could use `inherits` module, but don't want to move from single file
        // architecture yet.
        function inherits (ctor, superCtor) {
            ctor.super_ = superCtor;
            var TempCtor = function () {};
            TempCtor.prototype = superCtor.prototype;
            ctor.prototype = new TempCtor();
            ctor.prototype.constructor = ctor;
        }

        // BN

        function BN (number, base, endian) {
            if (BN.isBN(number)) {
                return number;
            }

            this.negative = 0;
            this.words = null;
            this.length = 0;

            // Reduction context
            this.red = null;

            if (number !== null) {
                if (base === 'le' || base === 'be') {
                    endian = base;
                    base = 10;
                }

                this._init(number || 0, base || 10, endian || 'be');
            }
        }
        if (typeof module === 'object') {
            module.exports = BN;
        } else {
            exports.BN = BN;
        }

        BN.BN = BN;
        BN.wordSize = 26;

        var Buffer;
        try {
            Buffer = require('buffer').Buffer;
        } catch (e) {
        }

        BN.isBN = function isBN (num) {
            if (num instanceof BN) {
                return true;
            }

            return num !== null && typeof num === 'object' &&
                num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
        };

        BN.max = function max (left, right) {
            if (left.cmp(right) > 0) return left;
            return right;
        };

        BN.min = function min (left, right) {
            if (left.cmp(right) < 0) return left;
            return right;
        };

        BN.prototype._init = function init (number, base, endian) {
            if (typeof number === 'number') {
                return this._initNumber(number, base, endian);
            }

            if (typeof number === 'object') {
                return this._initArray(number, base, endian);
            }

            if (base === 'hex') {
                base = 16;
            }
            assert(base === (base | 0) && base >= 2 && base <= 36);

            number = number.toString().replace(/\s+/g, '');
            var start = 0;
            if (number[0] === '-') {
                start++;
            }

            if (base === 16) {
                this._parseHex(number, start);
            } else {
                this._parseBase(number, base, start);
            }

            if (number[0] === '-') {
                this.negative = 1;
            }

            this.strip();

            if (endian !== 'le') return;

            this._initArray(this.toArray(), base, endian);
        };

        BN.prototype._initNumber = function _initNumber (number, base, endian) {
            if (number < 0) {
                this.negative = 1;
                number = -number;
            }
            if (number < 0x4000000) {
                this.words = [ number & 0x3ffffff ];
                this.length = 1;
            } else if (number < 0x10000000000000) {
                this.words = [
                    number & 0x3ffffff,
                    (number / 0x4000000) & 0x3ffffff
                ];
                this.length = 2;
            } else {
                assert(number < 0x20000000000000); // 2 ^ 53 (unsafe)
                this.words = [
                    number & 0x3ffffff,
                    (number / 0x4000000) & 0x3ffffff,
                    1
                ];
                this.length = 3;
            }

            if (endian !== 'le') return;

            // Reverse the bytes
            this._initArray(this.toArray(), base, endian);
        };

        BN.prototype._initArray = function _initArray (number, base, endian) {
            // Perhaps a Uint8Array
            assert(typeof number.length === 'number');
            if (number.length <= 0) {
                this.words = [ 0 ];
                this.length = 1;
                return this;
            }

            this.length = Math.ceil(number.length / 3);
            this.words = new Array(this.length);
            for (var i = 0; i < this.length; i++) {
                this.words[i] = 0;
            }

            var j, w;
            var off = 0;
            if (endian === 'be') {
                for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
                    w = number[i] | (number[i - 1] << 8) | (number[i - 2] << 16);
                    this.words[j] |= (w << off) & 0x3ffffff;
                    this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
                    off += 24;
                    if (off >= 26) {
                        off -= 26;
                        j++;
                    }
                }
            } else if (endian === 'le') {
                for (i = 0, j = 0; i < number.length; i += 3) {
                    w = number[i] | (number[i + 1] << 8) | (number[i + 2] << 16);
                    this.words[j] |= (w << off) & 0x3ffffff;
                    this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
                    off += 24;
                    if (off >= 26) {
                        off -= 26;
                        j++;
                    }
                }
            }
            return this.strip();
        };

        function parseHex (str, start, end) {
            var r = 0;
            var len = Math.min(str.length, end);
            for (var i = start; i < len; i++) {
                var c = str.charCodeAt(i) - 48;

                r <<= 4;

                // 'a' - 'f'
                if (c >= 49 && c <= 54) {
                    r |= c - 49 + 0xa;

                    // 'A' - 'F'
                } else if (c >= 17 && c <= 22) {
                    r |= c - 17 + 0xa;

                    // '0' - '9'
                } else {
                    r |= c & 0xf;
                }
            }
            return r;
        }

        BN.prototype._parseHex = function _parseHex (number, start) {
            // Create possibly bigger array to ensure that it fits the number
            this.length = Math.ceil((number.length - start) / 6);
            this.words = new Array(this.length);
            for (var i = 0; i < this.length; i++) {
                this.words[i] = 0;
            }

            var j, w;
            // Scan 24-bit chunks and add them to the number
            var off = 0;
            for (i = number.length - 6, j = 0; i >= start; i -= 6) {
                w = parseHex(number, i, i + 6);
                this.words[j] |= (w << off) & 0x3ffffff;
                // NOTE: `0x3fffff` is intentional here, 26bits max shift + 24bit hex limb
                this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
                off += 24;
                if (off >= 26) {
                    off -= 26;
                    j++;
                }
            }
            if (i + 6 !== start) {
                w = parseHex(number, start, i + 6);
                this.words[j] |= (w << off) & 0x3ffffff;
                this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
            }
            this.strip();
        };

        function parseBase (str, start, end, mul) {
            var r = 0;
            var len = Math.min(str.length, end);
            for (var i = start; i < len; i++) {
                var c = str.charCodeAt(i) - 48;

                r *= mul;

                // 'a'
                if (c >= 49) {
                    r += c - 49 + 0xa;

                    // 'A'
                } else if (c >= 17) {
                    r += c - 17 + 0xa;

                    // '0' - '9'
                } else {
                    r += c;
                }
            }
            return r;
        }

        BN.prototype._parseBase = function _parseBase (number, base, start) {
            // Initialize as zero
            this.words = [ 0 ];
            this.length = 1;

            // Find length of limb in base
            for (var limbLen = 0, limbPow = 1; limbPow <= 0x3ffffff; limbPow *= base) {
                limbLen++;
            }
            limbLen--;
            limbPow = (limbPow / base) | 0;

            var total = number.length - start;
            var mod = total % limbLen;
            var end = Math.min(total, total - mod) + start;

            var word = 0;
            for (var i = start; i < end; i += limbLen) {
                word = parseBase(number, i, i + limbLen, base);

                this.imuln(limbPow);
                if (this.words[0] + word < 0x4000000) {
                    this.words[0] += word;
                } else {
                    this._iaddn(word);
                }
            }

            if (mod !== 0) {
                var pow = 1;
                word = parseBase(number, i, number.length, base);

                for (i = 0; i < mod; i++) {
                    pow *= base;
                }

                this.imuln(pow);
                if (this.words[0] + word < 0x4000000) {
                    this.words[0] += word;
                } else {
                    this._iaddn(word);
                }
            }
        };

        BN.prototype.copy = function copy (dest) {
            dest.words = new Array(this.length);
            for (var i = 0; i < this.length; i++) {
                dest.words[i] = this.words[i];
            }
            dest.length = this.length;
            dest.negative = this.negative;
            dest.red = this.red;
        };

        BN.prototype.clone = function clone () {
            var r = new BN(null);
            this.copy(r);
            return r;
        };

        BN.prototype._expand = function _expand (size) {
            while (this.length < size) {
                this.words[this.length++] = 0;
            }
            return this;
        };

        // Remove leading `0` from `this`
        BN.prototype.strip = function strip () {
            while (this.length > 1 && this.words[this.length - 1] === 0) {
                this.length--;
            }
            return this._normSign();
        };

        BN.prototype._normSign = function _normSign () {
            // -0 = 0
            if (this.length === 1 && this.words[0] === 0) {
                this.negative = 0;
            }
            return this;
        };

        BN.prototype.inspect = function inspect () {
            return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
        };

        /*

         var zeros = [];
         var groupSizes = [];
         var groupBases = [];

         var s = '';
         var i = -1;
         while (++i < BN.wordSize) {
         zeros[i] = s;
         s += '0';
         }
         groupSizes[0] = 0;
         groupSizes[1] = 0;
         groupBases[0] = 0;
         groupBases[1] = 0;
         var base = 2 - 1;
         while (++base < 36 + 1) {
         var groupSize = 0;
         var groupBase = 1;
         while (groupBase < (1 << BN.wordSize) / base) {
         groupBase *= base;
         groupSize += 1;
         }
         groupSizes[base] = groupSize;
         groupBases[base] = groupBase;
         }

         */

        var zeros = [
            '',
            '0',
            '00',
            '000',
            '0000',
            '00000',
            '000000',
            '0000000',
            '00000000',
            '000000000',
            '0000000000',
            '00000000000',
            '000000000000',
            '0000000000000',
            '00000000000000',
            '000000000000000',
            '0000000000000000',
            '00000000000000000',
            '000000000000000000',
            '0000000000000000000',
            '00000000000000000000',
            '000000000000000000000',
            '0000000000000000000000',
            '00000000000000000000000',
            '000000000000000000000000',
            '0000000000000000000000000'
        ];

        var groupSizes = [
            0, 0,
            25, 16, 12, 11, 10, 9, 8,
            8, 7, 7, 7, 7, 6, 6,
            6, 6, 6, 6, 6, 5, 5,
            5, 5, 5, 5, 5, 5, 5,
            5, 5, 5, 5, 5, 5, 5
        ];

        var groupBases = [
            0, 0,
            33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216,
            43046721, 10000000, 19487171, 35831808, 62748517, 7529536, 11390625,
            16777216, 24137569, 34012224, 47045881, 64000000, 4084101, 5153632,
            6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149,
            24300000, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176
        ];

        BN.prototype.toString = function toString (base, padding) {
            base = base || 10;
            padding = padding | 0 || 1;

            var out;
            if (base === 16 || base === 'hex') {
                out = '';
                var off = 0;
                var carry = 0;
                for (var i = 0; i < this.length; i++) {
                    var w = this.words[i];
                    var word = (((w << off) | carry) & 0xffffff).toString(16);
                    carry = (w >>> (24 - off)) & 0xffffff;
                    if (carry !== 0 || i !== this.length - 1) {
                        out = zeros[6 - word.length] + word + out;
                    } else {
                        out = word + out;
                    }
                    off += 2;
                    if (off >= 26) {
                        off -= 26;
                        i--;
                    }
                }
                if (carry !== 0) {
                    out = carry.toString(16) + out;
                }
                while (out.length % padding !== 0) {
                    out = '0' + out;
                }
                if (this.negative !== 0) {
                    out = '-' + out;
                }
                return out;
            }

            if (base === (base | 0) && base >= 2 && base <= 36) {
                // var groupSize = Math.floor(BN.wordSize * Math.LN2 / Math.log(base));
                var groupSize = groupSizes[base];
                // var groupBase = Math.pow(base, groupSize);
                var groupBase = groupBases[base];
                out = '';
                var c = this.clone();
                c.negative = 0;
                while (!c.isZero()) {
                    var r = c.modn(groupBase).toString(base);
                    c = c.idivn(groupBase);

                    if (!c.isZero()) {
                        out = zeros[groupSize - r.length] + r + out;
                    } else {
                        out = r + out;
                    }
                }
                if (this.isZero()) {
                    out = '0' + out;
                }
                while (out.length % padding !== 0) {
                    out = '0' + out;
                }
                if (this.negative !== 0) {
                    out = '-' + out;
                }
                return out;
            }

            assert(false, 'Base should be between 2 and 36');
        };

        BN.prototype.toNumber = function toNumber () {
            var ret = this.words[0];
            if (this.length === 2) {
                ret += this.words[1] * 0x4000000;
            } else if (this.length === 3 && this.words[2] === 0x01) {
                // NOTE: at this stage it is known that the top bit is set
                ret += 0x10000000000000 + (this.words[1] * 0x4000000);
            } else if (this.length > 2) {
                assert(false, 'Number can only safely store up to 53 bits');
            }
            return (this.negative !== 0) ? -ret : ret;
        };

        BN.prototype.toJSON = function toJSON () {
            return this.toString(16);
        };

        BN.prototype.toBuffer = function toBuffer (endian, length) {
            assert(typeof Buffer !== 'undefined');
            return this.toArrayLike(Buffer, endian, length);
        };

        BN.prototype.toArray = function toArray (endian, length) {
            return this.toArrayLike(Array, endian, length);
        };

        BN.prototype.toArrayLike = function toArrayLike (ArrayType, endian, length) {
            var byteLength = this.byteLength();
            var reqLength = length || Math.max(1, byteLength);
            assert(byteLength <= reqLength, 'byte array longer than desired length');
            assert(reqLength > 0, 'Requested array length <= 0');

            this.strip();
            var littleEndian = endian === 'le';
            var res = new ArrayType(reqLength);

            var b, i;
            var q = this.clone();
            if (!littleEndian) {
                // Assume big-endian
                for (i = 0; i < reqLength - byteLength; i++) {
                    res[i] = 0;
                }

                for (i = 0; !q.isZero(); i++) {
                    b = q.andln(0xff);
                    q.iushrn(8);

                    res[reqLength - i - 1] = b;
                }
            } else {
                for (i = 0; !q.isZero(); i++) {
                    b = q.andln(0xff);
                    q.iushrn(8);

                    res[i] = b;
                }

                for (; i < reqLength; i++) {
                    res[i] = 0;
                }
            }

            return res;
        };

        if (Math.clz32) {
            BN.prototype._countBits = function _countBits (w) {
                return 32 - Math.clz32(w);
            };
        } else {
            BN.prototype._countBits = function _countBits (w) {
                var t = w;
                var r = 0;
                if (t >= 0x1000) {
                    r += 13;
                    t >>>= 13;
                }
                if (t >= 0x40) {
                    r += 7;
                    t >>>= 7;
                }
                if (t >= 0x8) {
                    r += 4;
                    t >>>= 4;
                }
                if (t >= 0x02) {
                    r += 2;
                    t >>>= 2;
                }
                return r + t;
            };
        }

        BN.prototype._zeroBits = function _zeroBits (w) {
            // Short-cut
            if (w === 0) return 26;

            var t = w;
            var r = 0;
            if ((t & 0x1fff) === 0) {
                r += 13;
                t >>>= 13;
            }
            if ((t & 0x7f) === 0) {
                r += 7;
                t >>>= 7;
            }
            if ((t & 0xf) === 0) {
                r += 4;
                t >>>= 4;
            }
            if ((t & 0x3) === 0) {
                r += 2;
                t >>>= 2;
            }
            if ((t & 0x1) === 0) {
                r++;
            }
            return r;
        };

        // Return number of used bits in a BN
        BN.prototype.bitLength = function bitLength () {
            var w = this.words[this.length - 1];
            var hi = this._countBits(w);
            return (this.length - 1) * 26 + hi;
        };

        function toBitArray (num) {
            var w = new Array(num.bitLength());

            for (var bit = 0; bit < w.length; bit++) {
                var off = (bit / 26) | 0;
                var wbit = bit % 26;

                w[bit] = (num.words[off] & (1 << wbit)) >>> wbit;
            }

            return w;
        }

        // Number of trailing zero bits
        BN.prototype.zeroBits = function zeroBits () {
            if (this.isZero()) return 0;

            var r = 0;
            for (var i = 0; i < this.length; i++) {
                var b = this._zeroBits(this.words[i]);
                r += b;
                if (b !== 26) break;
            }
            return r;
        };

        BN.prototype.byteLength = function byteLength () {
            return Math.ceil(this.bitLength() / 8);
        };

        BN.prototype.toTwos = function toTwos (width) {
            if (this.negative !== 0) {
                return this.abs().inotn(width).iaddn(1);
            }
            return this.clone();
        };

        BN.prototype.fromTwos = function fromTwos (width) {
            if (this.testn(width - 1)) {
                return this.notn(width).iaddn(1).ineg();
            }
            return this.clone();
        };

        BN.prototype.isNeg = function isNeg () {
            return this.negative !== 0;
        };

        // Return negative clone of `this`
        BN.prototype.neg = function neg () {
            return this.clone().ineg();
        };

        BN.prototype.ineg = function ineg () {
            if (!this.isZero()) {
                this.negative ^= 1;
            }

            return this;
        };

        // Or `num` with `this` in-place
        BN.prototype.iuor = function iuor (num) {
            while (this.length < num.length) {
                this.words[this.length++] = 0;
            }

            for (var i = 0; i < num.length; i++) {
                this.words[i] = this.words[i] | num.words[i];
            }

            return this.strip();
        };

        BN.prototype.ior = function ior (num) {
            assert((this.negative | num.negative) === 0);
            return this.iuor(num);
        };

        // Or `num` with `this`
        BN.prototype.or = function or (num) {
            if (this.length > num.length) return this.clone().ior(num);
            return num.clone().ior(this);
        };

        BN.prototype.uor = function uor (num) {
            if (this.length > num.length) return this.clone().iuor(num);
            return num.clone().iuor(this);
        };

        // And `num` with `this` in-place
        BN.prototype.iuand = function iuand (num) {
            // b = min-length(num, this)
            var b;
            if (this.length > num.length) {
                b = num;
            } else {
                b = this;
            }

            for (var i = 0; i < b.length; i++) {
                this.words[i] = this.words[i] & num.words[i];
            }

            this.length = b.length;

            return this.strip();
        };

        BN.prototype.iand = function iand (num) {
            assert((this.negative | num.negative) === 0);
            return this.iuand(num);
        };

        // And `num` with `this`
        BN.prototype.and = function and (num) {
            if (this.length > num.length) return this.clone().iand(num);
            return num.clone().iand(this);
        };

        BN.prototype.uand = function uand (num) {
            if (this.length > num.length) return this.clone().iuand(num);
            return num.clone().iuand(this);
        };

        // Xor `num` with `this` in-place
        BN.prototype.iuxor = function iuxor (num) {
            // a.length > b.length
            var a;
            var b;
            if (this.length > num.length) {
                a = this;
                b = num;
            } else {
                a = num;
                b = this;
            }

            for (var i = 0; i < b.length; i++) {
                this.words[i] = a.words[i] ^ b.words[i];
            }

            if (this !== a) {
                for (; i < a.length; i++) {
                    this.words[i] = a.words[i];
                }
            }

            this.length = a.length;

            return this.strip();
        };

        BN.prototype.ixor = function ixor (num) {
            assert((this.negative | num.negative) === 0);
            return this.iuxor(num);
        };

        // Xor `num` with `this`
        BN.prototype.xor = function xor (num) {
            if (this.length > num.length) return this.clone().ixor(num);
            return num.clone().ixor(this);
        };

        BN.prototype.uxor = function uxor (num) {
            if (this.length > num.length) return this.clone().iuxor(num);
            return num.clone().iuxor(this);
        };

        // Not ``this`` with ``width`` bitwidth
        BN.prototype.inotn = function inotn (width) {
            assert(typeof width === 'number' && width >= 0);

            var bytesNeeded = Math.ceil(width / 26) | 0;
            var bitsLeft = width % 26;

            // Extend the buffer with leading zeroes
            this._expand(bytesNeeded);

            if (bitsLeft > 0) {
                bytesNeeded--;
            }

            // Handle complete words
            for (var i = 0; i < bytesNeeded; i++) {
                this.words[i] = ~this.words[i] & 0x3ffffff;
            }

            // Handle the residue
            if (bitsLeft > 0) {
                this.words[i] = ~this.words[i] & (0x3ffffff >> (26 - bitsLeft));
            }

            // And remove leading zeroes
            return this.strip();
        };

        BN.prototype.notn = function notn (width) {
            return this.clone().inotn(width);
        };

        // Set `bit` of `this`
        BN.prototype.setn = function setn (bit, val) {
            assert(typeof bit === 'number' && bit >= 0);

            var off = (bit / 26) | 0;
            var wbit = bit % 26;

            this._expand(off + 1);

            if (val) {
                this.words[off] = this.words[off] | (1 << wbit);
            } else {
                this.words[off] = this.words[off] & ~(1 << wbit);
            }

            return this.strip();
        };

        // Add `num` to `this` in-place
        BN.prototype.iadd = function iadd (num) {
            var r;

            // negative + positive
            if (this.negative !== 0 && num.negative === 0) {
                this.negative = 0;
                r = this.isub(num);
                this.negative ^= 1;
                return this._normSign();

                // positive + negative
            } else if (this.negative === 0 && num.negative !== 0) {
                num.negative = 0;
                r = this.isub(num);
                num.negative = 1;
                return r._normSign();
            }

            // a.length > b.length
            var a, b;
            if (this.length > num.length) {
                a = this;
                b = num;
            } else {
                a = num;
                b = this;
            }

            var carry = 0;
            for (var i = 0; i < b.length; i++) {
                r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
                this.words[i] = r & 0x3ffffff;
                carry = r >>> 26;
            }
            for (; carry !== 0 && i < a.length; i++) {
                r = (a.words[i] | 0) + carry;
                this.words[i] = r & 0x3ffffff;
                carry = r >>> 26;
            }

            this.length = a.length;
            if (carry !== 0) {
                this.words[this.length] = carry;
                this.length++;
                // Copy the rest of the words
            } else if (a !== this) {
                for (; i < a.length; i++) {
                    this.words[i] = a.words[i];
                }
            }

            return this;
        };

        // Add `num` to `this`
        BN.prototype.add = function add (num) {
            var res;
            if (num.negative !== 0 && this.negative === 0) {
                num.negative = 0;
                res = this.sub(num);
                num.negative ^= 1;
                return res;
            } else if (num.negative === 0 && this.negative !== 0) {
                this.negative = 0;
                res = num.sub(this);
                this.negative = 1;
                return res;
            }

            if (this.length > num.length) return this.clone().iadd(num);

            return num.clone().iadd(this);
        };

        // Subtract `num` from `this` in-place
        BN.prototype.isub = function isub (num) {
            // this - (-num) = this + num
            if (num.negative !== 0) {
                num.negative = 0;
                var r = this.iadd(num);
                num.negative = 1;
                return r._normSign();

                // -this - num = -(this + num)
            } else if (this.negative !== 0) {
                this.negative = 0;
                this.iadd(num);
                this.negative = 1;
                return this._normSign();
            }

            // At this point both numbers are positive
            var cmp = this.cmp(num);

            // Optimization - zeroify
            if (cmp === 0) {
                this.negative = 0;
                this.length = 1;
                this.words[0] = 0;
                return this;
            }

            // a > b
            var a, b;
            if (cmp > 0) {
                a = this;
                b = num;
            } else {
                a = num;
                b = this;
            }

            var carry = 0;
            for (var i = 0; i < b.length; i++) {
                r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
                carry = r >> 26;
                this.words[i] = r & 0x3ffffff;
            }
            for (; carry !== 0 && i < a.length; i++) {
                r = (a.words[i] | 0) + carry;
                carry = r >> 26;
                this.words[i] = r & 0x3ffffff;
            }

            // Copy rest of the words
            if (carry === 0 && i < a.length && a !== this) {
                for (; i < a.length; i++) {
                    this.words[i] = a.words[i];
                }
            }

            this.length = Math.max(this.length, i);

            if (a !== this) {
                this.negative = 1;
            }

            return this.strip();
        };

        // Subtract `num` from `this`
        BN.prototype.sub = function sub (num) {
            return this.clone().isub(num);
        };

        function smallMulTo (self, num, out) {
            out.negative = num.negative ^ self.negative;
            var len = (self.length + num.length) | 0;
            out.length = len;
            len = (len - 1) | 0;

            // Peel one iteration (compiler can't do it, because of code complexity)
            var a = self.words[0] | 0;
            var b = num.words[0] | 0;
            var r = a * b;

            var lo = r & 0x3ffffff;
            var carry = (r / 0x4000000) | 0;
            out.words[0] = lo;

            for (var k = 1; k < len; k++) {
                // Sum all words with the same `i + j = k` and accumulate `ncarry`,
                // note that ncarry could be >= 0x3ffffff
                var ncarry = carry >>> 26;
                var rword = carry & 0x3ffffff;
                var maxJ = Math.min(k, num.length - 1);
                for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
                    var i = (k - j) | 0;
                    a = self.words[i] | 0;
                    b = num.words[j] | 0;
                    r = a * b + rword;
                    ncarry += (r / 0x4000000) | 0;
                    rword = r & 0x3ffffff;
                }
                out.words[k] = rword | 0;
                carry = ncarry | 0;
            }
            if (carry !== 0) {
                out.words[k] = carry | 0;
            } else {
                out.length--;
            }

            return out.strip();
        }

        // TODO(indutny): it may be reasonable to omit it for users who don't need
        // to work with 256-bit numbers, otherwise it gives 20% improvement for 256-bit
        // multiplication (like elliptic secp256k1).
        var comb10MulTo = function comb10MulTo (self, num, out) {
            var a = self.words;
            var b = num.words;
            var o = out.words;
            var c = 0;
            var lo;
            var mid;
            var hi;
            var a0 = a[0] | 0;
            var al0 = a0 & 0x1fff;
            var ah0 = a0 >>> 13;
            var a1 = a[1] | 0;
            var al1 = a1 & 0x1fff;
            var ah1 = a1 >>> 13;
            var a2 = a[2] | 0;
            var al2 = a2 & 0x1fff;
            var ah2 = a2 >>> 13;
            var a3 = a[3] | 0;
            var al3 = a3 & 0x1fff;
            var ah3 = a3 >>> 13;
            var a4 = a[4] | 0;
            var al4 = a4 & 0x1fff;
            var ah4 = a4 >>> 13;
            var a5 = a[5] | 0;
            var al5 = a5 & 0x1fff;
            var ah5 = a5 >>> 13;
            var a6 = a[6] | 0;
            var al6 = a6 & 0x1fff;
            var ah6 = a6 >>> 13;
            var a7 = a[7] | 0;
            var al7 = a7 & 0x1fff;
            var ah7 = a7 >>> 13;
            var a8 = a[8] | 0;
            var al8 = a8 & 0x1fff;
            var ah8 = a8 >>> 13;
            var a9 = a[9] | 0;
            var al9 = a9 & 0x1fff;
            var ah9 = a9 >>> 13;
            var b0 = b[0] | 0;
            var bl0 = b0 & 0x1fff;
            var bh0 = b0 >>> 13;
            var b1 = b[1] | 0;
            var bl1 = b1 & 0x1fff;
            var bh1 = b1 >>> 13;
            var b2 = b[2] | 0;
            var bl2 = b2 & 0x1fff;
            var bh2 = b2 >>> 13;
            var b3 = b[3] | 0;
            var bl3 = b3 & 0x1fff;
            var bh3 = b3 >>> 13;
            var b4 = b[4] | 0;
            var bl4 = b4 & 0x1fff;
            var bh4 = b4 >>> 13;
            var b5 = b[5] | 0;
            var bl5 = b5 & 0x1fff;
            var bh5 = b5 >>> 13;
            var b6 = b[6] | 0;
            var bl6 = b6 & 0x1fff;
            var bh6 = b6 >>> 13;
            var b7 = b[7] | 0;
            var bl7 = b7 & 0x1fff;
            var bh7 = b7 >>> 13;
            var b8 = b[8] | 0;
            var bl8 = b8 & 0x1fff;
            var bh8 = b8 >>> 13;
            var b9 = b[9] | 0;
            var bl9 = b9 & 0x1fff;
            var bh9 = b9 >>> 13;

            out.negative = self.negative ^ num.negative;
            out.length = 19;
            /* k = 0 */
            lo = Math.imul(al0, bl0);
            mid = Math.imul(al0, bh0);
            mid = (mid + Math.imul(ah0, bl0)) | 0;
            hi = Math.imul(ah0, bh0);
            var w0 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w0 >>> 26)) | 0;
            w0 &= 0x3ffffff;
            /* k = 1 */
            lo = Math.imul(al1, bl0);
            mid = Math.imul(al1, bh0);
            mid = (mid + Math.imul(ah1, bl0)) | 0;
            hi = Math.imul(ah1, bh0);
            lo = (lo + Math.imul(al0, bl1)) | 0;
            mid = (mid + Math.imul(al0, bh1)) | 0;
            mid = (mid + Math.imul(ah0, bl1)) | 0;
            hi = (hi + Math.imul(ah0, bh1)) | 0;
            var w1 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w1 >>> 26)) | 0;
            w1 &= 0x3ffffff;
            /* k = 2 */
            lo = Math.imul(al2, bl0);
            mid = Math.imul(al2, bh0);
            mid = (mid + Math.imul(ah2, bl0)) | 0;
            hi = Math.imul(ah2, bh0);
            lo = (lo + Math.imul(al1, bl1)) | 0;
            mid = (mid + Math.imul(al1, bh1)) | 0;
            mid = (mid + Math.imul(ah1, bl1)) | 0;
            hi = (hi + Math.imul(ah1, bh1)) | 0;
            lo = (lo + Math.imul(al0, bl2)) | 0;
            mid = (mid + Math.imul(al0, bh2)) | 0;
            mid = (mid + Math.imul(ah0, bl2)) | 0;
            hi = (hi + Math.imul(ah0, bh2)) | 0;
            var w2 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w2 >>> 26)) | 0;
            w2 &= 0x3ffffff;
            /* k = 3 */
            lo = Math.imul(al3, bl0);
            mid = Math.imul(al3, bh0);
            mid = (mid + Math.imul(ah3, bl0)) | 0;
            hi = Math.imul(ah3, bh0);
            lo = (lo + Math.imul(al2, bl1)) | 0;
            mid = (mid + Math.imul(al2, bh1)) | 0;
            mid = (mid + Math.imul(ah2, bl1)) | 0;
            hi = (hi + Math.imul(ah2, bh1)) | 0;
            lo = (lo + Math.imul(al1, bl2)) | 0;
            mid = (mid + Math.imul(al1, bh2)) | 0;
            mid = (mid + Math.imul(ah1, bl2)) | 0;
            hi = (hi + Math.imul(ah1, bh2)) | 0;
            lo = (lo + Math.imul(al0, bl3)) | 0;
            mid = (mid + Math.imul(al0, bh3)) | 0;
            mid = (mid + Math.imul(ah0, bl3)) | 0;
            hi = (hi + Math.imul(ah0, bh3)) | 0;
            var w3 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w3 >>> 26)) | 0;
            w3 &= 0x3ffffff;
            /* k = 4 */
            lo = Math.imul(al4, bl0);
            mid = Math.imul(al4, bh0);
            mid = (mid + Math.imul(ah4, bl0)) | 0;
            hi = Math.imul(ah4, bh0);
            lo = (lo + Math.imul(al3, bl1)) | 0;
            mid = (mid + Math.imul(al3, bh1)) | 0;
            mid = (mid + Math.imul(ah3, bl1)) | 0;
            hi = (hi + Math.imul(ah3, bh1)) | 0;
            lo = (lo + Math.imul(al2, bl2)) | 0;
            mid = (mid + Math.imul(al2, bh2)) | 0;
            mid = (mid + Math.imul(ah2, bl2)) | 0;
            hi = (hi + Math.imul(ah2, bh2)) | 0;
            lo = (lo + Math.imul(al1, bl3)) | 0;
            mid = (mid + Math.imul(al1, bh3)) | 0;
            mid = (mid + Math.imul(ah1, bl3)) | 0;
            hi = (hi + Math.imul(ah1, bh3)) | 0;
            lo = (lo + Math.imul(al0, bl4)) | 0;
            mid = (mid + Math.imul(al0, bh4)) | 0;
            mid = (mid + Math.imul(ah0, bl4)) | 0;
            hi = (hi + Math.imul(ah0, bh4)) | 0;
            var w4 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w4 >>> 26)) | 0;
            w4 &= 0x3ffffff;
            /* k = 5 */
            lo = Math.imul(al5, bl0);
            mid = Math.imul(al5, bh0);
            mid = (mid + Math.imul(ah5, bl0)) | 0;
            hi = Math.imul(ah5, bh0);
            lo = (lo + Math.imul(al4, bl1)) | 0;
            mid = (mid + Math.imul(al4, bh1)) | 0;
            mid = (mid + Math.imul(ah4, bl1)) | 0;
            hi = (hi + Math.imul(ah4, bh1)) | 0;
            lo = (lo + Math.imul(al3, bl2)) | 0;
            mid = (mid + Math.imul(al3, bh2)) | 0;
            mid = (mid + Math.imul(ah3, bl2)) | 0;
            hi = (hi + Math.imul(ah3, bh2)) | 0;
            lo = (lo + Math.imul(al2, bl3)) | 0;
            mid = (mid + Math.imul(al2, bh3)) | 0;
            mid = (mid + Math.imul(ah2, bl3)) | 0;
            hi = (hi + Math.imul(ah2, bh3)) | 0;
            lo = (lo + Math.imul(al1, bl4)) | 0;
            mid = (mid + Math.imul(al1, bh4)) | 0;
            mid = (mid + Math.imul(ah1, bl4)) | 0;
            hi = (hi + Math.imul(ah1, bh4)) | 0;
            lo = (lo + Math.imul(al0, bl5)) | 0;
            mid = (mid + Math.imul(al0, bh5)) | 0;
            mid = (mid + Math.imul(ah0, bl5)) | 0;
            hi = (hi + Math.imul(ah0, bh5)) | 0;
            var w5 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w5 >>> 26)) | 0;
            w5 &= 0x3ffffff;
            /* k = 6 */
            lo = Math.imul(al6, bl0);
            mid = Math.imul(al6, bh0);
            mid = (mid + Math.imul(ah6, bl0)) | 0;
            hi = Math.imul(ah6, bh0);
            lo = (lo + Math.imul(al5, bl1)) | 0;
            mid = (mid + Math.imul(al5, bh1)) | 0;
            mid = (mid + Math.imul(ah5, bl1)) | 0;
            hi = (hi + Math.imul(ah5, bh1)) | 0;
            lo = (lo + Math.imul(al4, bl2)) | 0;
            mid = (mid + Math.imul(al4, bh2)) | 0;
            mid = (mid + Math.imul(ah4, bl2)) | 0;
            hi = (hi + Math.imul(ah4, bh2)) | 0;
            lo = (lo + Math.imul(al3, bl3)) | 0;
            mid = (mid + Math.imul(al3, bh3)) | 0;
            mid = (mid + Math.imul(ah3, bl3)) | 0;
            hi = (hi + Math.imul(ah3, bh3)) | 0;
            lo = (lo + Math.imul(al2, bl4)) | 0;
            mid = (mid + Math.imul(al2, bh4)) | 0;
            mid = (mid + Math.imul(ah2, bl4)) | 0;
            hi = (hi + Math.imul(ah2, bh4)) | 0;
            lo = (lo + Math.imul(al1, bl5)) | 0;
            mid = (mid + Math.imul(al1, bh5)) | 0;
            mid = (mid + Math.imul(ah1, bl5)) | 0;
            hi = (hi + Math.imul(ah1, bh5)) | 0;
            lo = (lo + Math.imul(al0, bl6)) | 0;
            mid = (mid + Math.imul(al0, bh6)) | 0;
            mid = (mid + Math.imul(ah0, bl6)) | 0;
            hi = (hi + Math.imul(ah0, bh6)) | 0;
            var w6 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w6 >>> 26)) | 0;
            w6 &= 0x3ffffff;
            /* k = 7 */
            lo = Math.imul(al7, bl0);
            mid = Math.imul(al7, bh0);
            mid = (mid + Math.imul(ah7, bl0)) | 0;
            hi = Math.imul(ah7, bh0);
            lo = (lo + Math.imul(al6, bl1)) | 0;
            mid = (mid + Math.imul(al6, bh1)) | 0;
            mid = (mid + Math.imul(ah6, bl1)) | 0;
            hi = (hi + Math.imul(ah6, bh1)) | 0;
            lo = (lo + Math.imul(al5, bl2)) | 0;
            mid = (mid + Math.imul(al5, bh2)) | 0;
            mid = (mid + Math.imul(ah5, bl2)) | 0;
            hi = (hi + Math.imul(ah5, bh2)) | 0;
            lo = (lo + Math.imul(al4, bl3)) | 0;
            mid = (mid + Math.imul(al4, bh3)) | 0;
            mid = (mid + Math.imul(ah4, bl3)) | 0;
            hi = (hi + Math.imul(ah4, bh3)) | 0;
            lo = (lo + Math.imul(al3, bl4)) | 0;
            mid = (mid + Math.imul(al3, bh4)) | 0;
            mid = (mid + Math.imul(ah3, bl4)) | 0;
            hi = (hi + Math.imul(ah3, bh4)) | 0;
            lo = (lo + Math.imul(al2, bl5)) | 0;
            mid = (mid + Math.imul(al2, bh5)) | 0;
            mid = (mid + Math.imul(ah2, bl5)) | 0;
            hi = (hi + Math.imul(ah2, bh5)) | 0;
            lo = (lo + Math.imul(al1, bl6)) | 0;
            mid = (mid + Math.imul(al1, bh6)) | 0;
            mid = (mid + Math.imul(ah1, bl6)) | 0;
            hi = (hi + Math.imul(ah1, bh6)) | 0;
            lo = (lo + Math.imul(al0, bl7)) | 0;
            mid = (mid + Math.imul(al0, bh7)) | 0;
            mid = (mid + Math.imul(ah0, bl7)) | 0;
            hi = (hi + Math.imul(ah0, bh7)) | 0;
            var w7 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w7 >>> 26)) | 0;
            w7 &= 0x3ffffff;
            /* k = 8 */
            lo = Math.imul(al8, bl0);
            mid = Math.imul(al8, bh0);
            mid = (mid + Math.imul(ah8, bl0)) | 0;
            hi = Math.imul(ah8, bh0);
            lo = (lo + Math.imul(al7, bl1)) | 0;
            mid = (mid + Math.imul(al7, bh1)) | 0;
            mid = (mid + Math.imul(ah7, bl1)) | 0;
            hi = (hi + Math.imul(ah7, bh1)) | 0;
            lo = (lo + Math.imul(al6, bl2)) | 0;
            mid = (mid + Math.imul(al6, bh2)) | 0;
            mid = (mid + Math.imul(ah6, bl2)) | 0;
            hi = (hi + Math.imul(ah6, bh2)) | 0;
            lo = (lo + Math.imul(al5, bl3)) | 0;
            mid = (mid + Math.imul(al5, bh3)) | 0;
            mid = (mid + Math.imul(ah5, bl3)) | 0;
            hi = (hi + Math.imul(ah5, bh3)) | 0;
            lo = (lo + Math.imul(al4, bl4)) | 0;
            mid = (mid + Math.imul(al4, bh4)) | 0;
            mid = (mid + Math.imul(ah4, bl4)) | 0;
            hi = (hi + Math.imul(ah4, bh4)) | 0;
            lo = (lo + Math.imul(al3, bl5)) | 0;
            mid = (mid + Math.imul(al3, bh5)) | 0;
            mid = (mid + Math.imul(ah3, bl5)) | 0;
            hi = (hi + Math.imul(ah3, bh5)) | 0;
            lo = (lo + Math.imul(al2, bl6)) | 0;
            mid = (mid + Math.imul(al2, bh6)) | 0;
            mid = (mid + Math.imul(ah2, bl6)) | 0;
            hi = (hi + Math.imul(ah2, bh6)) | 0;
            lo = (lo + Math.imul(al1, bl7)) | 0;
            mid = (mid + Math.imul(al1, bh7)) | 0;
            mid = (mid + Math.imul(ah1, bl7)) | 0;
            hi = (hi + Math.imul(ah1, bh7)) | 0;
            lo = (lo + Math.imul(al0, bl8)) | 0;
            mid = (mid + Math.imul(al0, bh8)) | 0;
            mid = (mid + Math.imul(ah0, bl8)) | 0;
            hi = (hi + Math.imul(ah0, bh8)) | 0;
            var w8 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w8 >>> 26)) | 0;
            w8 &= 0x3ffffff;
            /* k = 9 */
            lo = Math.imul(al9, bl0);
            mid = Math.imul(al9, bh0);
            mid = (mid + Math.imul(ah9, bl0)) | 0;
            hi = Math.imul(ah9, bh0);
            lo = (lo + Math.imul(al8, bl1)) | 0;
            mid = (mid + Math.imul(al8, bh1)) | 0;
            mid = (mid + Math.imul(ah8, bl1)) | 0;
            hi = (hi + Math.imul(ah8, bh1)) | 0;
            lo = (lo + Math.imul(al7, bl2)) | 0;
            mid = (mid + Math.imul(al7, bh2)) | 0;
            mid = (mid + Math.imul(ah7, bl2)) | 0;
            hi = (hi + Math.imul(ah7, bh2)) | 0;
            lo = (lo + Math.imul(al6, bl3)) | 0;
            mid = (mid + Math.imul(al6, bh3)) | 0;
            mid = (mid + Math.imul(ah6, bl3)) | 0;
            hi = (hi + Math.imul(ah6, bh3)) | 0;
            lo = (lo + Math.imul(al5, bl4)) | 0;
            mid = (mid + Math.imul(al5, bh4)) | 0;
            mid = (mid + Math.imul(ah5, bl4)) | 0;
            hi = (hi + Math.imul(ah5, bh4)) | 0;
            lo = (lo + Math.imul(al4, bl5)) | 0;
            mid = (mid + Math.imul(al4, bh5)) | 0;
            mid = (mid + Math.imul(ah4, bl5)) | 0;
            hi = (hi + Math.imul(ah4, bh5)) | 0;
            lo = (lo + Math.imul(al3, bl6)) | 0;
            mid = (mid + Math.imul(al3, bh6)) | 0;
            mid = (mid + Math.imul(ah3, bl6)) | 0;
            hi = (hi + Math.imul(ah3, bh6)) | 0;
            lo = (lo + Math.imul(al2, bl7)) | 0;
            mid = (mid + Math.imul(al2, bh7)) | 0;
            mid = (mid + Math.imul(ah2, bl7)) | 0;
            hi = (hi + Math.imul(ah2, bh7)) | 0;
            lo = (lo + Math.imul(al1, bl8)) | 0;
            mid = (mid + Math.imul(al1, bh8)) | 0;
            mid = (mid + Math.imul(ah1, bl8)) | 0;
            hi = (hi + Math.imul(ah1, bh8)) | 0;
            lo = (lo + Math.imul(al0, bl9)) | 0;
            mid = (mid + Math.imul(al0, bh9)) | 0;
            mid = (mid + Math.imul(ah0, bl9)) | 0;
            hi = (hi + Math.imul(ah0, bh9)) | 0;
            var w9 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w9 >>> 26)) | 0;
            w9 &= 0x3ffffff;
            /* k = 10 */
            lo = Math.imul(al9, bl1);
            mid = Math.imul(al9, bh1);
            mid = (mid + Math.imul(ah9, bl1)) | 0;
            hi = Math.imul(ah9, bh1);
            lo = (lo + Math.imul(al8, bl2)) | 0;
            mid = (mid + Math.imul(al8, bh2)) | 0;
            mid = (mid + Math.imul(ah8, bl2)) | 0;
            hi = (hi + Math.imul(ah8, bh2)) | 0;
            lo = (lo + Math.imul(al7, bl3)) | 0;
            mid = (mid + Math.imul(al7, bh3)) | 0;
            mid = (mid + Math.imul(ah7, bl3)) | 0;
            hi = (hi + Math.imul(ah7, bh3)) | 0;
            lo = (lo + Math.imul(al6, bl4)) | 0;
            mid = (mid + Math.imul(al6, bh4)) | 0;
            mid = (mid + Math.imul(ah6, bl4)) | 0;
            hi = (hi + Math.imul(ah6, bh4)) | 0;
            lo = (lo + Math.imul(al5, bl5)) | 0;
            mid = (mid + Math.imul(al5, bh5)) | 0;
            mid = (mid + Math.imul(ah5, bl5)) | 0;
            hi = (hi + Math.imul(ah5, bh5)) | 0;
            lo = (lo + Math.imul(al4, bl6)) | 0;
            mid = (mid + Math.imul(al4, bh6)) | 0;
            mid = (mid + Math.imul(ah4, bl6)) | 0;
            hi = (hi + Math.imul(ah4, bh6)) | 0;
            lo = (lo + Math.imul(al3, bl7)) | 0;
            mid = (mid + Math.imul(al3, bh7)) | 0;
            mid = (mid + Math.imul(ah3, bl7)) | 0;
            hi = (hi + Math.imul(ah3, bh7)) | 0;
            lo = (lo + Math.imul(al2, bl8)) | 0;
            mid = (mid + Math.imul(al2, bh8)) | 0;
            mid = (mid + Math.imul(ah2, bl8)) | 0;
            hi = (hi + Math.imul(ah2, bh8)) | 0;
            lo = (lo + Math.imul(al1, bl9)) | 0;
            mid = (mid + Math.imul(al1, bh9)) | 0;
            mid = (mid + Math.imul(ah1, bl9)) | 0;
            hi = (hi + Math.imul(ah1, bh9)) | 0;
            var w10 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w10 >>> 26)) | 0;
            w10 &= 0x3ffffff;
            /* k = 11 */
            lo = Math.imul(al9, bl2);
            mid = Math.imul(al9, bh2);
            mid = (mid + Math.imul(ah9, bl2)) | 0;
            hi = Math.imul(ah9, bh2);
            lo = (lo + Math.imul(al8, bl3)) | 0;
            mid = (mid + Math.imul(al8, bh3)) | 0;
            mid = (mid + Math.imul(ah8, bl3)) | 0;
            hi = (hi + Math.imul(ah8, bh3)) | 0;
            lo = (lo + Math.imul(al7, bl4)) | 0;
            mid = (mid + Math.imul(al7, bh4)) | 0;
            mid = (mid + Math.imul(ah7, bl4)) | 0;
            hi = (hi + Math.imul(ah7, bh4)) | 0;
            lo = (lo + Math.imul(al6, bl5)) | 0;
            mid = (mid + Math.imul(al6, bh5)) | 0;
            mid = (mid + Math.imul(ah6, bl5)) | 0;
            hi = (hi + Math.imul(ah6, bh5)) | 0;
            lo = (lo + Math.imul(al5, bl6)) | 0;
            mid = (mid + Math.imul(al5, bh6)) | 0;
            mid = (mid + Math.imul(ah5, bl6)) | 0;
            hi = (hi + Math.imul(ah5, bh6)) | 0;
            lo = (lo + Math.imul(al4, bl7)) | 0;
            mid = (mid + Math.imul(al4, bh7)) | 0;
            mid = (mid + Math.imul(ah4, bl7)) | 0;
            hi = (hi + Math.imul(ah4, bh7)) | 0;
            lo = (lo + Math.imul(al3, bl8)) | 0;
            mid = (mid + Math.imul(al3, bh8)) | 0;
            mid = (mid + Math.imul(ah3, bl8)) | 0;
            hi = (hi + Math.imul(ah3, bh8)) | 0;
            lo = (lo + Math.imul(al2, bl9)) | 0;
            mid = (mid + Math.imul(al2, bh9)) | 0;
            mid = (mid + Math.imul(ah2, bl9)) | 0;
            hi = (hi + Math.imul(ah2, bh9)) | 0;
            var w11 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w11 >>> 26)) | 0;
            w11 &= 0x3ffffff;
            /* k = 12 */
            lo = Math.imul(al9, bl3);
            mid = Math.imul(al9, bh3);
            mid = (mid + Math.imul(ah9, bl3)) | 0;
            hi = Math.imul(ah9, bh3);
            lo = (lo + Math.imul(al8, bl4)) | 0;
            mid = (mid + Math.imul(al8, bh4)) | 0;
            mid = (mid + Math.imul(ah8, bl4)) | 0;
            hi = (hi + Math.imul(ah8, bh4)) | 0;
            lo = (lo + Math.imul(al7, bl5)) | 0;
            mid = (mid + Math.imul(al7, bh5)) | 0;
            mid = (mid + Math.imul(ah7, bl5)) | 0;
            hi = (hi + Math.imul(ah7, bh5)) | 0;
            lo = (lo + Math.imul(al6, bl6)) | 0;
            mid = (mid + Math.imul(al6, bh6)) | 0;
            mid = (mid + Math.imul(ah6, bl6)) | 0;
            hi = (hi + Math.imul(ah6, bh6)) | 0;
            lo = (lo + Math.imul(al5, bl7)) | 0;
            mid = (mid + Math.imul(al5, bh7)) | 0;
            mid = (mid + Math.imul(ah5, bl7)) | 0;
            hi = (hi + Math.imul(ah5, bh7)) | 0;
            lo = (lo + Math.imul(al4, bl8)) | 0;
            mid = (mid + Math.imul(al4, bh8)) | 0;
            mid = (mid + Math.imul(ah4, bl8)) | 0;
            hi = (hi + Math.imul(ah4, bh8)) | 0;
            lo = (lo + Math.imul(al3, bl9)) | 0;
            mid = (mid + Math.imul(al3, bh9)) | 0;
            mid = (mid + Math.imul(ah3, bl9)) | 0;
            hi = (hi + Math.imul(ah3, bh9)) | 0;
            var w12 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w12 >>> 26)) | 0;
            w12 &= 0x3ffffff;
            /* k = 13 */
            lo = Math.imul(al9, bl4);
            mid = Math.imul(al9, bh4);
            mid = (mid + Math.imul(ah9, bl4)) | 0;
            hi = Math.imul(ah9, bh4);
            lo = (lo + Math.imul(al8, bl5)) | 0;
            mid = (mid + Math.imul(al8, bh5)) | 0;
            mid = (mid + Math.imul(ah8, bl5)) | 0;
            hi = (hi + Math.imul(ah8, bh5)) | 0;
            lo = (lo + Math.imul(al7, bl6)) | 0;
            mid = (mid + Math.imul(al7, bh6)) | 0;
            mid = (mid + Math.imul(ah7, bl6)) | 0;
            hi = (hi + Math.imul(ah7, bh6)) | 0;
            lo = (lo + Math.imul(al6, bl7)) | 0;
            mid = (mid + Math.imul(al6, bh7)) | 0;
            mid = (mid + Math.imul(ah6, bl7)) | 0;
            hi = (hi + Math.imul(ah6, bh7)) | 0;
            lo = (lo + Math.imul(al5, bl8)) | 0;
            mid = (mid + Math.imul(al5, bh8)) | 0;
            mid = (mid + Math.imul(ah5, bl8)) | 0;
            hi = (hi + Math.imul(ah5, bh8)) | 0;
            lo = (lo + Math.imul(al4, bl9)) | 0;
            mid = (mid + Math.imul(al4, bh9)) | 0;
            mid = (mid + Math.imul(ah4, bl9)) | 0;
            hi = (hi + Math.imul(ah4, bh9)) | 0;
            var w13 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w13 >>> 26)) | 0;
            w13 &= 0x3ffffff;
            /* k = 14 */
            lo = Math.imul(al9, bl5);
            mid = Math.imul(al9, bh5);
            mid = (mid + Math.imul(ah9, bl5)) | 0;
            hi = Math.imul(ah9, bh5);
            lo = (lo + Math.imul(al8, bl6)) | 0;
            mid = (mid + Math.imul(al8, bh6)) | 0;
            mid = (mid + Math.imul(ah8, bl6)) | 0;
            hi = (hi + Math.imul(ah8, bh6)) | 0;
            lo = (lo + Math.imul(al7, bl7)) | 0;
            mid = (mid + Math.imul(al7, bh7)) | 0;
            mid = (mid + Math.imul(ah7, bl7)) | 0;
            hi = (hi + Math.imul(ah7, bh7)) | 0;
            lo = (lo + Math.imul(al6, bl8)) | 0;
            mid = (mid + Math.imul(al6, bh8)) | 0;
            mid = (mid + Math.imul(ah6, bl8)) | 0;
            hi = (hi + Math.imul(ah6, bh8)) | 0;
            lo = (lo + Math.imul(al5, bl9)) | 0;
            mid = (mid + Math.imul(al5, bh9)) | 0;
            mid = (mid + Math.imul(ah5, bl9)) | 0;
            hi = (hi + Math.imul(ah5, bh9)) | 0;
            var w14 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w14 >>> 26)) | 0;
            w14 &= 0x3ffffff;
            /* k = 15 */
            lo = Math.imul(al9, bl6);
            mid = Math.imul(al9, bh6);
            mid = (mid + Math.imul(ah9, bl6)) | 0;
            hi = Math.imul(ah9, bh6);
            lo = (lo + Math.imul(al8, bl7)) | 0;
            mid = (mid + Math.imul(al8, bh7)) | 0;
            mid = (mid + Math.imul(ah8, bl7)) | 0;
            hi = (hi + Math.imul(ah8, bh7)) | 0;
            lo = (lo + Math.imul(al7, bl8)) | 0;
            mid = (mid + Math.imul(al7, bh8)) | 0;
            mid = (mid + Math.imul(ah7, bl8)) | 0;
            hi = (hi + Math.imul(ah7, bh8)) | 0;
            lo = (lo + Math.imul(al6, bl9)) | 0;
            mid = (mid + Math.imul(al6, bh9)) | 0;
            mid = (mid + Math.imul(ah6, bl9)) | 0;
            hi = (hi + Math.imul(ah6, bh9)) | 0;
            var w15 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w15 >>> 26)) | 0;
            w15 &= 0x3ffffff;
            /* k = 16 */
            lo = Math.imul(al9, bl7);
            mid = Math.imul(al9, bh7);
            mid = (mid + Math.imul(ah9, bl7)) | 0;
            hi = Math.imul(ah9, bh7);
            lo = (lo + Math.imul(al8, bl8)) | 0;
            mid = (mid + Math.imul(al8, bh8)) | 0;
            mid = (mid + Math.imul(ah8, bl8)) | 0;
            hi = (hi + Math.imul(ah8, bh8)) | 0;
            lo = (lo + Math.imul(al7, bl9)) | 0;
            mid = (mid + Math.imul(al7, bh9)) | 0;
            mid = (mid + Math.imul(ah7, bl9)) | 0;
            hi = (hi + Math.imul(ah7, bh9)) | 0;
            var w16 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w16 >>> 26)) | 0;
            w16 &= 0x3ffffff;
            /* k = 17 */
            lo = Math.imul(al9, bl8);
            mid = Math.imul(al9, bh8);
            mid = (mid + Math.imul(ah9, bl8)) | 0;
            hi = Math.imul(ah9, bh8);
            lo = (lo + Math.imul(al8, bl9)) | 0;
            mid = (mid + Math.imul(al8, bh9)) | 0;
            mid = (mid + Math.imul(ah8, bl9)) | 0;
            hi = (hi + Math.imul(ah8, bh9)) | 0;
            var w17 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w17 >>> 26)) | 0;
            w17 &= 0x3ffffff;
            /* k = 18 */
            lo = Math.imul(al9, bl9);
            mid = Math.imul(al9, bh9);
            mid = (mid + Math.imul(ah9, bl9)) | 0;
            hi = Math.imul(ah9, bh9);
            var w18 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
            c = (((hi + (mid >>> 13)) | 0) + (w18 >>> 26)) | 0;
            w18 &= 0x3ffffff;
            o[0] = w0;
            o[1] = w1;
            o[2] = w2;
            o[3] = w3;
            o[4] = w4;
            o[5] = w5;
            o[6] = w6;
            o[7] = w7;
            o[8] = w8;
            o[9] = w9;
            o[10] = w10;
            o[11] = w11;
            o[12] = w12;
            o[13] = w13;
            o[14] = w14;
            o[15] = w15;
            o[16] = w16;
            o[17] = w17;
            o[18] = w18;
            if (c !== 0) {
                o[19] = c;
                out.length++;
            }
            return out;
        };

        // Polyfill comb
        if (!Math.imul) {
            comb10MulTo = smallMulTo;
        }

        function bigMulTo (self, num, out) {
            out.negative = num.negative ^ self.negative;
            out.length = self.length + num.length;

            var carry = 0;
            var hncarry = 0;
            for (var k = 0; k < out.length - 1; k++) {
                // Sum all words with the same `i + j = k` and accumulate `ncarry`,
                // note that ncarry could be >= 0x3ffffff
                var ncarry = hncarry;
                hncarry = 0;
                var rword = carry & 0x3ffffff;
                var maxJ = Math.min(k, num.length - 1);
                for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
                    var i = k - j;
                    var a = self.words[i] | 0;
                    var b = num.words[j] | 0;
                    var r = a * b;

                    var lo = r & 0x3ffffff;
                    ncarry = (ncarry + ((r / 0x4000000) | 0)) | 0;
                    lo = (lo + rword) | 0;
                    rword = lo & 0x3ffffff;
                    ncarry = (ncarry + (lo >>> 26)) | 0;

                    hncarry += ncarry >>> 26;
                    ncarry &= 0x3ffffff;
                }
                out.words[k] = rword;
                carry = ncarry;
                ncarry = hncarry;
            }
            if (carry !== 0) {
                out.words[k] = carry;
            } else {
                out.length--;
            }

            return out.strip();
        }

        function jumboMulTo (self, num, out) {
            var fftm = new FFTM();
            return fftm.mulp(self, num, out);
        }

        BN.prototype.mulTo = function mulTo (num, out) {
            var res;
            var len = this.length + num.length;
            if (this.length === 10 && num.length === 10) {
                res = comb10MulTo(this, num, out);
            } else if (len < 63) {
                res = smallMulTo(this, num, out);
            } else if (len < 1024) {
                res = bigMulTo(this, num, out);
            } else {
                res = jumboMulTo(this, num, out);
            }

            return res;
        };

        // Cooley-Tukey algorithm for FFT
        // slightly revisited to rely on looping instead of recursion

        function FFTM (x, y) {
            this.x = x;
            this.y = y;
        }

        FFTM.prototype.makeRBT = function makeRBT (N) {
            var t = new Array(N);
            var l = BN.prototype._countBits(N) - 1;
            for (var i = 0; i < N; i++) {
                t[i] = this.revBin(i, l, N);
            }

            return t;
        };

        // Returns binary-reversed representation of `x`
        FFTM.prototype.revBin = function revBin (x, l, N) {
            if (x === 0 || x === N - 1) return x;

            var rb = 0;
            for (var i = 0; i < l; i++) {
                rb |= (x & 1) << (l - i - 1);
                x >>= 1;
            }

            return rb;
        };

        // Performs "tweedling" phase, therefore 'emulating'
        // behaviour of the recursive algorithm
        FFTM.prototype.permute = function permute (rbt, rws, iws, rtws, itws, N) {
            for (var i = 0; i < N; i++) {
                rtws[i] = rws[rbt[i]];
                itws[i] = iws[rbt[i]];
            }
        };

        FFTM.prototype.transform = function transform (rws, iws, rtws, itws, N, rbt) {
            this.permute(rbt, rws, iws, rtws, itws, N);

            for (var s = 1; s < N; s <<= 1) {
                var l = s << 1;

                var rtwdf = Math.cos(2 * Math.PI / l);
                var itwdf = Math.sin(2 * Math.PI / l);

                for (var p = 0; p < N; p += l) {
                    var rtwdf_ = rtwdf;
                    var itwdf_ = itwdf;

                    for (var j = 0; j < s; j++) {
                        var re = rtws[p + j];
                        var ie = itws[p + j];

                        var ro = rtws[p + j + s];
                        var io = itws[p + j + s];

                        var rx = rtwdf_ * ro - itwdf_ * io;

                        io = rtwdf_ * io + itwdf_ * ro;
                        ro = rx;

                        rtws[p + j] = re + ro;
                        itws[p + j] = ie + io;

                        rtws[p + j + s] = re - ro;
                        itws[p + j + s] = ie - io;

                        /* jshint maxdepth : false */
                        if (j !== l) {
                            rx = rtwdf * rtwdf_ - itwdf * itwdf_;

                            itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
                            rtwdf_ = rx;
                        }
                    }
                }
            }
        };

        FFTM.prototype.guessLen13b = function guessLen13b (n, m) {
            var N = Math.max(m, n) | 1;
            var odd = N & 1;
            var i = 0;
            for (N = N / 2 | 0; N; N = N >>> 1) {
                i++;
            }

            return 1 << i + 1 + odd;
        };

        FFTM.prototype.conjugate = function conjugate (rws, iws, N) {
            if (N <= 1) return;

            for (var i = 0; i < N / 2; i++) {
                var t = rws[i];

                rws[i] = rws[N - i - 1];
                rws[N - i - 1] = t;

                t = iws[i];

                iws[i] = -iws[N - i - 1];
                iws[N - i - 1] = -t;
            }
        };

        FFTM.prototype.normalize13b = function normalize13b (ws, N) {
            var carry = 0;
            for (var i = 0; i < N / 2; i++) {
                var w = Math.round(ws[2 * i + 1] / N) * 0x2000 +
                    Math.round(ws[2 * i] / N) +
                    carry;

                ws[i] = w & 0x3ffffff;

                if (w < 0x4000000) {
                    carry = 0;
                } else {
                    carry = w / 0x4000000 | 0;
                }
            }

            return ws;
        };

        FFTM.prototype.convert13b = function convert13b (ws, len, rws, N) {
            var carry = 0;
            for (var i = 0; i < len; i++) {
                carry = carry + (ws[i] | 0);

                rws[2 * i] = carry & 0x1fff; carry = carry >>> 13;
                rws[2 * i + 1] = carry & 0x1fff; carry = carry >>> 13;
            }

            // Pad with zeroes
            for (i = 2 * len; i < N; ++i) {
                rws[i] = 0;
            }

            assert(carry === 0);
            assert((carry & ~0x1fff) === 0);
        };

        FFTM.prototype.stub = function stub (N) {
            var ph = new Array(N);
            for (var i = 0; i < N; i++) {
                ph[i] = 0;
            }

            return ph;
        };

        FFTM.prototype.mulp = function mulp (x, y, out) {
            var N = 2 * this.guessLen13b(x.length, y.length);

            var rbt = this.makeRBT(N);

            var _ = this.stub(N);

            var rws = new Array(N);
            var rwst = new Array(N);
            var iwst = new Array(N);

            var nrws = new Array(N);
            var nrwst = new Array(N);
            var niwst = new Array(N);

            var rmws = out.words;
            rmws.length = N;

            this.convert13b(x.words, x.length, rws, N);
            this.convert13b(y.words, y.length, nrws, N);

            this.transform(rws, _, rwst, iwst, N, rbt);
            this.transform(nrws, _, nrwst, niwst, N, rbt);

            for (var i = 0; i < N; i++) {
                var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
                iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
                rwst[i] = rx;
            }

            this.conjugate(rwst, iwst, N);
            this.transform(rwst, iwst, rmws, _, N, rbt);
            this.conjugate(rmws, _, N);
            this.normalize13b(rmws, N);

            out.negative = x.negative ^ y.negative;
            out.length = x.length + y.length;
            return out.strip();
        };

        // Multiply `this` by `num`
        BN.prototype.mul = function mul (num) {
            var out = new BN(null);
            out.words = new Array(this.length + num.length);
            return this.mulTo(num, out);
        };

        // Multiply employing FFT
        BN.prototype.mulf = function mulf (num) {
            var out = new BN(null);
            out.words = new Array(this.length + num.length);
            return jumboMulTo(this, num, out);
        };

        // In-place Multiplication
        BN.prototype.imul = function imul (num) {
            return this.clone().mulTo(num, this);
        };

        BN.prototype.imuln = function imuln (num) {
            assert(typeof num === 'number');
            assert(num < 0x4000000);

            // Carry
            var carry = 0;
            for (var i = 0; i < this.length; i++) {
                var w = (this.words[i] | 0) * num;
                var lo = (w & 0x3ffffff) + (carry & 0x3ffffff);
                carry >>= 26;
                carry += (w / 0x4000000) | 0;
                // NOTE: lo is 27bit maximum
                carry += lo >>> 26;
                this.words[i] = lo & 0x3ffffff;
            }

            if (carry !== 0) {
                this.words[i] = carry;
                this.length++;
            }

            return this;
        };

        BN.prototype.muln = function muln (num) {
            return this.clone().imuln(num);
        };

        // `this` * `this`
        BN.prototype.sqr = function sqr () {
            return this.mul(this);
        };

        // `this` * `this` in-place
        BN.prototype.isqr = function isqr () {
            return this.imul(this.clone());
        };

        // Math.pow(`this`, `num`)
        BN.prototype.pow = function pow (num) {
            var w = toBitArray(num);
            if (w.length === 0) return new BN(1);

            // Skip leading zeroes
            var res = this;
            for (var i = 0; i < w.length; i++, res = res.sqr()) {
                if (w[i] !== 0) break;
            }

            if (++i < w.length) {
                for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
                    if (w[i] === 0) continue;

                    res = res.mul(q);
                }
            }

            return res;
        };

        // Shift-left in-place
        BN.prototype.iushln = function iushln (bits) {
            assert(typeof bits === 'number' && bits >= 0);
            var r = bits % 26;
            var s = (bits - r) / 26;
            var carryMask = (0x3ffffff >>> (26 - r)) << (26 - r);
            var i;

            if (r !== 0) {
                var carry = 0;

                for (i = 0; i < this.length; i++) {
                    var newCarry = this.words[i] & carryMask;
                    var c = ((this.words[i] | 0) - newCarry) << r;
                    this.words[i] = c | carry;
                    carry = newCarry >>> (26 - r);
                }

                if (carry) {
                    this.words[i] = carry;
                    this.length++;
                }
            }

            if (s !== 0) {
                for (i = this.length - 1; i >= 0; i--) {
                    this.words[i + s] = this.words[i];
                }

                for (i = 0; i < s; i++) {
                    this.words[i] = 0;
                }

                this.length += s;
            }

            return this.strip();
        };

        BN.prototype.ishln = function ishln (bits) {
            // TODO(indutny): implement me
            assert(this.negative === 0);
            return this.iushln(bits);
        };

        // Shift-right in-place
        // NOTE: `hint` is a lowest bit before trailing zeroes
        // NOTE: if `extended` is present - it will be filled with destroyed bits
        BN.prototype.iushrn = function iushrn (bits, hint, extended) {
            assert(typeof bits === 'number' && bits >= 0);
            var h;
            if (hint) {
                h = (hint - (hint % 26)) / 26;
            } else {
                h = 0;
            }

            var r = bits % 26;
            var s = Math.min((bits - r) / 26, this.length);
            var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
            var maskedWords = extended;

            h -= s;
            h = Math.max(0, h);

            // Extended mode, copy masked part
            if (maskedWords) {
                for (var i = 0; i < s; i++) {
                    maskedWords.words[i] = this.words[i];
                }
                maskedWords.length = s;
            }

            if (s === 0) {
                // No-op, we should not move anything at all
            } else if (this.length > s) {
                this.length -= s;
                for (i = 0; i < this.length; i++) {
                    this.words[i] = this.words[i + s];
                }
            } else {
                this.words[0] = 0;
                this.length = 1;
            }

            var carry = 0;
            for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
                var word = this.words[i] | 0;
                this.words[i] = (carry << (26 - r)) | (word >>> r);
                carry = word & mask;
            }

            // Push carried bits as a mask
            if (maskedWords && carry !== 0) {
                maskedWords.words[maskedWords.length++] = carry;
            }

            if (this.length === 0) {
                this.words[0] = 0;
                this.length = 1;
            }

            return this.strip();
        };

        BN.prototype.ishrn = function ishrn (bits, hint, extended) {
            // TODO(indutny): implement me
            assert(this.negative === 0);
            return this.iushrn(bits, hint, extended);
        };

        // Shift-left
        BN.prototype.shln = function shln (bits) {
            return this.clone().ishln(bits);
        };

        BN.prototype.ushln = function ushln (bits) {
            return this.clone().iushln(bits);
        };

        // Shift-right
        BN.prototype.shrn = function shrn (bits) {
            return this.clone().ishrn(bits);
        };

        BN.prototype.ushrn = function ushrn (bits) {
            return this.clone().iushrn(bits);
        };

        // Test if n bit is set
        BN.prototype.testn = function testn (bit) {
            assert(typeof bit === 'number' && bit >= 0);
            var r = bit % 26;
            var s = (bit - r) / 26;
            var q = 1 << r;

            // Fast case: bit is much higher than all existing words
            if (this.length <= s) return false;

            // Check bit and return
            var w = this.words[s];

            return !!(w & q);
        };

        // Return only lowers bits of number (in-place)
        BN.prototype.imaskn = function imaskn (bits) {
            assert(typeof bits === 'number' && bits >= 0);
            var r = bits % 26;
            var s = (bits - r) / 26;

            assert(this.negative === 0, 'imaskn works only with positive numbers');

            if (this.length <= s) {
                return this;
            }

            if (r !== 0) {
                s++;
            }
            this.length = Math.min(s, this.length);

            if (r !== 0) {
                var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
                this.words[this.length - 1] &= mask;
            }

            return this.strip();
        };

        // Return only lowers bits of number
        BN.prototype.maskn = function maskn (bits) {
            return this.clone().imaskn(bits);
        };

        // Add plain number `num` to `this`
        BN.prototype.iaddn = function iaddn (num) {
            assert(typeof num === 'number');
            assert(num < 0x4000000);
            if (num < 0) return this.isubn(-num);

            // Possible sign change
            if (this.negative !== 0) {
                if (this.length === 1 && (this.words[0] | 0) < num) {
                    this.words[0] = num - (this.words[0] | 0);
                    this.negative = 0;
                    return this;
                }

                this.negative = 0;
                this.isubn(num);
                this.negative = 1;
                return this;
            }

            // Add without checks
            return this._iaddn(num);
        };

        BN.prototype._iaddn = function _iaddn (num) {
            this.words[0] += num;

            // Carry
            for (var i = 0; i < this.length && this.words[i] >= 0x4000000; i++) {
                this.words[i] -= 0x4000000;
                if (i === this.length - 1) {
                    this.words[i + 1] = 1;
                } else {
                    this.words[i + 1]++;
                }
            }
            this.length = Math.max(this.length, i + 1);

            return this;
        };

        // Subtract plain number `num` from `this`
        BN.prototype.isubn = function isubn (num) {
            assert(typeof num === 'number');
            assert(num < 0x4000000);
            if (num < 0) return this.iaddn(-num);

            if (this.negative !== 0) {
                this.negative = 0;
                this.iaddn(num);
                this.negative = 1;
                return this;
            }

            this.words[0] -= num;

            if (this.length === 1 && this.words[0] < 0) {
                this.words[0] = -this.words[0];
                this.negative = 1;
            } else {
                // Carry
                for (var i = 0; i < this.length && this.words[i] < 0; i++) {
                    this.words[i] += 0x4000000;
                    this.words[i + 1] -= 1;
                }
            }

            return this.strip();
        };

        BN.prototype.addn = function addn (num) {
            return this.clone().iaddn(num);
        };

        BN.prototype.subn = function subn (num) {
            return this.clone().isubn(num);
        };

        BN.prototype.iabs = function iabs () {
            this.negative = 0;

            return this;
        };

        BN.prototype.abs = function abs () {
            return this.clone().iabs();
        };

        BN.prototype._ishlnsubmul = function _ishlnsubmul (num, mul, shift) {
            var len = num.length + shift;
            var i;

            this._expand(len);

            var w;
            var carry = 0;
            for (i = 0; i < num.length; i++) {
                w = (this.words[i + shift] | 0) + carry;
                var right = (num.words[i] | 0) * mul;
                w -= right & 0x3ffffff;
                carry = (w >> 26) - ((right / 0x4000000) | 0);
                this.words[i + shift] = w & 0x3ffffff;
            }
            for (; i < this.length - shift; i++) {
                w = (this.words[i + shift] | 0) + carry;
                carry = w >> 26;
                this.words[i + shift] = w & 0x3ffffff;
            }

            if (carry === 0) return this.strip();

            // Subtraction overflow
            assert(carry === -1);
            carry = 0;
            for (i = 0; i < this.length; i++) {
                w = -(this.words[i] | 0) + carry;
                carry = w >> 26;
                this.words[i] = w & 0x3ffffff;
            }
            this.negative = 1;

            return this.strip();
        };

        BN.prototype._wordDiv = function _wordDiv (num, mode) {
            var shift = this.length - num.length;

            var a = this.clone();
            var b = num;

            // Normalize
            var bhi = b.words[b.length - 1] | 0;
            var bhiBits = this._countBits(bhi);
            shift = 26 - bhiBits;
            if (shift !== 0) {
                b = b.ushln(shift);
                a.iushln(shift);
                bhi = b.words[b.length - 1] | 0;
            }

            // Initialize quotient
            var m = a.length - b.length;
            var q;

            if (mode !== 'mod') {
                q = new BN(null);
                q.length = m + 1;
                q.words = new Array(q.length);
                for (var i = 0; i < q.length; i++) {
                    q.words[i] = 0;
                }
            }

            var diff = a.clone()._ishlnsubmul(b, 1, m);
            if (diff.negative === 0) {
                a = diff;
                if (q) {
                    q.words[m] = 1;
                }
            }

            for (var j = m - 1; j >= 0; j--) {
                var qj = (a.words[b.length + j] | 0) * 0x4000000 +
                    (a.words[b.length + j - 1] | 0);

                // NOTE: (qj / bhi) is (0x3ffffff * 0x4000000 + 0x3ffffff) / 0x2000000 max
                // (0x7ffffff)
                qj = Math.min((qj / bhi) | 0, 0x3ffffff);

                a._ishlnsubmul(b, qj, j);
                while (a.negative !== 0) {
                    qj--;
                    a.negative = 0;
                    a._ishlnsubmul(b, 1, j);
                    if (!a.isZero()) {
                        a.negative ^= 1;
                    }
                }
                if (q) {
                    q.words[j] = qj;
                }
            }
            if (q) {
                q.strip();
            }
            a.strip();

            // Denormalize
            if (mode !== 'div' && shift !== 0) {
                a.iushrn(shift);
            }

            return {
                div: q || null,
                mod: a
            };
        };

        // NOTE: 1) `mode` can be set to `mod` to request mod only,
        //       to `div` to request div only, or be absent to
        //       request both div & mod
        //       2) `positive` is true if unsigned mod is requested
        BN.prototype.divmod = function divmod (num, mode, positive) {
            assert(!num.isZero());

            if (this.isZero()) {
                return {
                    div: new BN(0),
                    mod: new BN(0)
                };
            }

            var div, mod, res;
            if (this.negative !== 0 && num.negative === 0) {
                res = this.neg().divmod(num, mode);

                if (mode !== 'mod') {
                    div = res.div.neg();
                }

                if (mode !== 'div') {
                    mod = res.mod.neg();
                    if (positive && mod.negative !== 0) {
                        mod.iadd(num);
                    }
                }

                return {
                    div: div,
                    mod: mod
                };
            }

            if (this.negative === 0 && num.negative !== 0) {
                res = this.divmod(num.neg(), mode);

                if (mode !== 'mod') {
                    div = res.div.neg();
                }

                return {
                    div: div,
                    mod: res.mod
                };
            }

            if ((this.negative & num.negative) !== 0) {
                res = this.neg().divmod(num.neg(), mode);

                if (mode !== 'div') {
                    mod = res.mod.neg();
                    if (positive && mod.negative !== 0) {
                        mod.isub(num);
                    }
                }

                return {
                    div: res.div,
                    mod: mod
                };
            }

            // Both numbers are positive at this point

            // Strip both numbers to approximate shift value
            if (num.length > this.length || this.cmp(num) < 0) {
                return {
                    div: new BN(0),
                    mod: this
                };
            }

            // Very short reduction
            if (num.length === 1) {
                if (mode === 'div') {
                    return {
                        div: this.divn(num.words[0]),
                        mod: null
                    };
                }

                if (mode === 'mod') {
                    return {
                        div: null,
                        mod: new BN(this.modn(num.words[0]))
                    };
                }

                return {
                    div: this.divn(num.words[0]),
                    mod: new BN(this.modn(num.words[0]))
                };
            }

            return this._wordDiv(num, mode);
        };

        // Find `this` / `num`
        BN.prototype.div = function div (num) {
            return this.divmod(num, 'div', false).div;
        };

        // Find `this` % `num`
        BN.prototype.mod = function mod (num) {
            return this.divmod(num, 'mod', false).mod;
        };

        BN.prototype.umod = function umod (num) {
            return this.divmod(num, 'mod', true).mod;
        };

        // Find Round(`this` / `num`)
        BN.prototype.divRound = function divRound (num) {
            var dm = this.divmod(num);

            // Fast case - exact division
            if (dm.mod.isZero()) return dm.div;

            var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

            var half = num.ushrn(1);
            var r2 = num.andln(1);
            var cmp = mod.cmp(half);

            // Round down
            if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;

            // Round up
            return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
        };

        BN.prototype.modn = function modn (num) {
            assert(num <= 0x3ffffff);
            var p = (1 << 26) % num;

            var acc = 0;
            for (var i = this.length - 1; i >= 0; i--) {
                acc = (p * acc + (this.words[i] | 0)) % num;
            }

            return acc;
        };

        // In-place division by number
        BN.prototype.idivn = function idivn (num) {
            assert(num <= 0x3ffffff);

            var carry = 0;
            for (var i = this.length - 1; i >= 0; i--) {
                var w = (this.words[i] | 0) + carry * 0x4000000;
                this.words[i] = (w / num) | 0;
                carry = w % num;
            }

            return this.strip();
        };

        BN.prototype.divn = function divn (num) {
            return this.clone().idivn(num);
        };

        BN.prototype.egcd = function egcd (p) {
            assert(p.negative === 0);
            assert(!p.isZero());

            var x = this;
            var y = p.clone();

            if (x.negative !== 0) {
                x = x.umod(p);
            } else {
                x = x.clone();
            }

            // A * x + B * y = x
            var A = new BN(1);
            var B = new BN(0);

            // C * x + D * y = y
            var C = new BN(0);
            var D = new BN(1);

            var g = 0;

            while (x.isEven() && y.isEven()) {
                x.iushrn(1);
                y.iushrn(1);
                ++g;
            }

            var yp = y.clone();
            var xp = x.clone();

            while (!x.isZero()) {
                for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
                if (i > 0) {
                    x.iushrn(i);
                    while (i-- > 0) {
                        if (A.isOdd() || B.isOdd()) {
                            A.iadd(yp);
                            B.isub(xp);
                        }

                        A.iushrn(1);
                        B.iushrn(1);
                    }
                }

                for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
                if (j > 0) {
                    y.iushrn(j);
                    while (j-- > 0) {
                        if (C.isOdd() || D.isOdd()) {
                            C.iadd(yp);
                            D.isub(xp);
                        }

                        C.iushrn(1);
                        D.iushrn(1);
                    }
                }

                if (x.cmp(y) >= 0) {
                    x.isub(y);
                    A.isub(C);
                    B.isub(D);
                } else {
                    y.isub(x);
                    C.isub(A);
                    D.isub(B);
                }
            }

            return {
                a: C,
                b: D,
                gcd: y.iushln(g)
            };
        };

        // This is reduced incarnation of the binary EEA
        // above, designated to invert members of the
        // _prime_ fields F(p) at a maximal speed
        BN.prototype._invmp = function _invmp (p) {
            assert(p.negative === 0);
            assert(!p.isZero());

            var a = this;
            var b = p.clone();

            if (a.negative !== 0) {
                a = a.umod(p);
            } else {
                a = a.clone();
            }

            var x1 = new BN(1);
            var x2 = new BN(0);

            var delta = b.clone();

            while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
                for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
                if (i > 0) {
                    a.iushrn(i);
                    while (i-- > 0) {
                        if (x1.isOdd()) {
                            x1.iadd(delta);
                        }

                        x1.iushrn(1);
                    }
                }

                for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
                if (j > 0) {
                    b.iushrn(j);
                    while (j-- > 0) {
                        if (x2.isOdd()) {
                            x2.iadd(delta);
                        }

                        x2.iushrn(1);
                    }
                }

                if (a.cmp(b) >= 0) {
                    a.isub(b);
                    x1.isub(x2);
                } else {
                    b.isub(a);
                    x2.isub(x1);
                }
            }

            var res;
            if (a.cmpn(1) === 0) {
                res = x1;
            } else {
                res = x2;
            }

            if (res.cmpn(0) < 0) {
                res.iadd(p);
            }

            return res;
        };

        BN.prototype.gcd = function gcd (num) {
            if (this.isZero()) return num.abs();
            if (num.isZero()) return this.abs();

            var a = this.clone();
            var b = num.clone();
            a.negative = 0;
            b.negative = 0;

            // Remove common factor of two
            for (var shift = 0; a.isEven() && b.isEven(); shift++) {
                a.iushrn(1);
                b.iushrn(1);
            }

            do {
                while (a.isEven()) {
                    a.iushrn(1);
                }
                while (b.isEven()) {
                    b.iushrn(1);
                }

                var r = a.cmp(b);
                if (r < 0) {
                    // Swap `a` and `b` to make `a` always bigger than `b`
                    var t = a;
                    a = b;
                    b = t;
                } else if (r === 0 || b.cmpn(1) === 0) {
                    break;
                }

                a.isub(b);
            } while (true);

            return b.iushln(shift);
        };

        // Invert number in the field F(num)
        BN.prototype.invm = function invm (num) {
            return this.egcd(num).a.umod(num);
        };

        BN.prototype.isEven = function isEven () {
            return (this.words[0] & 1) === 0;
        };

        BN.prototype.isOdd = function isOdd () {
            return (this.words[0] & 1) === 1;
        };

        // And first word and num
        BN.prototype.andln = function andln (num) {
            return this.words[0] & num;
        };

        // Increment at the bit position in-line
        BN.prototype.bincn = function bincn (bit) {
            assert(typeof bit === 'number');
            var r = bit % 26;
            var s = (bit - r) / 26;
            var q = 1 << r;

            // Fast case: bit is much higher than all existing words
            if (this.length <= s) {
                this._expand(s + 1);
                this.words[s] |= q;
                return this;
            }

            // Add bit and propagate, if needed
            var carry = q;
            for (var i = s; carry !== 0 && i < this.length; i++) {
                var w = this.words[i] | 0;
                w += carry;
                carry = w >>> 26;
                w &= 0x3ffffff;
                this.words[i] = w;
            }
            if (carry !== 0) {
                this.words[i] = carry;
                this.length++;
            }
            return this;
        };

        BN.prototype.isZero = function isZero () {
            return this.length === 1 && this.words[0] === 0;
        };

        BN.prototype.cmpn = function cmpn (num) {
            var negative = num < 0;

            if (this.negative !== 0 && !negative) return -1;
            if (this.negative === 0 && negative) return 1;

            this.strip();

            var res;
            if (this.length > 1) {
                res = 1;
            } else {
                if (negative) {
                    num = -num;
                }

                assert(num <= 0x3ffffff, 'Number is too big');

                var w = this.words[0] | 0;
                res = w === num ? 0 : w < num ? -1 : 1;
            }
            if (this.negative !== 0) return -res | 0;
            return res;
        };

        // Compare two numbers and return:
        // 1 - if `this` > `num`
        // 0 - if `this` == `num`
        // -1 - if `this` < `num`
        BN.prototype.cmp = function cmp (num) {
            if (this.negative !== 0 && num.negative === 0) return -1;
            if (this.negative === 0 && num.negative !== 0) return 1;

            var res = this.ucmp(num);
            if (this.negative !== 0) return -res | 0;
            return res;
        };

        // Unsigned comparison
        BN.prototype.ucmp = function ucmp (num) {
            // At this point both numbers have the same sign
            if (this.length > num.length) return 1;
            if (this.length < num.length) return -1;

            var res = 0;
            for (var i = this.length - 1; i >= 0; i--) {
                var a = this.words[i] | 0;
                var b = num.words[i] | 0;

                if (a === b) continue;
                if (a < b) {
                    res = -1;
                } else if (a > b) {
                    res = 1;
                }
                break;
            }
            return res;
        };

        BN.prototype.gtn = function gtn (num) {
            return this.cmpn(num) === 1;
        };

        BN.prototype.gt = function gt (num) {
            return this.cmp(num) === 1;
        };

        BN.prototype.gten = function gten (num) {
            return this.cmpn(num) >= 0;
        };

        BN.prototype.gte = function gte (num) {
            return this.cmp(num) >= 0;
        };

        BN.prototype.ltn = function ltn (num) {
            return this.cmpn(num) === -1;
        };

        BN.prototype.lt = function lt (num) {
            return this.cmp(num) === -1;
        };

        BN.prototype.lten = function lten (num) {
            return this.cmpn(num) <= 0;
        };

        BN.prototype.lte = function lte (num) {
            return this.cmp(num) <= 0;
        };

        BN.prototype.eqn = function eqn (num) {
            return this.cmpn(num) === 0;
        };

        BN.prototype.eq = function eq (num) {
            return this.cmp(num) === 0;
        };

        //
        // A reduce context, could be using montgomery or something better, depending
        // on the `m` itself.
        //
        BN.red = function red (num) {
            return new Red(num);
        };

        BN.prototype.toRed = function toRed (ctx) {
            assert(!this.red, 'Already a number in reduction context');
            assert(this.negative === 0, 'red works only with positives');
            return ctx.convertTo(this)._forceRed(ctx);
        };

        BN.prototype.fromRed = function fromRed () {
            assert(this.red, 'fromRed works only with numbers in reduction context');
            return this.red.convertFrom(this);
        };

        BN.prototype._forceRed = function _forceRed (ctx) {
            this.red = ctx;
            return this;
        };

        BN.prototype.forceRed = function forceRed (ctx) {
            assert(!this.red, 'Already a number in reduction context');
            return this._forceRed(ctx);
        };

        BN.prototype.redAdd = function redAdd (num) {
            assert(this.red, 'redAdd works only with red numbers');
            return this.red.add(this, num);
        };

        BN.prototype.redIAdd = function redIAdd (num) {
            assert(this.red, 'redIAdd works only with red numbers');
            return this.red.iadd(this, num);
        };

        BN.prototype.redSub = function redSub (num) {
            assert(this.red, 'redSub works only with red numbers');
            return this.red.sub(this, num);
        };

        BN.prototype.redISub = function redISub (num) {
            assert(this.red, 'redISub works only with red numbers');
            return this.red.isub(this, num);
        };

        BN.prototype.redShl = function redShl (num) {
            assert(this.red, 'redShl works only with red numbers');
            return this.red.shl(this, num);
        };

        BN.prototype.redMul = function redMul (num) {
            assert(this.red, 'redMul works only with red numbers');
            this.red._verify2(this, num);
            return this.red.mul(this, num);
        };

        BN.prototype.redIMul = function redIMul (num) {
            assert(this.red, 'redMul works only with red numbers');
            this.red._verify2(this, num);
            return this.red.imul(this, num);
        };

        BN.prototype.redSqr = function redSqr () {
            assert(this.red, 'redSqr works only with red numbers');
            this.red._verify1(this);
            return this.red.sqr(this);
        };

        BN.prototype.redISqr = function redISqr () {
            assert(this.red, 'redISqr works only with red numbers');
            this.red._verify1(this);
            return this.red.isqr(this);
        };

        // Square root over p
        BN.prototype.redSqrt = function redSqrt () {
            assert(this.red, 'redSqrt works only with red numbers');
            this.red._verify1(this);
            return this.red.sqrt(this);
        };

        BN.prototype.redInvm = function redInvm () {
            assert(this.red, 'redInvm works only with red numbers');
            this.red._verify1(this);
            return this.red.invm(this);
        };

        // Return negative clone of `this` % `red modulo`
        BN.prototype.redNeg = function redNeg () {
            assert(this.red, 'redNeg works only with red numbers');
            this.red._verify1(this);
            return this.red.neg(this);
        };

        BN.prototype.redPow = function redPow (num) {
            assert(this.red && !num.red, 'redPow(normalNum)');
            this.red._verify1(this);
            return this.red.pow(this, num);
        };

        // Prime numbers with efficient reduction
        var primes = {
            k256: null,
            p224: null,
            p192: null,
            p25519: null
        };

        // Pseudo-Mersenne prime
        function MPrime (name, p) {
            // P = 2 ^ N - K
            this.name = name;
            this.p = new BN(p, 16);
            this.n = this.p.bitLength();
            this.k = new BN(1).iushln(this.n).isub(this.p);

            this.tmp = this._tmp();
        }

        MPrime.prototype._tmp = function _tmp () {
            var tmp = new BN(null);
            tmp.words = new Array(Math.ceil(this.n / 13));
            return tmp;
        };

        MPrime.prototype.ireduce = function ireduce (num) {
            // Assumes that `num` is less than `P^2`
            // num = HI * (2 ^ N - K) + HI * K + LO = HI * K + LO (mod P)
            var r = num;
            var rlen;

            do {
                this.split(r, this.tmp);
                r = this.imulK(r);
                r = r.iadd(this.tmp);
                rlen = r.bitLength();
            } while (rlen > this.n);

            var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
            if (cmp === 0) {
                r.words[0] = 0;
                r.length = 1;
            } else if (cmp > 0) {
                r.isub(this.p);
            } else {
                r.strip();
            }

            return r;
        };

        MPrime.prototype.split = function split (input, out) {
            input.iushrn(this.n, 0, out);
        };

        MPrime.prototype.imulK = function imulK (num) {
            return num.imul(this.k);
        };

        function K256 () {
            MPrime.call(
                this,
                'k256',
                'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f');
        }
        inherits(K256, MPrime);

        K256.prototype.split = function split (input, output) {
            // 256 = 9 * 26 + 22
            var mask = 0x3fffff;

            var outLen = Math.min(input.length, 9);
            for (var i = 0; i < outLen; i++) {
                output.words[i] = input.words[i];
            }
            output.length = outLen;

            if (input.length <= 9) {
                input.words[0] = 0;
                input.length = 1;
                return;
            }

            // Shift by 9 limbs
            var prev = input.words[9];
            output.words[output.length++] = prev & mask;

            for (i = 10; i < input.length; i++) {
                var next = input.words[i] | 0;
                input.words[i - 10] = ((next & mask) << 4) | (prev >>> 22);
                prev = next;
            }
            prev >>>= 22;
            input.words[i - 10] = prev;
            if (prev === 0 && input.length > 10) {
                input.length -= 10;
            } else {
                input.length -= 9;
            }
        };

        K256.prototype.imulK = function imulK (num) {
            // K = 0x1000003d1 = [ 0x40, 0x3d1 ]
            num.words[num.length] = 0;
            num.words[num.length + 1] = 0;
            num.length += 2;

            // bounded at: 0x40 * 0x3ffffff + 0x3d0 = 0x100000390
            var lo = 0;
            for (var i = 0; i < num.length; i++) {
                var w = num.words[i] | 0;
                lo += w * 0x3d1;
                num.words[i] = lo & 0x3ffffff;
                lo = w * 0x40 + ((lo / 0x4000000) | 0);
            }

            // Fast length reduction
            if (num.words[num.length - 1] === 0) {
                num.length--;
                if (num.words[num.length - 1] === 0) {
                    num.length--;
                }
            }
            return num;
        };

        function P224 () {
            MPrime.call(
                this,
                'p224',
                'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
        }
        inherits(P224, MPrime);

        function P192 () {
            MPrime.call(
                this,
                'p192',
                'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
        }
        inherits(P192, MPrime);

        function P25519 () {
            // 2 ^ 255 - 19
            MPrime.call(
                this,
                '25519',
                '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed');
        }
        inherits(P25519, MPrime);

        P25519.prototype.imulK = function imulK (num) {
            // K = 0x13
            var carry = 0;
            for (var i = 0; i < num.length; i++) {
                var hi = (num.words[i] | 0) * 0x13 + carry;
                var lo = hi & 0x3ffffff;
                hi >>>= 26;

                num.words[i] = lo;
                carry = hi;
            }
            if (carry !== 0) {
                num.words[num.length++] = carry;
            }
            return num;
        };

        // Exported mostly for testing purposes, use plain name instead
        BN._prime = function prime (name) {
            // Cached version of prime
            if (primes[name]) return primes[name];

            var prime;
            if (name === 'k256') {
                prime = new K256();
            } else if (name === 'p224') {
                prime = new P224();
            } else if (name === 'p192') {
                prime = new P192();
            } else if (name === 'p25519') {
                prime = new P25519();
            } else {
                throw new Error('Unknown prime ' + name);
            }
            primes[name] = prime;

            return prime;
        };

        //
        // Base reduction engine
        //
        function Red (m) {
            if (typeof m === 'string') {
                var prime = BN._prime(m);
                this.m = prime.p;
                this.prime = prime;
            } else {
                assert(m.gtn(1), 'modulus must be greater than 1');
                this.m = m;
                this.prime = null;
            }
        }

        Red.prototype._verify1 = function _verify1 (a) {
            assert(a.negative === 0, 'red works only with positives');
            assert(a.red, 'red works only with red numbers');
        };

        Red.prototype._verify2 = function _verify2 (a, b) {
            assert((a.negative | b.negative) === 0, 'red works only with positives');
            assert(a.red && a.red === b.red,
                'red works only with red numbers');
        };

        Red.prototype.imod = function imod (a) {
            if (this.prime) return this.prime.ireduce(a)._forceRed(this);
            return a.umod(this.m)._forceRed(this);
        };

        Red.prototype.neg = function neg (a) {
            if (a.isZero()) {
                return a.clone();
            }

            return this.m.sub(a)._forceRed(this);
        };

        Red.prototype.add = function add (a, b) {
            this._verify2(a, b);

            var res = a.add(b);
            if (res.cmp(this.m) >= 0) {
                res.isub(this.m);
            }
            return res._forceRed(this);
        };

        Red.prototype.iadd = function iadd (a, b) {
            this._verify2(a, b);

            var res = a.iadd(b);
            if (res.cmp(this.m) >= 0) {
                res.isub(this.m);
            }
            return res;
        };

        Red.prototype.sub = function sub (a, b) {
            this._verify2(a, b);

            var res = a.sub(b);
            if (res.cmpn(0) < 0) {
                res.iadd(this.m);
            }
            return res._forceRed(this);
        };

        Red.prototype.isub = function isub (a, b) {
            this._verify2(a, b);

            var res = a.isub(b);
            if (res.cmpn(0) < 0) {
                res.iadd(this.m);
            }
            return res;
        };

        Red.prototype.shl = function shl (a, num) {
            this._verify1(a);
            return this.imod(a.ushln(num));
        };

        Red.prototype.imul = function imul (a, b) {
            this._verify2(a, b);
            return this.imod(a.imul(b));
        };

        Red.prototype.mul = function mul (a, b) {
            this._verify2(a, b);
            return this.imod(a.mul(b));
        };

        Red.prototype.isqr = function isqr (a) {
            return this.imul(a, a.clone());
        };

        Red.prototype.sqr = function sqr (a) {
            return this.mul(a, a);
        };

        Red.prototype.sqrt = function sqrt (a) {
            if (a.isZero()) return a.clone();

            var mod3 = this.m.andln(3);
            assert(mod3 % 2 === 1);

            // Fast case
            if (mod3 === 3) {
                var pow = this.m.add(new BN(1)).iushrn(2);
                return this.pow(a, pow);
            }

            // Tonelli-Shanks algorithm (Totally unoptimized and slow)
            //
            // Find Q and S, that Q * 2 ^ S = (P - 1)
            var q = this.m.subn(1);
            var s = 0;
            while (!q.isZero() && q.andln(1) === 0) {
                s++;
                q.iushrn(1);
            }
            assert(!q.isZero());

            var one = new BN(1).toRed(this);
            var nOne = one.redNeg();

            // Find quadratic non-residue
            // NOTE: Max is such because of generalized Riemann hypothesis.
            var lpow = this.m.subn(1).iushrn(1);
            var z = this.m.bitLength();
            z = new BN(2 * z * z).toRed(this);

            while (this.pow(z, lpow).cmp(nOne) !== 0) {
                z.redIAdd(nOne);
            }

            var c = this.pow(z, q);
            var r = this.pow(a, q.addn(1).iushrn(1));
            var t = this.pow(a, q);
            var m = s;
            while (t.cmp(one) !== 0) {
                var tmp = t;
                for (var i = 0; tmp.cmp(one) !== 0; i++) {
                    tmp = tmp.redSqr();
                }
                assert(i < m);
                var b = this.pow(c, new BN(1).iushln(m - i - 1));

                r = r.redMul(b);
                c = b.redSqr();
                t = t.redMul(c);
                m = i;
            }

            return r;
        };

        Red.prototype.invm = function invm (a) {
            var inv = a._invmp(this.m);
            if (inv.negative !== 0) {
                inv.negative = 0;
                return this.imod(inv).redNeg();
            } else {
                return this.imod(inv);
            }
        };

        Red.prototype.pow = function pow (a, num) {
            if (num.isZero()) return new BN(1).toRed(this);
            if (num.cmpn(1) === 0) return a.clone();

            var windowSize = 4;
            var wnd = new Array(1 << windowSize);
            wnd[0] = new BN(1).toRed(this);
            wnd[1] = a;
            for (var i = 2; i < wnd.length; i++) {
                wnd[i] = this.mul(wnd[i - 1], a);
            }

            var res = wnd[0];
            var current = 0;
            var currentLen = 0;
            var start = num.bitLength() % 26;
            if (start === 0) {
                start = 26;
            }

            for (i = num.length - 1; i >= 0; i--) {
                var word = num.words[i];
                for (var j = start - 1; j >= 0; j--) {
                    var bit = (word >> j) & 1;
                    if (res !== wnd[0]) {
                        res = this.sqr(res);
                    }

                    if (bit === 0 && current === 0) {
                        currentLen = 0;
                        continue;
                    }

                    current <<= 1;
                    current |= bit;
                    currentLen++;
                    if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;

                    res = this.mul(res, wnd[current]);
                    currentLen = 0;
                    current = 0;
                }
                start = 26;
            }

            return res;
        };

        Red.prototype.convertTo = function convertTo (num) {
            var r = num.umod(this.m);

            return r === num ? r.clone() : r;
        };

        Red.prototype.convertFrom = function convertFrom (num) {
            var res = num.clone();
            res.red = null;
            return res;
        };

        //
        // Montgomery method engine
        //

        BN.mont = function mont (num) {
            return new Mont(num);
        };

        function Mont (m) {
            Red.call(this, m);

            this.shift = this.m.bitLength();
            if (this.shift % 26 !== 0) {
                this.shift += 26 - (this.shift % 26);
            }

            this.r = new BN(1).iushln(this.shift);
            this.r2 = this.imod(this.r.sqr());
            this.rinv = this.r._invmp(this.m);

            this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
            this.minv = this.minv.umod(this.r);
            this.minv = this.r.sub(this.minv);
        }
        inherits(Mont, Red);

        Mont.prototype.convertTo = function convertTo (num) {
            return this.imod(num.ushln(this.shift));
        };

        Mont.prototype.convertFrom = function convertFrom (num) {
            var r = this.imod(num.mul(this.rinv));
            r.red = null;
            return r;
        };

        Mont.prototype.imul = function imul (a, b) {
            if (a.isZero() || b.isZero()) {
                a.words[0] = 0;
                a.length = 1;
                return a;
            }

            var t = a.imul(b);
            var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
            var u = t.isub(c).iushrn(this.shift);
            var res = u;

            if (u.cmp(this.m) >= 0) {
                res = u.isub(this.m);
            } else if (u.cmpn(0) < 0) {
                res = u.iadd(this.m);
            }

            return res._forceRed(this);
        };

        Mont.prototype.mul = function mul (a, b) {
            if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);

            var t = a.mul(b);
            var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
            var u = t.isub(c).iushrn(this.shift);
            var res = u;
            if (u.cmp(this.m) >= 0) {
                res = u.isub(this.m);
            } else if (u.cmpn(0) < 0) {
                res = u.iadd(this.m);
            }

            return res._forceRed(this);
        };

        Mont.prototype.invm = function invm (a) {
            // (AR)^-1 * R^2 = (A^-1 * R^-1) * R^2 = A^-1 * R
            var res = this.imod(a._invmp(this.m).mul(this.r2));
            return res._forceRed(this);
        };
    })(typeof module === 'undefined' || module, this);

},{"buffer":23}],22:[function(require,module,exports){
    var r;

    module.exports = function rand(len) {
        if (!r)
            r = new Rand(null);

        return r.generate(len);
    };

    function Rand(rand) {
        this.rand = rand;
    }
    module.exports.Rand = Rand;

    Rand.prototype.generate = function generate(len) {
        return this._rand(len);
    };

// Emulate crypto API using randy
    Rand.prototype._rand = function _rand(n) {
        if (this.rand.getBytes)
            return this.rand.getBytes(n);

        var res = new Uint8Array(n);
        for (var i = 0; i < res.length; i++)
            res[i] = this.rand.getByte();
        return res;
    };

    if (typeof self === 'object') {
        if (self.crypto && self.crypto.getRandomValues) {
            // Modern browsers
            Rand.prototype._rand = function _rand(n) {
                var arr = new Uint8Array(n);
                self.crypto.getRandomValues(arr);
                return arr;
            };
        } else if (self.msCrypto && self.msCrypto.getRandomValues) {
            // IE
            Rand.prototype._rand = function _rand(n) {
                var arr = new Uint8Array(n);
                self.msCrypto.getRandomValues(arr);
                return arr;
            };

            // Safari's WebWorkers do not have `crypto`
        } else if (typeof window === 'object') {
            // Old junk
            Rand.prototype._rand = function() {
                throw new Error('Not implemented yet');
            };
        }
    } else {
        // Node.js or Web worker with no crypto support
        try {
            var crypto = require('crypto');
            if (typeof crypto.randomBytes !== 'function')
                throw new Error('Not supported');

            Rand.prototype._rand = function _rand(n) {
                return crypto.randomBytes(n);
            };
        } catch (e) {
        }
    }

},{"crypto":23}],23:[function(require,module,exports){

},{}],24:[function(require,module,exports){
// based on the aes implimentation in triple sec
// https://github.com/keybase/triplesec
// which is in turn based on the one from crypto-js
// https://code.google.com/p/crypto-js/

    var Buffer = require('safe-buffer').Buffer

    function asUInt32Array (buf) {
        if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf)

        var len = (buf.length / 4) | 0
        var out = new Array(len)

        for (var i = 0; i < len; i++) {
            out[i] = buf.readUInt32BE(i * 4)
        }

        return out
    }

    function scrubVec (v) {
        for (var i = 0; i < v.length; v++) {
            v[i] = 0
        }
    }

    function cryptBlock (M, keySchedule, SUB_MIX, SBOX, nRounds) {
        var SUB_MIX0 = SUB_MIX[0]
        var SUB_MIX1 = SUB_MIX[1]
        var SUB_MIX2 = SUB_MIX[2]
        var SUB_MIX3 = SUB_MIX[3]

        var s0 = M[0] ^ keySchedule[0]
        var s1 = M[1] ^ keySchedule[1]
        var s2 = M[2] ^ keySchedule[2]
        var s3 = M[3] ^ keySchedule[3]
        var t0, t1, t2, t3
        var ksRow = 4

        for (var round = 1; round < nRounds; round++) {
            t0 = SUB_MIX0[s0 >>> 24] ^ SUB_MIX1[(s1 >>> 16) & 0xff] ^ SUB_MIX2[(s2 >>> 8) & 0xff] ^ SUB_MIX3[s3 & 0xff] ^ keySchedule[ksRow++]
            t1 = SUB_MIX0[s1 >>> 24] ^ SUB_MIX1[(s2 >>> 16) & 0xff] ^ SUB_MIX2[(s3 >>> 8) & 0xff] ^ SUB_MIX3[s0 & 0xff] ^ keySchedule[ksRow++]
            t2 = SUB_MIX0[s2 >>> 24] ^ SUB_MIX1[(s3 >>> 16) & 0xff] ^ SUB_MIX2[(s0 >>> 8) & 0xff] ^ SUB_MIX3[s1 & 0xff] ^ keySchedule[ksRow++]
            t3 = SUB_MIX0[s3 >>> 24] ^ SUB_MIX1[(s0 >>> 16) & 0xff] ^ SUB_MIX2[(s1 >>> 8) & 0xff] ^ SUB_MIX3[s2 & 0xff] ^ keySchedule[ksRow++]
            s0 = t0
            s1 = t1
            s2 = t2
            s3 = t3
        }

        t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++]
        t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++]
        t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++]
        t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++]
        t0 = t0 >>> 0
        t1 = t1 >>> 0
        t2 = t2 >>> 0
        t3 = t3 >>> 0

        return [t0, t1, t2, t3]
    }

// AES constants
    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]
    var G = (function () {
        // Compute double table
        var d = new Array(256)
        for (var j = 0; j < 256; j++) {
            if (j < 128) {
                d[j] = j << 1
            } else {
                d[j] = (j << 1) ^ 0x11b
            }
        }

        var SBOX = []
        var INV_SBOX = []
        var SUB_MIX = [[], [], [], []]
        var INV_SUB_MIX = [[], [], [], []]

        // Walk GF(2^8)
        var x = 0
        var xi = 0
        for (var i = 0; i < 256; ++i) {
            // Compute sbox
            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4)
            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63
            SBOX[x] = sx
            INV_SBOX[sx] = x

            // Compute multiplication
            var x2 = d[x]
            var x4 = d[x2]
            var x8 = d[x4]

            // Compute sub bytes, mix columns tables
            var t = (d[sx] * 0x101) ^ (sx * 0x1010100)
            SUB_MIX[0][x] = (t << 24) | (t >>> 8)
            SUB_MIX[1][x] = (t << 16) | (t >>> 16)
            SUB_MIX[2][x] = (t << 8) | (t >>> 24)
            SUB_MIX[3][x] = t

            // Compute inv sub bytes, inv mix columns tables
            t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100)
            INV_SUB_MIX[0][sx] = (t << 24) | (t >>> 8)
            INV_SUB_MIX[1][sx] = (t << 16) | (t >>> 16)
            INV_SUB_MIX[2][sx] = (t << 8) | (t >>> 24)
            INV_SUB_MIX[3][sx] = t

            if (x === 0) {
                x = xi = 1
            } else {
                x = x2 ^ d[d[d[x8 ^ x2]]]
                xi ^= d[d[xi]]
            }
        }

        return {
            SBOX: SBOX,
            INV_SBOX: INV_SBOX,
            SUB_MIX: SUB_MIX,
            INV_SUB_MIX: INV_SUB_MIX
        }
    })()

    function AES (key) {
        this._key = asUInt32Array(key)
        this._reset()
    }

    AES.blockSize = 4 * 4
    AES.keySize = 256 / 8
    AES.prototype.blockSize = AES.blockSize
    AES.prototype.keySize = AES.keySize
    AES.prototype._reset = function () {
        var keyWords = this._key
        var keySize = keyWords.length
        var nRounds = keySize + 6
        var ksRows = (nRounds + 1) * 4

        var keySchedule = []
        for (var k = 0; k < keySize; k++) {
            keySchedule[k] = keyWords[k]
        }

        for (k = keySize; k < ksRows; k++) {
            var t = keySchedule[k - 1]

            if (k % keySize === 0) {
                t = (t << 8) | (t >>> 24)
                t =
                    (G.SBOX[t >>> 24] << 24) |
                    (G.SBOX[(t >>> 16) & 0xff] << 16) |
                    (G.SBOX[(t >>> 8) & 0xff] << 8) |
                    (G.SBOX[t & 0xff])

                t ^= RCON[(k / keySize) | 0] << 24
            } else if (keySize > 6 && k % keySize === 4) {
                t =
                    (G.SBOX[t >>> 24] << 24) |
                    (G.SBOX[(t >>> 16) & 0xff] << 16) |
                    (G.SBOX[(t >>> 8) & 0xff] << 8) |
                    (G.SBOX[t & 0xff])
            }

            keySchedule[k] = keySchedule[k - keySize] ^ t
        }

        var invKeySchedule = []
        for (var ik = 0; ik < ksRows; ik++) {
            var ksR = ksRows - ik
            var tt = keySchedule[ksR - (ik % 4 ? 0 : 4)]

            if (ik < 4 || ksR <= 4) {
                invKeySchedule[ik] = tt
            } else {
                invKeySchedule[ik] =
                    G.INV_SUB_MIX[0][G.SBOX[tt >>> 24]] ^
                    G.INV_SUB_MIX[1][G.SBOX[(tt >>> 16) & 0xff]] ^
                    G.INV_SUB_MIX[2][G.SBOX[(tt >>> 8) & 0xff]] ^
                    G.INV_SUB_MIX[3][G.SBOX[tt & 0xff]]
            }
        }

        this._nRounds = nRounds
        this._keySchedule = keySchedule
        this._invKeySchedule = invKeySchedule
    }

    AES.prototype.encryptBlockRaw = function (M) {
        M = asUInt32Array(M)
        return cryptBlock(M, this._keySchedule, G.SUB_MIX, G.SBOX, this._nRounds)
    }

    AES.prototype.encryptBlock = function (M) {
        var out = this.encryptBlockRaw(M)
        var buf = Buffer.allocUnsafe(16)
        buf.writeUInt32BE(out[0], 0)
        buf.writeUInt32BE(out[1], 4)
        buf.writeUInt32BE(out[2], 8)
        buf.writeUInt32BE(out[3], 12)
        return buf
    }

    AES.prototype.decryptBlock = function (M) {
        M = asUInt32Array(M)

        // swap
        var m1 = M[1]
        M[1] = M[3]
        M[3] = m1

        var out = cryptBlock(M, this._invKeySchedule, G.INV_SUB_MIX, G.INV_SBOX, this._nRounds)
        var buf = Buffer.allocUnsafe(16)
        buf.writeUInt32BE(out[0], 0)
        buf.writeUInt32BE(out[3], 4)
        buf.writeUInt32BE(out[2], 8)
        buf.writeUInt32BE(out[1], 12)
        return buf
    }

    AES.prototype.scrub = function () {
        scrubVec(this._keySchedule)
        scrubVec(this._invKeySchedule)
        scrubVec(this._key)
    }

    module.exports.AES = AES

},{"safe-buffer":173}],25:[function(require,module,exports){
    var aes = require('./aes')
    var Buffer = require('safe-buffer').Buffer
    var Transform = require('cipher-base')
    var inherits = require('inherits')
    var GHASH = require('./ghash')
    var xor = require('buffer-xor')
    var incr32 = require('./incr32')

    function xorTest (a, b) {
        var out = 0
        if (a.length !== b.length) out++

        var len = Math.min(a.length, b.length)
        for (var i = 0; i < len; ++i) {
            out += (a[i] ^ b[i])
        }

        return out
    }

    function calcIv (self, iv, ck) {
        if (iv.length === 12) {
            self._finID = Buffer.concat([iv, Buffer.from([0, 0, 0, 1])])
            return Buffer.concat([iv, Buffer.from([0, 0, 0, 2])])
        }
        var ghash = new GHASH(ck)
        var len = iv.length
        var toPad = len % 16
        ghash.update(iv)
        if (toPad) {
            toPad = 16 - toPad
            ghash.update(Buffer.alloc(toPad, 0))
        }
        ghash.update(Buffer.alloc(8, 0))
        var ivBits = len * 8
        var tail = Buffer.alloc(8)
        tail.writeUIntBE(ivBits, 0, 8)
        ghash.update(tail)
        self._finID = ghash.state
        var out = Buffer.from(self._finID)
        incr32(out)
        return out
    }
    function StreamCipher (mode, key, iv, decrypt) {
        Transform.call(this)

        var h = Buffer.alloc(4, 0)

        this._cipher = new aes.AES(key)
        var ck = this._cipher.encryptBlock(h)
        this._ghash = new GHASH(ck)
        iv = calcIv(this, iv, ck)

        this._prev = Buffer.from(iv)
        this._cache = Buffer.allocUnsafe(0)
        this._secCache = Buffer.allocUnsafe(0)
        this._decrypt = decrypt
        this._alen = 0
        this._len = 0
        this._mode = mode

        this._authTag = null
        this._called = false
    }

    inherits(StreamCipher, Transform)

    StreamCipher.prototype._update = function (chunk) {
        if (!this._called && this._alen) {
            var rump = 16 - (this._alen % 16)
            if (rump < 16) {
                rump = Buffer.alloc(rump, 0)
                this._ghash.update(rump)
            }
        }

        this._called = true
        var out = this._mode.encrypt(this, chunk)
        if (this._decrypt) {
            this._ghash.update(chunk)
        } else {
            this._ghash.update(out)
        }
        this._len += chunk.length
        return out
    }

    StreamCipher.prototype._final = function () {
        if (this._decrypt && !this._authTag) throw new Error('Unsupported state or unable to authenticate data')

        var tag = xor(this._ghash.final(this._alen * 8, this._len * 8), this._cipher.encryptBlock(this._finID))
        if (this._decrypt && xorTest(tag, this._authTag)) throw new Error('Unsupported state or unable to authenticate data')

        this._authTag = tag
        this._cipher.scrub()
    }

    StreamCipher.prototype.getAuthTag = function getAuthTag () {
        if (this._decrypt || !Buffer.isBuffer(this._authTag)) throw new Error('Attempting to get auth tag in unsupported state')

        return this._authTag
    }

    StreamCipher.prototype.setAuthTag = function setAuthTag (tag) {
        if (!this._decrypt) throw new Error('Attempting to set auth tag in unsupported state')

        this._authTag = tag
    }

    StreamCipher.prototype.setAAD = function setAAD (buf) {
        if (this._called) throw new Error('Attempting to set AAD in unsupported state')

        this._ghash.update(buf)
        this._alen += buf.length
    }

    module.exports = StreamCipher

},{"./aes":24,"./ghash":29,"./incr32":30,"buffer-xor":51,"cipher-base":53,"inherits":113,"safe-buffer":173}],26:[function(require,module,exports){
    var ciphers = require('./encrypter')
    var deciphers = require('./decrypter')
    var modes = require('./modes/list.json')

    function getCiphers () {
        return Object.keys(modes)
    }

    exports.createCipher = exports.Cipher = ciphers.createCipher
    exports.createCipheriv = exports.Cipheriv = ciphers.createCipheriv
    exports.createDecipher = exports.Decipher = deciphers.createDecipher
    exports.createDecipheriv = exports.Decipheriv = deciphers.createDecipheriv
    exports.listCiphers = exports.getCiphers = getCiphers

},{"./decrypter":27,"./encrypter":28,"./modes/list.json":38}],27:[function(require,module,exports){
    var AuthCipher = require('./authCipher')
    var Buffer = require('safe-buffer').Buffer
    var MODES = require('./modes')
    var StreamCipher = require('./streamCipher')
    var Transform = require('cipher-base')
    var aes = require('./aes')
    var ebtk = require('evp_bytestokey')
    var inherits = require('inherits')

    function Decipher (mode, key, iv) {
        Transform.call(this)

        this._cache = new Splitter()
        this._last = void 0
        this._cipher = new aes.AES(key)
        this._prev = Buffer.from(iv)
        this._mode = mode
        this._autopadding = true
    }

    inherits(Decipher, Transform)

    Decipher.prototype._update = function (data) {
        this._cache.add(data)
        var chunk
        var thing
        var out = []
        while ((chunk = this._cache.get(this._autopadding))) {
            thing = this._mode.decrypt(this, chunk)
            out.push(thing)
        }
        return Buffer.concat(out)
    }

    Decipher.prototype._final = function () {
        var chunk = this._cache.flush()
        if (this._autopadding) {
            return unpad(this._mode.decrypt(this, chunk))
        } else if (chunk) {
            throw new Error('data not multiple of block length')
        }
    }

    Decipher.prototype.setAutoPadding = function (setTo) {
        this._autopadding = !!setTo
        return this
    }

    function Splitter () {
        this.cache = Buffer.allocUnsafe(0)
    }

    Splitter.prototype.add = function (data) {
        this.cache = Buffer.concat([this.cache, data])
    }

    Splitter.prototype.get = function (autoPadding) {
        var out
        if (autoPadding) {
            if (this.cache.length > 16) {
                out = this.cache.slice(0, 16)
                this.cache = this.cache.slice(16)
                return out
            }
        } else {
            if (this.cache.length >= 16) {
                out = this.cache.slice(0, 16)
                this.cache = this.cache.slice(16)
                return out
            }
        }

        return null
    }

    Splitter.prototype.flush = function () {
        if (this.cache.length) return this.cache
    }

    function unpad (last) {
        var padded = last[15]
        if (padded < 1 || padded > 16) {
            throw new Error('unable to decrypt data')
        }
        var i = -1
        while (++i < padded) {
            if (last[(i + (16 - padded))] !== padded) {
                throw new Error('unable to decrypt data')
            }
        }
        if (padded === 16) return

        return last.slice(0, 16 - padded)
    }

    function createDecipheriv (suite, password, iv) {
        var config = MODES[suite.toLowerCase()]
        if (!config) throw new TypeError('invalid suite type')

        if (typeof iv === 'string') iv = Buffer.from(iv)
        if (config.mode !== 'GCM' && iv.length !== config.iv) throw new TypeError('invalid iv length ' + iv.length)

        if (typeof password === 'string') password = Buffer.from(password)
        if (password.length !== config.key / 8) throw new TypeError('invalid key length ' + password.length)

        if (config.type === 'stream') {
            return new StreamCipher(config.module, password, iv, true)
        } else if (config.type === 'auth') {
            return new AuthCipher(config.module, password, iv, true)
        }

        return new Decipher(config.module, password, iv)
    }

    function createDecipher (suite, password) {
        var config = MODES[suite.toLowerCase()]
        if (!config) throw new TypeError('invalid suite type')

        var keys = ebtk(password, false, config.key, config.iv)
        return createDecipheriv(suite, keys.key, keys.iv)
    }

    exports.createDecipher = createDecipher
    exports.createDecipheriv = createDecipheriv

},{"./aes":24,"./authCipher":25,"./modes":37,"./streamCipher":40,"cipher-base":53,"evp_bytestokey":95,"inherits":113,"safe-buffer":173}],28:[function(require,module,exports){
    var MODES = require('./modes')
    var AuthCipher = require('./authCipher')
    var Buffer = require('safe-buffer').Buffer
    var StreamCipher = require('./streamCipher')
    var Transform = require('cipher-base')
    var aes = require('./aes')
    var ebtk = require('evp_bytestokey')
    var inherits = require('inherits')

    function Cipher (mode, key, iv) {
        Transform.call(this)

        this._cache = new Splitter()
        this._cipher = new aes.AES(key)
        this._prev = Buffer.from(iv)
        this._mode = mode
        this._autopadding = true
    }

    inherits(Cipher, Transform)

    Cipher.prototype._update = function (data) {
        this._cache.add(data)
        var chunk
        var thing
        var out = []

        while ((chunk = this._cache.get())) {
            thing = this._mode.encrypt(this, chunk)
            out.push(thing)
        }

        return Buffer.concat(out)
    }

    var PADDING = Buffer.alloc(16, 0x10)

    Cipher.prototype._final = function () {
        var chunk = this._cache.flush()
        if (this._autopadding) {
            chunk = this._mode.encrypt(this, chunk)
            this._cipher.scrub()
            return chunk
        }

        if (!chunk.equals(PADDING)) {
            this._cipher.scrub()
            throw new Error('data not multiple of block length')
        }
    }

    Cipher.prototype.setAutoPadding = function (setTo) {
        this._autopadding = !!setTo
        return this
    }

    function Splitter () {
        this.cache = Buffer.allocUnsafe(0)
    }

    Splitter.prototype.add = function (data) {
        this.cache = Buffer.concat([this.cache, data])
    }

    Splitter.prototype.get = function () {
        if (this.cache.length > 15) {
            var out = this.cache.slice(0, 16)
            this.cache = this.cache.slice(16)
            return out
        }
        return null
    }

    Splitter.prototype.flush = function () {
        var len = 16 - this.cache.length
        var padBuff = Buffer.allocUnsafe(len)

        var i = -1
        while (++i < len) {
            padBuff.writeUInt8(len, i)
        }

        return Buffer.concat([this.cache, padBuff])
    }

    function createCipheriv (suite, password, iv) {
        var config = MODES[suite.toLowerCase()]
        if (!config) throw new TypeError('invalid suite type')

        if (typeof password === 'string') password = Buffer.from(password)
        if (password.length !== config.key / 8) throw new TypeError('invalid key length ' + password.length)

        if (typeof iv === 'string') iv = Buffer.from(iv)
        if (config.mode !== 'GCM' && iv.length !== config.iv) throw new TypeError('invalid iv length ' + iv.length)

        if (config.type === 'stream') {
            return new StreamCipher(config.module, password, iv)
        } else if (config.type === 'auth') {
            return new AuthCipher(config.module, password, iv)
        }

        return new Cipher(config.module, password, iv)
    }

    function createCipher (suite, password) {
        var config = MODES[suite.toLowerCase()]
        if (!config) throw new TypeError('invalid suite type')

        var keys = ebtk(password, false, config.key, config.iv)
        return createCipheriv(suite, keys.key, keys.iv)
    }

    exports.createCipheriv = createCipheriv
    exports.createCipher = createCipher

},{"./aes":24,"./authCipher":25,"./modes":37,"./streamCipher":40,"cipher-base":53,"evp_bytestokey":95,"inherits":113,"safe-buffer":173}],29:[function(require,module,exports){
    var Buffer = require('safe-buffer').Buffer
    var ZEROES = Buffer.alloc(16, 0)

    function toArray (buf) {
        return [
            buf.readUInt32BE(0),
            buf.readUInt32BE(4),
            buf.readUInt32BE(8),
            buf.readUInt32BE(12)
        ]
    }

    function fromArray (out) {
        var buf = Buffer.allocUnsafe(16)
        buf.writeUInt32BE(out[0] >>> 0, 0)
        buf.writeUInt32BE(out[1] >>> 0, 4)
        buf.writeUInt32BE(out[2] >>> 0, 8)
        buf.writeUInt32BE(out[3] >>> 0, 12)
        return buf
    }

    function GHASH (key) {
        this.h = key
        this.state = Buffer.alloc(16, 0)
        this.cache = Buffer.allocUnsafe(0)
    }

// from http://bitwiseshiftleft.github.io/sjcl/doc/symbols/src/core_gcm.js.html
// by Juho Vähä-Herttua
    GHASH.prototype.ghash = function (block) {
        var i = -1
        while (++i < block.length) {
            this.state[i] ^= block[i]
        }
        this._multiply()
    }

    GHASH.prototype._multiply = function () {
        var Vi = toArray(this.h)
        var Zi = [0, 0, 0, 0]
        var j, xi, lsbVi
        var i = -1
        while (++i < 128) {
            xi = (this.state[~~(i / 8)] & (1 << (7 - (i % 8)))) !== 0
            if (xi) {
                // Z_i+1 = Z_i ^ V_i
                Zi[0] ^= Vi[0]
                Zi[1] ^= Vi[1]
                Zi[2] ^= Vi[2]
                Zi[3] ^= Vi[3]
            }

            // Store the value of LSB(V_i)
            lsbVi = (Vi[3] & 1) !== 0

            // V_i+1 = V_i >> 1
            for (j = 3; j > 0; j--) {
                Vi[j] = (Vi[j] >>> 1) | ((Vi[j - 1] & 1) << 31)
            }
            Vi[0] = Vi[0] >>> 1

            // If LSB(V_i) is 1, V_i+1 = (V_i >> 1) ^ R
            if (lsbVi) {
                Vi[0] = Vi[0] ^ (0xe1 << 24)
            }
        }
        this.state = fromArray(Zi)
    }

    GHASH.prototype.update = function (buf) {
        this.cache = Buffer.concat([this.cache, buf])
        var chunk
        while (this.cache.length >= 16) {
            chunk = this.cache.slice(0, 16)
            this.cache = this.cache.slice(16)
            this.ghash(chunk)
        }
    }

    GHASH.prototype.final = function (abl, bl) {
        if (this.cache.length) {
            this.ghash(Buffer.concat([this.cache, ZEROES], 16))
        }

        this.ghash(fromArray([0, abl, 0, bl]))
        return this.state
    }

    module.exports = GHASH

},{"safe-buffer":173}],30:[function(require,module,exports){
    function incr32 (iv) {
        var len = iv.length
        var item
        while (len--) {
            item = iv.readUInt8(len)
            if (item === 255) {
                iv.writeUInt8(0, len)
            } else {
                item++
                iv.writeUInt8(item, len)
                break
            }
        }
    }
    module.exports = incr32

},{}],31:[function(require,module,exports){
    var xor = require('buffer-xor')

    exports.encrypt = function (self, block) {
        var data = xor(block, self._prev)

        self._prev = self._cipher.encryptBlock(data)
        return self._prev
    }

    exports.decrypt = function (self, block) {
        var pad = self._prev

        self._prev = block
        var out = self._cipher.decryptBlock(block)

        return xor(out, pad)
    }

},{"buffer-xor":51}],32:[function(require,module,exports){
    var Buffer = require('safe-buffer').Buffer
    var xor = require('buffer-xor')

    function encryptStart (self, data, decrypt) {
        var len = data.length
        var out = xor(data, self._cache)
        self._cache = self._cache.slice(len)
        self._prev = Buffer.concat([self._prev, decrypt ? data : out])
        return out
    }

    exports.encrypt = function (self, data, decrypt) {
        var out = Buffer.allocUnsafe(0)
        var len

        while (data.length) {
            if (self._cache.length === 0) {
                self._cache = self._cipher.encryptBlock(self._prev)
                self._prev = Buffer.allocUnsafe(0)
            }

            if (self._cache.length <= data.length) {
                len = self._cache.length
                out = Buffer.concat([out, encryptStart(self, data.slice(0, len), decrypt)])
                data = data.slice(len)
            } else {
                out = Buffer.concat([out, encryptStart(self, data, decrypt)])
                break
            }
        }

        return out
    }

},{"buffer-xor":51,"safe-buffer":173}],33:[function(require,module,exports){
    var Buffer = require('safe-buffer').Buffer

    function encryptByte (self, byteParam, decrypt) {
        var pad
        var i = -1
        var len = 8
        var out = 0
        var bit, value
        while (++i < len) {
            pad = self._cipher.encryptBlock(self._prev)
            bit = (byteParam & (1 << (7 - i))) ? 0x80 : 0
            value = pad[0] ^ bit
            out += ((value & 0x80) >> (i % 8))
            self._prev = shiftIn(self._prev, decrypt ? bit : value)
        }
        return out
    }

    function shiftIn (buffer, value) {
        var len = buffer.length
        var i = -1
        var out = Buffer.allocUnsafe(buffer.length)
        buffer = Buffer.concat([buffer, Buffer.from([value])])

        while (++i < len) {
            out[i] = buffer[i] << 1 | buffer[i + 1] >> (7)
        }

        return out
    }

    exports.encrypt = function (self, chunk, decrypt) {
        var len = chunk.length
        var out = Buffer.allocUnsafe(len)
        var i = -1

        while (++i < len) {
            out[i] = encryptByte(self, chunk[i], decrypt)
        }

        return out
    }

},{"safe-buffer":173}],34:[function(require,module,exports){
    var Buffer = require('safe-buffer').Buffer

    function encryptByte (self, byteParam, decrypt) {
        var pad = self._cipher.encryptBlock(self._prev)
        var out = pad[0] ^ byteParam

        self._prev = Buffer.concat([
            self._prev.slice(1),
            Buffer.from([decrypt ? byteParam : out])
        ])

        return out
    }

    exports.encrypt = function (self, chunk, decrypt) {
        var len = chunk.length
        var out = Buffer.allocUnsafe(len)
        var i = -1

        while (++i < len) {
            out[i] = encryptByte(self, chunk[i], decrypt)
        }

        return out
    }

},{"safe-buffer":173}],35:[function(require,module,exports){
    var xor = require('buffer-xor')
    var Buffer = require('safe-buffer').Buffer
    var incr32 = require('../incr32')

    function getBlock (self) {
        var out = self._cipher.encryptBlockRaw(self._prev)
        incr32(self._prev)
        return out
    }

    var blockSize = 16
    exports.encrypt = function (self, chunk) {
        var chunkNum = Math.ceil(chunk.length / blockSize)
        var start = self._cache.length
        self._cache = Buffer.concat([
            self._cache,
            Buffer.allocUnsafe(chunkNum * blockSize)
        ])
        for (var i = 0; i < chunkNum; i++) {
            var out = getBlock(self)
            var offset = start + i * blockSize
            self._cache.writeUInt32BE(out[0], offset + 0)
            self._cache.writeUInt32BE(out[1], offset + 4)
            self._cache.writeUInt32BE(out[2], offset + 8)
            self._cache.writeUInt32BE(out[3], offset + 12)
        }
        var pad = self._cache.slice(0, chunk.length)
        self._cache = self._cache.slice(chunk.length)
        return xor(chunk, pad)
    }

},{"../incr32":30,"buffer-xor":51,"safe-buffer":173}],36:[function(require,module,exports){
    exports.encrypt = function (self, block) {
        return self._cipher.encryptBlock(block)
    }

    exports.decrypt = function (self, block) {
        return self._cipher.decryptBlock(block)
    }

},{}],37:[function(require,module,exports){
    var modeModules = {
        ECB: require('./ecb'),
        CBC: require('./cbc'),
        CFB: require('./cfb'),
        CFB8: require('./cfb8'),
        CFB1: require('./cfb1'),
        OFB: require('./ofb'),
        CTR: require('./ctr'),
        GCM: require('./ctr')
    }

    var modes = require('./list.json')

    for (var key in modes) {
        modes[key].module = modeModules[modes[key].mode]
    }

    module.exports = modes

},{"./cbc":31,"./cfb":32,"./cfb1":33,"./cfb8":34,"./ctr":35,"./ecb":36,"./list.json":38,"./ofb":39}],38:[function(require,module,exports){
    module.exports={
        "aes-128-ecb": {
            "cipher": "AES",
            "key": 128,
            "iv": 0,
            "mode": "ECB",
            "type": "block"
        },
        "aes-192-ecb": {
            "cipher": "AES",
            "key": 192,
            "iv": 0,
            "mode": "ECB",
            "type": "block"
        },
        "aes-256-ecb": {
            "cipher": "AES",
            "key": 256,
            "iv": 0,
            "mode": "ECB",
            "type": "block"
        },
        "aes-128-cbc": {
            "cipher": "AES",
            "key": 128,
            "iv": 16,
            "mode": "CBC",
            "type": "block"
        },
        "aes-192-cbc": {
            "cipher": "AES",
            "key": 192,
            "iv": 16,
            "mode": "CBC",
            "type": "block"
        },
        "aes-256-cbc": {
            "cipher": "AES",
            "key": 256,
            "iv": 16,
            "mode": "CBC",
            "type": "block"
        },
        "aes128": {
            "cipher": "AES",
            "key": 128,
            "iv": 16,
            "mode": "CBC",
            "type": "block"
        },
        "aes192": {
            "cipher": "AES",
            "key": 192,
            "iv": 16,
            "mode": "CBC",
            "type": "block"
        },
        "aes256": {
            "cipher": "AES",
            "key": 256,
            "iv": 16,
            "mode": "CBC",
            "type": "block"
        },
        "aes-128-cfb": {
            "cipher": "AES",
            "key": 128,
            "iv": 16,
            "mode": "CFB",
            "type": "stream"
        },
        "aes-192-cfb": {
            "cipher": "AES",
            "key": 192,
            "iv": 16,
            "mode": "CFB",
            "type": "stream"
        },
        "aes-256-cfb": {
            "cipher": "AES",
            "key": 256,
            "iv": 16,
            "mode": "CFB",
            "type": "stream"
        },
        "aes-128-cfb8": {
            "cipher": "AES",
            "key": 128,
            "iv": 16,
            "mode": "CFB8",
            "type": "stream"
        },
        "aes-192-cfb8": {
            "cipher": "AES",
            "key": 192,
            "iv": 16,
            "mode": "CFB8",
            "type": "stream"
        },
        "aes-256-cfb8": {
            "cipher": "AES",
            "key": 256,
            "iv": 16,
            "mode": "CFB8",
            "type": "stream"
        },
        "aes-128-cfb1": {
            "cipher": "AES",
            "key": 128,
            "iv": 16,
            "mode": "CFB1",
            "type": "stream"
        },
        "aes-192-cfb1": {
            "cipher": "AES",
            "key": 192,
            "iv": 16,
            "mode": "CFB1",
            "type": "stream"
        },
        "aes-256-cfb1": {
            "cipher": "AES",
            "key": 256,
            "iv": 16,
            "mode": "CFB1",
            "type": "stream"
        },
        "aes-128-ofb": {
            "cipher": "AES",
            "key": 128,
            "iv": 16,
            "mode": "OFB",
            "type": "stream"
        },
        "aes-192-ofb": {
            "cipher": "AES",
            "key": 192,
            "iv": 16,
            "mode": "OFB",
            "type": "stream"
        },
        "aes-256-ofb": {
            "cipher": "AES",
            "key": 256,
            "iv": 16,
            "mode": "OFB",
            "type": "stream"
        },
        "aes-128-ctr": {
            "cipher": "AES",
            "key": 128,
            "iv": 16,
            "mode": "CTR",
            "type": "stream"
        },
        "aes-192-ctr": {
            "cipher": "AES",
            "key": 192,
            "iv": 16,
            "mode": "CTR",
            "type": "stream"
        },
        "aes-256-ctr": {
            "cipher": "AES",
            "key": 256,
            "iv": 16,
            "mode": "CTR",
            "type": "stream"
        },
        "aes-128-gcm": {
            "cipher": "AES",
            "key": 128,
            "iv": 12,
            "mode": "GCM",
            "type": "auth"
        },
        "aes-192-gcm": {
            "cipher": "AES",
            "key": 192,
            "iv": 12,
            "mode": "GCM",
            "type": "auth"
        },
        "aes-256-gcm": {
            "cipher": "AES",
            "key": 256,
            "iv": 12,
            "mode": "GCM",
            "type": "auth"
        }
    }

},{}],39:[function(require,module,exports){
    (function (Buffer){
        var xor = require('buffer-xor')

        function getBlock (self) {
            self._prev = self._cipher.encryptBlock(self._prev)
            return self._prev
        }

        exports.encrypt = function (self, chunk) {
            while (self._cache.length < chunk.length) {
                self._cache = Buffer.concat([self._cache, getBlock(self)])
            }

            var pad = self._cache.slice(0, chunk.length)
            self._cache = self._cache.slice(chunk.length)
            return xor(chunk, pad)
        }

    }).call(this,require("buffer").Buffer)
},{"buffer":52,"buffer-xor":51}],40:[function(require,module,exports){
    var aes = require('./aes')
    var Buffer = require('safe-buffer').Buffer
    var Transform = require('cipher-base')
    var inherits = require('inherits')

    function StreamCipher (mode, key, iv, decrypt) {
        Transform.call(this)

        this._cipher = new aes.AES(key)
        this._prev = Buffer.from(iv)
        this._cache = Buffer.allocUnsafe(0)
        this._secCache = Buffer.allocUnsafe(0)
        this._decrypt = decrypt
        this._mode = mode
    }

    inherits(StreamCipher, Transform)

    StreamCipher.prototype._update = function (chunk) {
        return this._mode.encrypt(this, chunk, this._decrypt)
    }

    StreamCipher.prototype._final = function () {
        this._cipher.scrub()
    }

    module.exports = StreamCipher

},{"./aes":24,"cipher-base":53,"inherits":113,"safe-buffer":173}],41:[function(require,module,exports){
    var DES = require('browserify-des')
    var aes = require('browserify-aes/browser')
    var aesModes = require('browserify-aes/modes')
    var desModes = require('browserify-des/modes')
    var ebtk = require('evp_bytestokey')

    function createCipher (suite, password) {
        suite = suite.toLowerCase()

        var keyLen, ivLen
        if (aesModes[suite]) {
            keyLen = aesModes[suite].key
            ivLen = aesModes[suite].iv
        } else if (desModes[suite]) {
            keyLen = desModes[suite].key * 8
            ivLen = desModes[suite].iv
        } else {
            throw new TypeError('invalid suite type')
        }

        var keys = ebtk(password, false, keyLen, ivLen)
        return createCipheriv(suite, keys.key, keys.iv)
    }

    function createDecipher (suite, password) {
        suite = suite.toLowerCase()

        var keyLen, ivLen
        if (aesModes[suite]) {
            keyLen = aesModes[suite].key
            ivLen = aesModes[suite].iv
        } else if (desModes[suite]) {
            keyLen = desModes[suite].key * 8
            ivLen = desModes[suite].iv
        } else {
            throw new TypeError('invalid suite type')
        }

        var keys = ebtk(password, false, keyLen, ivLen)
        return createDecipheriv(suite, keys.key, keys.iv)
    }

    function createCipheriv (suite, key, iv) {
        suite = suite.toLowerCase()
        if (aesModes[suite]) return aes.createCipheriv(suite, key, iv)
        if (desModes[suite]) return new DES({ key: key, iv: iv, mode: suite })

        throw new TypeError('invalid suite type')
    }

    function createDecipheriv (suite, key, iv) {
        suite = suite.toLowerCase()
        if (aesModes[suite]) return aes.createDecipheriv(suite, key, iv)
        if (desModes[suite]) return new DES({ key: key, iv: iv, mode: suite, decrypt: true })

        throw new TypeError('invalid suite type')
    }

    function getCiphers () {
        return Object.keys(desModes).concat(aes.getCiphers())
    }

    exports.createCipher = exports.Cipher = createCipher
    exports.createCipheriv = exports.Cipheriv = createCipheriv
    exports.createDecipher = exports.Decipher = createDecipher
    exports.createDecipheriv = exports.Decipheriv = createDecipheriv
    exports.listCiphers = exports.getCiphers = getCiphers

},{"browserify-aes/browser":26,"browserify-aes/modes":37,"browserify-des":42,"browserify-des/modes":43,"evp_bytestokey":95}],42:[function(require,module,exports){
    (function (Buffer){
        var CipherBase = require('cipher-base')
        var des = require('des.js')
        var inherits = require('inherits')

        var modes = {
            'des-ede3-cbc': des.CBC.instantiate(des.EDE),
            'des-ede3': des.EDE,
            'des-ede-cbc': des.CBC.instantiate(des.EDE),
            'des-ede': des.EDE,
            'des-cbc': des.CBC.instantiate(des.DES),
            'des-ecb': des.DES
        }
        modes.des = modes['des-cbc']
        modes.des3 = modes['des-ede3-cbc']
        module.exports = DES
        inherits(DES, CipherBase)
        function DES (opts) {
            CipherBase.call(this)
            var modeName = opts.mode.toLowerCase()
            var mode = modes[modeName]
            var type
            if (opts.decrypt) {
                type = 'decrypt'
            } else {
                type = 'encrypt'
            }
            var key = opts.key
            if (modeName === 'des-ede' || modeName === 'des-ede-cbc') {
                key = Buffer.concat([key, key.slice(0, 8)])
            }
            var iv = opts.iv
            this._des = mode.create({
                key: key,
                iv: iv,
                type: type
            })
        }
        DES.prototype._update = function (data) {
            return new Buffer(this._des.update(data))
        }
        DES.prototype._final = function () {
            return new Buffer(this._des.final())
        }

    }).call(this,require("buffer").Buffer)
},{"buffer":52,"cipher-base":53,"des.js":62,"inherits":113}],43:[function(require,module,exports){
    exports['des-ecb'] = {
        key: 8,
        iv: 0
    }
    exports['des-cbc'] = exports.des = {
        key: 8,
        iv: 8
    }
    exports['des-ede3-cbc'] = exports.des3 = {
        key: 24,
        iv: 8
    }
    exports['des-ede3'] = {
        key: 24,
        iv: 0
    }
    exports['des-ede-cbc'] = {
        key: 16,
        iv: 8
    }
    exports['des-ede'] = {
        key: 16,
        iv: 0
    }

},{}],44:[function(require,module,exports){
    (function (Buffer){
        var bn = require('bn.js');
        var randomBytes = require('randombytes');
        module.exports = crt;
        function blind(priv) {
            var r = getr(priv);
            var blinder = r.toRed(bn.mont(priv.modulus))
                .redPow(new bn(priv.publicExponent)).fromRed();
            return {
                blinder: blinder,
                unblinder:r.invm(priv.modulus)
            };
        }
        function crt(msg, priv) {
            var blinds = blind(priv);
            var len = priv.modulus.byteLength();
            var mod = bn.mont(priv.modulus);
            var blinded = new bn(msg).mul(blinds.blinder).umod(priv.modulus);
            var c1 = blinded.toRed(bn.mont(priv.prime1));
            var c2 = blinded.toRed(bn.mont(priv.prime2));
            var qinv = priv.coefficient;
            var p = priv.prime1;
            var q = priv.prime2;
            var m1 = c1.redPow(priv.exponent1);
            var m2 = c2.redPow(priv.exponent2);
            m1 = m1.fromRed();
            m2 = m2.fromRed();
            var h = m1.isub(m2).imul(qinv).umod(p);
            h.imul(q);
            m2.iadd(h);
            return new Buffer(m2.imul(blinds.unblinder).umod(priv.modulus).toArray(false, len));
        }
        crt.getr = getr;
        function getr(priv) {
            var len = priv.modulus.byteLength();
            var r = new bn(randomBytes(len));
            while (r.cmp(priv.modulus) >=  0 || !r.umod(priv.prime1) || !r.umod(priv.prime2)) {
                r = new bn(randomBytes(len));
            }
            return r;
        }

    }).call(this,require("buffer").Buffer)
},{"bn.js":21,"buffer":52,"randombytes":151}],45:[function(require,module,exports){
    module.exports = require('./browser/algorithms.json')

},{"./browser/algorithms.json":46}],46:[function(require,module,exports){
    module.exports={
        "sha224WithRSAEncryption": {
            "sign": "rsa",
            "hash": "sha224",
            "id": "302d300d06096086480165030402040500041c"
        },
        "RSA-SHA224": {
            "sign": "ecdsa/rsa",
            "hash": "sha224",
            "id": "302d300d06096086480165030402040500041c"
        },
        "sha256WithRSAEncryption": {
            "sign": "rsa",
            "hash": "sha256",
            "id": "3031300d060960864801650304020105000420"
        },
        "RSA-SHA256": {
            "sign": "ecdsa/rsa",
            "hash": "sha256",
            "id": "3031300d060960864801650304020105000420"
        },
        "sha384WithRSAEncryption": {
            "sign": "rsa",
            "hash": "sha384",
            "id": "3041300d060960864801650304020205000430"
        },
        "RSA-SHA384": {
            "sign": "ecdsa/rsa",
            "hash": "sha384",
            "id": "3041300d060960864801650304020205000430"
        },
        "sha512WithRSAEncryption": {
            "sign": "rsa",
            "hash": "sha512",
            "id": "3051300d060960864801650304020305000440"
        },
        "RSA-SHA512": {
            "sign": "ecdsa/rsa",
            "hash": "sha512",
            "id": "3051300d060960864801650304020305000440"
        },
        "RSA-SHA1": {
            "sign": "rsa",
            "hash": "sha1",
            "id": "3021300906052b0e03021a05000414"
        },
        "ecdsa-with-SHA1": {
            "sign": "ecdsa",
            "hash": "sha1",
            "id": ""
        },
        "sha256": {
            "sign": "ecdsa",
            "hash": "sha256",
            "id": ""
        },
        "sha224": {
            "sign": "ecdsa",
            "hash": "sha224",
            "id": ""
        },
        "sha384": {
            "sign": "ecdsa",
            "hash": "sha384",
            "id": ""
        },
        "sha512": {
            "sign": "ecdsa",
            "hash": "sha512",
            "id": ""
        },
        "DSA-SHA": {
            "sign": "dsa",
            "hash": "sha1",
            "id": ""
        },
        "DSA-SHA1": {
            "sign": "dsa",
            "hash": "sha1",
            "id": ""
        },
        "DSA": {
            "sign": "dsa",
            "hash": "sha1",
            "id": ""
        },
        "DSA-WITH-SHA224": {
            "sign": "dsa",
            "hash": "sha224",
            "id": ""
        },
        "DSA-SHA224": {
            "sign": "dsa",
            "hash": "sha224",
            "id": ""
        },
        "DSA-WITH-SHA256": {
            "sign": "dsa",
            "hash": "sha256",
            "id": ""
        },
        "DSA-SHA256": {
            "sign": "dsa",
            "hash": "sha256",
            "id": ""
        },
        "DSA-WITH-SHA384": {
            "sign": "dsa",
            "hash": "sha384",
            "id": ""
        },
        "DSA-SHA384": {
            "sign": "dsa",
            "hash": "sha384",
            "id": ""
        },
        "DSA-WITH-SHA512": {
            "sign": "dsa",
            "hash": "sha512",
            "id": ""
        },
        "DSA-SHA512": {
            "sign": "dsa",
            "hash": "sha512",
            "id": ""
        },
        "DSA-RIPEMD160": {
            "sign": "dsa",
            "hash": "rmd160",
            "id": ""
        },
        "ripemd160WithRSA": {
            "sign": "rsa",
            "hash": "rmd160",
            "id": "3021300906052b2403020105000414"
        },
        "RSA-RIPEMD160": {
            "sign": "rsa",
            "hash": "rmd160",
            "id": "3021300906052b2403020105000414"
        },
        "md5WithRSAEncryption": {
            "sign": "rsa",
            "hash": "md5",
            "id": "3020300c06082a864886f70d020505000410"
        },
        "RSA-MD5": {
            "sign": "rsa",
            "hash": "md5",
            "id": "3020300c06082a864886f70d020505000410"
        }
    }

},{}],47:[function(require,module,exports){
    module.exports={
        "1.3.132.0.10": "secp256k1",
        "1.3.132.0.33": "p224",
        "1.2.840.10045.3.1.1": "p192",
        "1.2.840.10045.3.1.7": "p256",
        "1.3.132.0.34": "p384",
        "1.3.132.0.35": "p521"
    }

},{}],48:[function(require,module,exports){
    (function (Buffer){
        var createHash = require('create-hash')
        var stream = require('stream')
        var inherits = require('inherits')
        var sign = require('./sign')
        var verify = require('./verify')

        var algorithms = require('./algorithms.json')
        Object.keys(algorithms).forEach(function (key) {
            algorithms[key].id = new Buffer(algorithms[key].id, 'hex')
            algorithms[key.toLowerCase()] = algorithms[key]
        })

        function Sign (algorithm) {
            stream.Writable.call(this)

            var data = algorithms[algorithm]
            if (!data) throw new Error('Unknown message digest')

            this._hashType = data.hash
            this._hash = createHash(data.hash)
            this._tag = data.id
            this._signType = data.sign
        }
        inherits(Sign, stream.Writable)

        Sign.prototype._write = function _write (data, _, done) {
            this._hash.update(data)
            done()
        }

        Sign.prototype.update = function update (data, enc) {
            if (typeof data === 'string') data = new Buffer(data, enc)

            this._hash.update(data)
            return this
        }

        Sign.prototype.sign = function signMethod (key, enc) {
            this.end()
            var hash = this._hash.digest()
            var sig = sign(hash, key, this._hashType, this._signType, this._tag)

            return enc ? sig.toString(enc) : sig
        }

        function Verify (algorithm) {
            stream.Writable.call(this)

            var data = algorithms[algorithm]
            if (!data) throw new Error('Unknown message digest')

            this._hash = createHash(data.hash)
            this._tag = data.id
            this._signType = data.sign
        }
        inherits(Verify, stream.Writable)

        Verify.prototype._write = function _write (data, _, done) {
            this._hash.update(data)
            done()
        }

        Verify.prototype.update = function update (data, enc) {
            if (typeof data === 'string') data = new Buffer(data, enc)

            this._hash.update(data)
            return this
        }

        Verify.prototype.verify = function verifyMethod (key, sig, enc) {
            if (typeof sig === 'string') sig = new Buffer(sig, enc)

            this.end()
            var hash = this._hash.digest()
            return verify(sig, hash, key, this._signType, this._tag)
        }

        function createSign (algorithm) {
            return new Sign(algorithm)
        }

        function createVerify (algorithm) {
            return new Verify(algorithm)
        }

        module.exports = {
            Sign: createSign,
            Verify: createVerify,
            createSign: createSign,
            createVerify: createVerify
        }

    }).call(this,require("buffer").Buffer)
},{"./algorithms.json":46,"./sign":49,"./verify":50,"buffer":52,"create-hash":56,"inherits":113,"stream":184}],49:[function(require,module,exports){
    (function (Buffer){
// much of this based on https://github.com/indutny/self-signed/blob/gh-pages/lib/rsa.js
        var createHmac = require('create-hmac')
        var crt = require('browserify-rsa')
        var EC = require('elliptic').ec
        var BN = require('bn.js')
        var parseKeys = require('parse-asn1')
        var curves = require('./curves.json')

        function sign (hash, key, hashType, signType, tag) {
            var priv = parseKeys(key)
            if (priv.curve) {
                // rsa keys can be interpreted as ecdsa ones in openssl
                if (signType !== 'ecdsa' && signType !== 'ecdsa/rsa') throw new Error('wrong private key type')
                return ecSign(hash, priv)
            } else if (priv.type === 'dsa') {
                if (signType !== 'dsa') throw new Error('wrong private key type')
                return dsaSign(hash, priv, hashType)
            } else {
                if (signType !== 'rsa' && signType !== 'ecdsa/rsa') throw new Error('wrong private key type')
            }
            hash = Buffer.concat([tag, hash])
            var len = priv.modulus.byteLength()
            var pad = [ 0, 1 ]
            while (hash.length + pad.length + 1 < len) pad.push(0xff)
            pad.push(0x00)
            var i = -1
            while (++i < hash.length) pad.push(hash[i])

            var out = crt(pad, priv)
            return out
        }

        function ecSign (hash, priv) {
            var curveId = curves[priv.curve.join('.')]
            if (!curveId) throw new Error('unknown curve ' + priv.curve.join('.'))

            var curve = new EC(curveId)
            var key = curve.keyFromPrivate(priv.privateKey)
            var out = key.sign(hash)

            return new Buffer(out.toDER())
        }

        function dsaSign (hash, priv, algo) {
            var x = priv.params.priv_key
            var p = priv.params.p
            var q = priv.params.q
            var g = priv.params.g
            var r = new BN(0)
            var k
            var H = bits2int(hash, q).mod(q)
            var s = false
            var kv = getKey(x, q, hash, algo)
            while (s === false) {
                k = makeKey(q, kv, algo)
                r = makeR(g, k, p, q)
                s = k.invm(q).imul(H.add(x.mul(r))).mod(q)
                if (s.cmpn(0) === 0) {
                    s = false
                    r = new BN(0)
                }
            }
            return toDER(r, s)
        }

        function toDER (r, s) {
            r = r.toArray()
            s = s.toArray()

            // Pad values
            if (r[0] & 0x80) r = [ 0 ].concat(r)
            if (s[0] & 0x80) s = [ 0 ].concat(s)

            var total = r.length + s.length + 4
            var res = [ 0x30, total, 0x02, r.length ]
            res = res.concat(r, [ 0x02, s.length ], s)
            return new Buffer(res)
        }

        function getKey (x, q, hash, algo) {
            x = new Buffer(x.toArray())
            if (x.length < q.byteLength()) {
                var zeros = new Buffer(q.byteLength() - x.length)
                zeros.fill(0)
                x = Buffer.concat([ zeros, x ])
            }
            var hlen = hash.length
            var hbits = bits2octets(hash, q)
            var v = new Buffer(hlen)
            v.fill(1)
            var k = new Buffer(hlen)
            k.fill(0)
            k = createHmac(algo, k).update(v).update(new Buffer([ 0 ])).update(x).update(hbits).digest()
            v = createHmac(algo, k).update(v).digest()
            k = createHmac(algo, k).update(v).update(new Buffer([ 1 ])).update(x).update(hbits).digest()
            v = createHmac(algo, k).update(v).digest()
            return { k: k, v: v }
        }

        function bits2int (obits, q) {
            var bits = new BN(obits)
            var shift = (obits.length << 3) - q.bitLength()
            if (shift > 0) bits.ishrn(shift)
            return bits
        }

        function bits2octets (bits, q) {
            bits = bits2int(bits, q)
            bits = bits.mod(q)
            var out = new Buffer(bits.toArray())
            if (out.length < q.byteLength()) {
                var zeros = new Buffer(q.byteLength() - out.length)
                zeros.fill(0)
                out = Buffer.concat([ zeros, out ])
            }
            return out
        }

        function makeKey (q, kv, algo) {
            var t
            var k

            do {
                t = new Buffer(0)

                while (t.length * 8 < q.bitLength()) {
                    kv.v = createHmac(algo, kv.k).update(kv.v).digest()
                    t = Buffer.concat([ t, kv.v ])
                }

                k = bits2int(t, q)
                kv.k = createHmac(algo, kv.k).update(kv.v).update(new Buffer([ 0 ])).digest()
                kv.v = createHmac(algo, kv.k).update(kv.v).digest()
            } while (k.cmp(q) !== -1)

            return k
        }

        function makeR (g, k, p, q) {
            return g.toRed(BN.mont(p)).redPow(k).fromRed().mod(q)
        }

        module.exports = sign
        module.exports.getKey = getKey
        module.exports.makeKey = makeKey

    }).call(this,require("buffer").Buffer)
},{"./curves.json":47,"bn.js":21,"browserify-rsa":44,"buffer":52,"create-hmac":58,"elliptic":72,"parse-asn1":131}],50:[function(require,module,exports){
    (function (Buffer){
// much of this based on https://github.com/indutny/self-signed/blob/gh-pages/lib/rsa.js
        var BN = require('bn.js')
        var EC = require('elliptic').ec
        var parseKeys = require('parse-asn1')
        var curves = require('./curves.json')

        function verify (sig, hash, key, signType, tag) {
            var pub = parseKeys(key)
            if (pub.type === 'ec') {
                // rsa keys can be interpreted as ecdsa ones in openssl
                if (signType !== 'ecdsa' && signType !== 'ecdsa/rsa') throw new Error('wrong public key type')
                return ecVerify(sig, hash, pub)
            } else if (pub.type === 'dsa') {
                if (signType !== 'dsa') throw new Error('wrong public key type')
                return dsaVerify(sig, hash, pub)
            } else {
                if (signType !== 'rsa' && signType !== 'ecdsa/rsa') throw new Error('wrong public key type')
            }
            hash = Buffer.concat([tag, hash])
            var len = pub.modulus.byteLength()
            var pad = [ 1 ]
            var padNum = 0
            while (hash.length + pad.length + 2 < len) {
                pad.push(0xff)
                padNum++
            }
            pad.push(0x00)
            var i = -1
            while (++i < hash.length) {
                pad.push(hash[i])
            }
            pad = new Buffer(pad)
            var red = BN.mont(pub.modulus)
            sig = new BN(sig).toRed(red)

            sig = sig.redPow(new BN(pub.publicExponent))
            sig = new Buffer(sig.fromRed().toArray())
            var out = padNum < 8 ? 1 : 0
            len = Math.min(sig.length, pad.length)
            if (sig.length !== pad.length) out = 1

            i = -1
            while (++i < len) out |= sig[i] ^ pad[i]
            return out === 0
        }

        function ecVerify (sig, hash, pub) {
            var curveId = curves[pub.data.algorithm.curve.join('.')]
            if (!curveId) throw new Error('unknown curve ' + pub.data.algorithm.curve.join('.'))

            var curve = new EC(curveId)
            var pubkey = pub.data.subjectPrivateKey.data

            return curve.verify(hash, sig, pubkey)
        }

        function dsaVerify (sig, hash, pub) {
            var p = pub.data.p
            var q = pub.data.q
            var g = pub.data.g
            var y = pub.data.pub_key
            var unpacked = parseKeys.signature.decode(sig, 'der')
            var s = unpacked.s
            var r = unpacked.r
            checkValue(s, q)
            checkValue(r, q)
            var montp = BN.mont(p)
            var w = s.invm(q)
            var v = g.toRed(montp)
                .redPow(new BN(hash).mul(w).mod(q))
                .fromRed()
                .mul(y.toRed(montp).redPow(r.mul(w).mod(q)).fromRed())
                .mod(p)
                .mod(q)
            return v.cmp(r) === 0
        }

        function checkValue (b, q) {
            if (b.cmpn(0) <= 0) throw new Error('invalid sig')
            if (b.cmp(q) >= q) throw new Error('invalid sig')
        }

        module.exports = verify

    }).call(this,require("buffer").Buffer)
},{"./curves.json":47,"bn.js":21,"buffer":52,"elliptic":72,"parse-asn1":131}],51:[function(require,module,exports){
    (function (Buffer){
        module.exports = function xor (a, b) {
            var length = Math.min(a.length, b.length)
            var buffer = new Buffer(length)

            for (var i = 0; i < length; ++i) {
                buffer[i] = a[i] ^ b[i]
            }

            return buffer
        }

    }).call(this,require("buffer").Buffer)
},{"buffer":52}],52:[function(require,module,exports){
    /*!
     * The buffer module from node.js, for the browser.
     *
     * @author   Feross Aboukhadijeh <https://feross.org>
     * @license  MIT
     */
    /* eslint-disable no-proto */

    'use strict'

    var base64 = require('base64-js')
    var ieee754 = require('ieee754')

    exports.Buffer = Buffer
    exports.SlowBuffer = SlowBuffer
    exports.INSPECT_MAX_BYTES = 50

    var K_MAX_LENGTH = 0x7fffffff
    exports.kMaxLength = K_MAX_LENGTH

    /**
     * If `Buffer.TYPED_ARRAY_SUPPORT`:
     *   === true    Use Uint8Array implementation (fastest)
     *   === false   Print warning and recommend using `buffer` v4.x which has an Object
     *               implementation (most compatible, even IE6)
     *
     * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
     * Opera 11.6+, iOS 4.2+.
     *
     * We report that the browser does not support typed arrays if the are not subclassable
     * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
     * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
     * for __proto__ and has a buggy typed array implementation.
     */
    Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

    if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
        typeof console.error === 'function') {
        console.error(
            'This browser lacks typed array (Uint8Array) support which is required by ' +
            '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
        )
    }

    function typedArraySupport () {
        // Can typed array instances can be augmented?
        try {
            var arr = new Uint8Array(1)
            arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
            return arr.foo() === 42
        } catch (e) {
            return false
        }
    }

    Object.defineProperty(Buffer.prototype, 'parent', {
        get: function () {
            if (!(this instanceof Buffer)) {
                return undefined
            }
            return this.buffer
        }
    })

    Object.defineProperty(Buffer.prototype, 'offset', {
        get: function () {
            if (!(this instanceof Buffer)) {
                return undefined
            }
            return this.byteOffset
        }
    })

    function createBuffer (length) {
        if (length > K_MAX_LENGTH) {
            throw new RangeError('Invalid typed array length')
        }
        // Return an augmented `Uint8Array` instance
        var buf = new Uint8Array(length)
        buf.__proto__ = Buffer.prototype
        return buf
    }

    /**
     * The Buffer constructor returns instances of `Uint8Array` that have their
     * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
     * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
     * and the `Uint8Array` methods. Square bracket notation works as expected -- it
     * returns a single octet.
     *
     * The `Uint8Array` prototype remains unmodified.
     */

    function Buffer (arg, encodingOrOffset, length) {
        // Common case.
        if (typeof arg === 'number') {
            if (typeof encodingOrOffset === 'string') {
                throw new Error(
                    'If encoding is specified then the first argument must be a string'
                )
            }
            return allocUnsafe(arg)
        }
        return from(arg, encodingOrOffset, length)
    }

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    if (typeof Symbol !== 'undefined' && Symbol.species &&
        Buffer[Symbol.species] === Buffer) {
        Object.defineProperty(Buffer, Symbol.species, {
            value: null,
            configurable: true,
            enumerable: false,
            writable: false
        })
    }

    Buffer.poolSize = 8192 // not used by this implementation

    function from (value, encodingOrOffset, length) {
        if (typeof value === 'number') {
            throw new TypeError('"value" argument must not be a number')
        }

        if (isArrayBuffer(value) || (value && isArrayBuffer(value.buffer))) {
            return fromArrayBuffer(value, encodingOrOffset, length)
        }

        if (typeof value === 'string') {
            return fromString(value, encodingOrOffset)
        }

        return fromObject(value)
    }

    /**
     * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
     * if value is a number.
     * Buffer.from(str[, encoding])
     * Buffer.from(array)
     * Buffer.from(buffer)
     * Buffer.from(arrayBuffer[, byteOffset[, length]])
     **/
    Buffer.from = function (value, encodingOrOffset, length) {
        return from(value, encodingOrOffset, length)
    }

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
    Buffer.prototype.__proto__ = Uint8Array.prototype
    Buffer.__proto__ = Uint8Array

    function assertSize (size) {
        if (typeof size !== 'number') {
            throw new TypeError('"size" argument must be of type number')
        } else if (size < 0) {
            throw new RangeError('"size" argument must not be negative')
        }
    }

    function alloc (size, fill, encoding) {
        assertSize(size)
        if (size <= 0) {
            return createBuffer(size)
        }
        if (fill !== undefined) {
            // Only pay attention to encoding if it's a string. This
            // prevents accidentally sending in a number that would
            // be interpretted as a start offset.
            return typeof encoding === 'string'
                ? createBuffer(size).fill(fill, encoding)
                : createBuffer(size).fill(fill)
        }
        return createBuffer(size)
    }

    /**
     * Creates a new filled Buffer instance.
     * alloc(size[, fill[, encoding]])
     **/
    Buffer.alloc = function (size, fill, encoding) {
        return alloc(size, fill, encoding)
    }

    function allocUnsafe (size) {
        assertSize(size)
        return createBuffer(size < 0 ? 0 : checked(size) | 0)
    }

    /**
     * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
     * */
    Buffer.allocUnsafe = function (size) {
        return allocUnsafe(size)
    }
    /**
     * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
     */
    Buffer.allocUnsafeSlow = function (size) {
        return allocUnsafe(size)
    }

    function fromString (string, encoding) {
        if (typeof encoding !== 'string' || encoding === '') {
            encoding = 'utf8'
        }

        if (!Buffer.isEncoding(encoding)) {
            throw new TypeError('Unknown encoding: ' + encoding)
        }

        var length = byteLength(string, encoding) | 0
        var buf = createBuffer(length)

        var actual = buf.write(string, encoding)

        if (actual !== length) {
            // Writing a hex string, for example, that contains invalid characters will
            // cause everything after the first invalid character to be ignored. (e.g.
            // 'abxxcd' will be treated as 'ab')
            buf = buf.slice(0, actual)
        }

        return buf
    }

    function fromArrayLike (array) {
        var length = array.length < 0 ? 0 : checked(array.length) | 0
        var buf = createBuffer(length)
        for (var i = 0; i < length; i += 1) {
            buf[i] = array[i] & 255
        }
        return buf
    }

    function fromArrayBuffer (array, byteOffset, length) {
        if (byteOffset < 0 || array.byteLength < byteOffset) {
            throw new RangeError('"offset" is outside of buffer bounds')
        }

        if (array.byteLength < byteOffset + (length || 0)) {
            throw new RangeError('"length" is outside of buffer bounds')
        }

        var buf
        if (byteOffset === undefined && length === undefined) {
            buf = new Uint8Array(array)
        } else if (length === undefined) {
            buf = new Uint8Array(array, byteOffset)
        } else {
            buf = new Uint8Array(array, byteOffset, length)
        }

        // Return an augmented `Uint8Array` instance
        buf.__proto__ = Buffer.prototype
        return buf
    }

    function fromObject (obj) {
        if (Buffer.isBuffer(obj)) {
            var len = checked(obj.length) | 0
            var buf = createBuffer(len)

            if (buf.length === 0) {
                return buf
            }

            obj.copy(buf, 0, 0, len)
            return buf
        }

        if (obj) {
            if (ArrayBuffer.isView(obj) || 'length' in obj) {
                if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
                    return createBuffer(0)
                }
                return fromArrayLike(obj)
            }

            if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
                return fromArrayLike(obj.data)
            }
        }

        throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object.')
    }

    function checked (length) {
        // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
        // length is NaN (which is otherwise coerced to zero.)
        if (length >= K_MAX_LENGTH) {
            throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
        }
        return length | 0
    }

    function SlowBuffer (length) {
        if (+length != length) { // eslint-disable-line eqeqeq
            length = 0
        }
        return Buffer.alloc(+length)
    }

    Buffer.isBuffer = function isBuffer (b) {
        return b != null && b._isBuffer === true
    }

    Buffer.compare = function compare (a, b) {
        if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
            throw new TypeError('Arguments must be Buffers')
        }

        if (a === b) return 0

        var x = a.length
        var y = b.length

        for (var i = 0, len = Math.min(x, y); i < len; ++i) {
            if (a[i] !== b[i]) {
                x = a[i]
                y = b[i]
                break
            }
        }

        if (x < y) return -1
        if (y < x) return 1
        return 0
    }

    Buffer.isEncoding = function isEncoding (encoding) {
        switch (String(encoding).toLowerCase()) {
            case 'hex':
            case 'utf8':
            case 'utf-8':
            case 'ascii':
            case 'latin1':
            case 'binary':
            case 'base64':
            case 'ucs2':
            case 'ucs-2':
            case 'utf16le':
            case 'utf-16le':
                return true
            default:
                return false
        }
    }

    Buffer.concat = function concat (list, length) {
        if (!Array.isArray(list)) {
            throw new TypeError('"list" argument must be an Array of Buffers')
        }

        if (list.length === 0) {
            return Buffer.alloc(0)
        }

        var i
        if (length === undefined) {
            length = 0
            for (i = 0; i < list.length; ++i) {
                length += list[i].length
            }
        }

        var buffer = Buffer.allocUnsafe(length)
        var pos = 0
        for (i = 0; i < list.length; ++i) {
            var buf = list[i]
            if (ArrayBuffer.isView(buf)) {
                buf = Buffer.from(buf)
            }
            if (!Buffer.isBuffer(buf)) {
                throw new TypeError('"list" argument must be an Array of Buffers')
            }
            buf.copy(buffer, pos)
            pos += buf.length
        }
        return buffer
    }

    function byteLength (string, encoding) {
        if (Buffer.isBuffer(string)) {
            return string.length
        }
        if (ArrayBuffer.isView(string) || isArrayBuffer(string)) {
            return string.byteLength
        }
        if (typeof string !== 'string') {
            string = '' + string
        }

        var len = string.length
        if (len === 0) return 0

        // Use a for loop to avoid recursion
        var loweredCase = false
        for (;;) {
            switch (encoding) {
                case 'ascii':
                case 'latin1':
                case 'binary':
                    return len
                case 'utf8':
                case 'utf-8':
                case undefined:
                    return utf8ToBytes(string).length
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                    return len * 2
                case 'hex':
                    return len >>> 1
                case 'base64':
                    return base64ToBytes(string).length
                default:
                    if (loweredCase) return utf8ToBytes(string).length // assume utf8
                    encoding = ('' + encoding).toLowerCase()
                    loweredCase = true
            }
        }
    }
    Buffer.byteLength = byteLength

    function slowToString (encoding, start, end) {
        var loweredCase = false

        // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
        // property of a typed array.

        // This behaves neither like String nor Uint8Array in that we set start/end
        // to their upper/lower bounds if the value passed is out of range.
        // undefined is handled specially as per ECMA-262 6th Edition,
        // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
        if (start === undefined || start < 0) {
            start = 0
        }
        // Return early if start > this.length. Done here to prevent potential uint32
        // coercion fail below.
        if (start > this.length) {
            return ''
        }

        if (end === undefined || end > this.length) {
            end = this.length
        }

        if (end <= 0) {
            return ''
        }

        // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
        end >>>= 0
        start >>>= 0

        if (end <= start) {
            return ''
        }

        if (!encoding) encoding = 'utf8'

        while (true) {
            switch (encoding) {
                case 'hex':
                    return hexSlice(this, start, end)

                case 'utf8':
                case 'utf-8':
                    return utf8Slice(this, start, end)

                case 'ascii':
                    return asciiSlice(this, start, end)

                case 'latin1':
                case 'binary':
                    return latin1Slice(this, start, end)

                case 'base64':
                    return base64Slice(this, start, end)

                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                    return utf16leSlice(this, start, end)

                default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = (encoding + '').toLowerCase()
                    loweredCase = true
            }
        }
    }

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
    Buffer.prototype._isBuffer = true

    function swap (b, n, m) {
        var i = b[n]
        b[n] = b[m]
        b[m] = i
    }

    Buffer.prototype.swap16 = function swap16 () {
        var len = this.length
        if (len % 2 !== 0) {
            throw new RangeError('Buffer size must be a multiple of 16-bits')
        }
        for (var i = 0; i < len; i += 2) {
            swap(this, i, i + 1)
        }
        return this
    }

    Buffer.prototype.swap32 = function swap32 () {
        var len = this.length
        if (len % 4 !== 0) {
            throw new RangeError('Buffer size must be a multiple of 32-bits')
        }
        for (var i = 0; i < len; i += 4) {
            swap(this, i, i + 3)
            swap(this, i + 1, i + 2)
        }
        return this
    }

    Buffer.prototype.swap64 = function swap64 () {
        var len = this.length
        if (len % 8 !== 0) {
            throw new RangeError('Buffer size must be a multiple of 64-bits')
        }
        for (var i = 0; i < len; i += 8) {
            swap(this, i, i + 7)
            swap(this, i + 1, i + 6)
            swap(this, i + 2, i + 5)
            swap(this, i + 3, i + 4)
        }
        return this
    }

    Buffer.prototype.toString = function toString () {
        var length = this.length
        if (length === 0) return ''
        if (arguments.length === 0) return utf8Slice(this, 0, length)
        return slowToString.apply(this, arguments)
    }

    Buffer.prototype.toLocaleString = Buffer.prototype.toString

    Buffer.prototype.equals = function equals (b) {
        if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
        if (this === b) return true
        return Buffer.compare(this, b) === 0
    }

    Buffer.prototype.inspect = function inspect () {
        var str = ''
        var max = exports.INSPECT_MAX_BYTES
        if (this.length > 0) {
            str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
            if (this.length > max) str += ' ... '
        }
        return '<Buffer ' + str + '>'
    }

    Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
        if (!Buffer.isBuffer(target)) {
            throw new TypeError('Argument must be a Buffer')
        }

        if (start === undefined) {
            start = 0
        }
        if (end === undefined) {
            end = target ? target.length : 0
        }
        if (thisStart === undefined) {
            thisStart = 0
        }
        if (thisEnd === undefined) {
            thisEnd = this.length
        }

        if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
            throw new RangeError('out of range index')
        }

        if (thisStart >= thisEnd && start >= end) {
            return 0
        }
        if (thisStart >= thisEnd) {
            return -1
        }
        if (start >= end) {
            return 1
        }

        start >>>= 0
        end >>>= 0
        thisStart >>>= 0
        thisEnd >>>= 0

        if (this === target) return 0

        var x = thisEnd - thisStart
        var y = end - start
        var len = Math.min(x, y)

        var thisCopy = this.slice(thisStart, thisEnd)
        var targetCopy = target.slice(start, end)

        for (var i = 0; i < len; ++i) {
            if (thisCopy[i] !== targetCopy[i]) {
                x = thisCopy[i]
                y = targetCopy[i]
                break
            }
        }

        if (x < y) return -1
        if (y < x) return 1
        return 0
    }

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
    function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
        // Empty buffer means no match
        if (buffer.length === 0) return -1

        // Normalize byteOffset
        if (typeof byteOffset === 'string') {
            encoding = byteOffset
            byteOffset = 0
        } else if (byteOffset > 0x7fffffff) {
            byteOffset = 0x7fffffff
        } else if (byteOffset < -0x80000000) {
            byteOffset = -0x80000000
        }
        byteOffset = +byteOffset  // Coerce to Number.
        if (numberIsNaN(byteOffset)) {
            // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
            byteOffset = dir ? 0 : (buffer.length - 1)
        }

        // Normalize byteOffset: negative offsets start from the end of the buffer
        if (byteOffset < 0) byteOffset = buffer.length + byteOffset
        if (byteOffset >= buffer.length) {
            if (dir) return -1
            else byteOffset = buffer.length - 1
        } else if (byteOffset < 0) {
            if (dir) byteOffset = 0
            else return -1
        }

        // Normalize val
        if (typeof val === 'string') {
            val = Buffer.from(val, encoding)
        }

        // Finally, search either indexOf (if dir is true) or lastIndexOf
        if (Buffer.isBuffer(val)) {
            // Special case: looking for empty string/buffer always fails
            if (val.length === 0) {
                return -1
            }
            return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
        } else if (typeof val === 'number') {
            val = val & 0xFF // Search for a byte value [0-255]
            if (typeof Uint8Array.prototype.indexOf === 'function') {
                if (dir) {
                    return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
                } else {
                    return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
                }
            }
            return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
        }

        throw new TypeError('val must be string, number or Buffer')
    }

    function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
        var indexSize = 1
        var arrLength = arr.length
        var valLength = val.length

        if (encoding !== undefined) {
            encoding = String(encoding).toLowerCase()
            if (encoding === 'ucs2' || encoding === 'ucs-2' ||
                encoding === 'utf16le' || encoding === 'utf-16le') {
                if (arr.length < 2 || val.length < 2) {
                    return -1
                }
                indexSize = 2
                arrLength /= 2
                valLength /= 2
                byteOffset /= 2
            }
        }

        function read (buf, i) {
            if (indexSize === 1) {
                return buf[i]
            } else {
                return buf.readUInt16BE(i * indexSize)
            }
        }

        var i
        if (dir) {
            var foundIndex = -1
            for (i = byteOffset; i < arrLength; i++) {
                if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                    if (foundIndex === -1) foundIndex = i
                    if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
                } else {
                    if (foundIndex !== -1) i -= i - foundIndex
                    foundIndex = -1
                }
            }
        } else {
            if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
            for (i = byteOffset; i >= 0; i--) {
                var found = true
                for (var j = 0; j < valLength; j++) {
                    if (read(arr, i + j) !== read(val, j)) {
                        found = false
                        break
                    }
                }
                if (found) return i
            }
        }

        return -1
    }

    Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
        return this.indexOf(val, byteOffset, encoding) !== -1
    }

    Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
    }

    Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
    }

    function hexWrite (buf, string, offset, length) {
        offset = Number(offset) || 0
        var remaining = buf.length - offset
        if (!length) {
            length = remaining
        } else {
            length = Number(length)
            if (length > remaining) {
                length = remaining
            }
        }

        var strLen = string.length

        if (length > strLen / 2) {
            length = strLen / 2
        }
        for (var i = 0; i < length; ++i) {
            var parsed = parseInt(string.substr(i * 2, 2), 16)
            if (numberIsNaN(parsed)) return i
            buf[offset + i] = parsed
        }
        return i
    }

    function utf8Write (buf, string, offset, length) {
        return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
    }

    function asciiWrite (buf, string, offset, length) {
        return blitBuffer(asciiToBytes(string), buf, offset, length)
    }

    function latin1Write (buf, string, offset, length) {
        return asciiWrite(buf, string, offset, length)
    }

    function base64Write (buf, string, offset, length) {
        return blitBuffer(base64ToBytes(string), buf, offset, length)
    }

    function ucs2Write (buf, string, offset, length) {
        return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
    }

    Buffer.prototype.write = function write (string, offset, length, encoding) {
        // Buffer#write(string)
        if (offset === undefined) {
            encoding = 'utf8'
            length = this.length
            offset = 0
            // Buffer#write(string, encoding)
        } else if (length === undefined && typeof offset === 'string') {
            encoding = offset
            length = this.length
            offset = 0
            // Buffer#write(string, offset[, length][, encoding])
        } else if (isFinite(offset)) {
            offset = offset >>> 0
            if (isFinite(length)) {
                length = length >>> 0
                if (encoding === undefined) encoding = 'utf8'
            } else {
                encoding = length
                length = undefined
            }
        } else {
            throw new Error(
                'Buffer.write(string, encoding, offset[, length]) is no longer supported'
            )
        }

        var remaining = this.length - offset
        if (length === undefined || length > remaining) length = remaining

        if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
            throw new RangeError('Attempt to write outside buffer bounds')
        }

        if (!encoding) encoding = 'utf8'

        var loweredCase = false
        for (;;) {
            switch (encoding) {
                case 'hex':
                    return hexWrite(this, string, offset, length)

                case 'utf8':
                case 'utf-8':
                    return utf8Write(this, string, offset, length)

                case 'ascii':
                    return asciiWrite(this, string, offset, length)

                case 'latin1':
                case 'binary':
                    return latin1Write(this, string, offset, length)

                case 'base64':
                    // Warning: maxLength not taken into account in base64Write
                    return base64Write(this, string, offset, length)

                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                    return ucs2Write(this, string, offset, length)

                default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = ('' + encoding).toLowerCase()
                    loweredCase = true
            }
        }
    }

    Buffer.prototype.toJSON = function toJSON () {
        return {
            type: 'Buffer',
            data: Array.prototype.slice.call(this._arr || this, 0)
        }
    }

    function base64Slice (buf, start, end) {
        if (start === 0 && end === buf.length) {
            return base64.fromByteArray(buf)
        } else {
            return base64.fromByteArray(buf.slice(start, end))
        }
    }

    function utf8Slice (buf, start, end) {
        end = Math.min(buf.length, end)
        var res = []

        var i = start
        while (i < end) {
            var firstByte = buf[i]
            var codePoint = null
            var bytesPerSequence = (firstByte > 0xEF) ? 4
                : (firstByte > 0xDF) ? 3
                    : (firstByte > 0xBF) ? 2
                        : 1

            if (i + bytesPerSequence <= end) {
                var secondByte, thirdByte, fourthByte, tempCodePoint

                switch (bytesPerSequence) {
                    case 1:
                        if (firstByte < 0x80) {
                            codePoint = firstByte
                        }
                        break
                    case 2:
                        secondByte = buf[i + 1]
                        if ((secondByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
                            if (tempCodePoint > 0x7F) {
                                codePoint = tempCodePoint
                            }
                        }
                        break
                    case 3:
                        secondByte = buf[i + 1]
                        thirdByte = buf[i + 2]
                        if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
                            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                                codePoint = tempCodePoint
                            }
                        }
                        break
                    case 4:
                        secondByte = buf[i + 1]
                        thirdByte = buf[i + 2]
                        fourthByte = buf[i + 3]
                        if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
                            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                                codePoint = tempCodePoint
                            }
                        }
                }
            }

            if (codePoint === null) {
                // we did not generate a valid codePoint so insert a
                // replacement char (U+FFFD) and advance only 1 byte
                codePoint = 0xFFFD
                bytesPerSequence = 1
            } else if (codePoint > 0xFFFF) {
                // encode to utf16 (surrogate pair dance)
                codePoint -= 0x10000
                res.push(codePoint >>> 10 & 0x3FF | 0xD800)
                codePoint = 0xDC00 | codePoint & 0x3FF
            }

            res.push(codePoint)
            i += bytesPerSequence
        }

        return decodeCodePointsArray(res)
    }

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
    var MAX_ARGUMENTS_LENGTH = 0x1000

    function decodeCodePointsArray (codePoints) {
        var len = codePoints.length
        if (len <= MAX_ARGUMENTS_LENGTH) {
            return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
        }

        // Decode in chunks to avoid "call stack size exceeded".
        var res = ''
        var i = 0
        while (i < len) {
            res += String.fromCharCode.apply(
                String,
                codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
            )
        }
        return res
    }

    function asciiSlice (buf, start, end) {
        var ret = ''
        end = Math.min(buf.length, end)

        for (var i = start; i < end; ++i) {
            ret += String.fromCharCode(buf[i] & 0x7F)
        }
        return ret
    }

    function latin1Slice (buf, start, end) {
        var ret = ''
        end = Math.min(buf.length, end)

        for (var i = start; i < end; ++i) {
            ret += String.fromCharCode(buf[i])
        }
        return ret
    }

    function hexSlice (buf, start, end) {
        var len = buf.length

        if (!start || start < 0) start = 0
        if (!end || end < 0 || end > len) end = len

        var out = ''
        for (var i = start; i < end; ++i) {
            out += toHex(buf[i])
        }
        return out
    }

    function utf16leSlice (buf, start, end) {
        var bytes = buf.slice(start, end)
        var res = ''
        for (var i = 0; i < bytes.length; i += 2) {
            res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
        }
        return res
    }

    Buffer.prototype.slice = function slice (start, end) {
        var len = this.length
        start = ~~start
        end = end === undefined ? len : ~~end

        if (start < 0) {
            start += len
            if (start < 0) start = 0
        } else if (start > len) {
            start = len
        }

        if (end < 0) {
            end += len
            if (end < 0) end = 0
        } else if (end > len) {
            end = len
        }

        if (end < start) end = start

        var newBuf = this.subarray(start, end)
        // Return an augmented `Uint8Array` instance
        newBuf.__proto__ = Buffer.prototype
        return newBuf
    }

    /*
     * Need to make sure that buffer isn't trying to write out of bounds.
     */
    function checkOffset (offset, ext, length) {
        if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
        if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
    }

    Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
        offset = offset >>> 0
        byteLength = byteLength >>> 0
        if (!noAssert) checkOffset(offset, byteLength, this.length)

        var val = this[offset]
        var mul = 1
        var i = 0
        while (++i < byteLength && (mul *= 0x100)) {
            val += this[offset + i] * mul
        }

        return val
    }

    Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
        offset = offset >>> 0
        byteLength = byteLength >>> 0
        if (!noAssert) {
            checkOffset(offset, byteLength, this.length)
        }

        var val = this[offset + --byteLength]
        var mul = 1
        while (byteLength > 0 && (mul *= 0x100)) {
            val += this[offset + --byteLength] * mul
        }

        return val
    }

    Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 1, this.length)
        return this[offset]
    }

    Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 2, this.length)
        return this[offset] | (this[offset + 1] << 8)
    }

    Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 2, this.length)
        return (this[offset] << 8) | this[offset + 1]
    }

    Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 4, this.length)

        return ((this[offset]) |
            (this[offset + 1] << 8) |
            (this[offset + 2] << 16)) +
            (this[offset + 3] * 0x1000000)
    }

    Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 4, this.length)

        return (this[offset] * 0x1000000) +
            ((this[offset + 1] << 16) |
            (this[offset + 2] << 8) |
            this[offset + 3])
    }

    Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
        offset = offset >>> 0
        byteLength = byteLength >>> 0
        if (!noAssert) checkOffset(offset, byteLength, this.length)

        var val = this[offset]
        var mul = 1
        var i = 0
        while (++i < byteLength && (mul *= 0x100)) {
            val += this[offset + i] * mul
        }
        mul *= 0x80

        if (val >= mul) val -= Math.pow(2, 8 * byteLength)

        return val
    }

    Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
        offset = offset >>> 0
        byteLength = byteLength >>> 0
        if (!noAssert) checkOffset(offset, byteLength, this.length)

        var i = byteLength
        var mul = 1
        var val = this[offset + --i]
        while (i > 0 && (mul *= 0x100)) {
            val += this[offset + --i] * mul
        }
        mul *= 0x80

        if (val >= mul) val -= Math.pow(2, 8 * byteLength)

        return val
    }

    Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 1, this.length)
        if (!(this[offset] & 0x80)) return (this[offset])
        return ((0xff - this[offset] + 1) * -1)
    }

    Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 2, this.length)
        var val = this[offset] | (this[offset + 1] << 8)
        return (val & 0x8000) ? val | 0xFFFF0000 : val
    }

    Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 2, this.length)
        var val = this[offset + 1] | (this[offset] << 8)
        return (val & 0x8000) ? val | 0xFFFF0000 : val
    }

    Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 4, this.length)

        return (this[offset]) |
            (this[offset + 1] << 8) |
            (this[offset + 2] << 16) |
            (this[offset + 3] << 24)
    }

    Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 4, this.length)

        return (this[offset] << 24) |
            (this[offset + 1] << 16) |
            (this[offset + 2] << 8) |
            (this[offset + 3])
    }

    Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 4, this.length)
        return ieee754.read(this, offset, true, 23, 4)
    }

    Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 4, this.length)
        return ieee754.read(this, offset, false, 23, 4)
    }

    Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 8, this.length)
        return ieee754.read(this, offset, true, 52, 8)
    }

    Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
        offset = offset >>> 0
        if (!noAssert) checkOffset(offset, 8, this.length)
        return ieee754.read(this, offset, false, 52, 8)
    }

    function checkInt (buf, value, offset, ext, max, min) {
        if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
        if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
        if (offset + ext > buf.length) throw new RangeError('Index out of range')
    }

    Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
        value = +value
        offset = offset >>> 0
        byteLength = byteLength >>> 0
        if (!noAssert) {
            var maxBytes = Math.pow(2, 8 * byteLength) - 1
            checkInt(this, value, offset, byteLength, maxBytes, 0)
        }

        var mul = 1
        var i = 0
        this[offset] = value & 0xFF
        while (++i < byteLength && (mul *= 0x100)) {
            this[offset + i] = (value / mul) & 0xFF
        }

        return offset + byteLength
    }

    Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
        value = +value
        offset = offset >>> 0
        byteLength = byteLength >>> 0
        if (!noAssert) {
            var maxBytes = Math.pow(2, 8 * byteLength) - 1
            checkInt(this, value, offset, byteLength, maxBytes, 0)
        }

        var i = byteLength - 1
        var mul = 1
        this[offset + i] = value & 0xFF
        while (--i >= 0 && (mul *= 0x100)) {
            this[offset + i] = (value / mul) & 0xFF
        }

        return offset + byteLength
    }

    Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
        this[offset] = (value & 0xff)
        return offset + 1
    }

    Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
        this[offset] = (value & 0xff)
        this[offset + 1] = (value >>> 8)
        return offset + 2
    }

    Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
        this[offset] = (value >>> 8)
        this[offset + 1] = (value & 0xff)
        return offset + 2
    }

    Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
        this[offset + 3] = (value >>> 24)
        this[offset + 2] = (value >>> 16)
        this[offset + 1] = (value >>> 8)
        this[offset] = (value & 0xff)
        return offset + 4
    }

    Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
        this[offset] = (value >>> 24)
        this[offset + 1] = (value >>> 16)
        this[offset + 2] = (value >>> 8)
        this[offset + 3] = (value & 0xff)
        return offset + 4
    }

    Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) {
            var limit = Math.pow(2, (8 * byteLength) - 1)

            checkInt(this, value, offset, byteLength, limit - 1, -limit)
        }

        var i = 0
        var mul = 1
        var sub = 0
        this[offset] = value & 0xFF
        while (++i < byteLength && (mul *= 0x100)) {
            if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                sub = 1
            }
            this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
        }

        return offset + byteLength
    }

    Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) {
            var limit = Math.pow(2, (8 * byteLength) - 1)

            checkInt(this, value, offset, byteLength, limit - 1, -limit)
        }

        var i = byteLength - 1
        var mul = 1
        var sub = 0
        this[offset + i] = value & 0xFF
        while (--i >= 0 && (mul *= 0x100)) {
            if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                sub = 1
            }
            this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
        }

        return offset + byteLength
    }

    Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
        if (value < 0) value = 0xff + value + 1
        this[offset] = (value & 0xff)
        return offset + 1
    }

    Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
        this[offset] = (value & 0xff)
        this[offset + 1] = (value >>> 8)
        return offset + 2
    }

    Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
        this[offset] = (value >>> 8)
        this[offset + 1] = (value & 0xff)
        return offset + 2
    }

    Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
        this[offset] = (value & 0xff)
        this[offset + 1] = (value >>> 8)
        this[offset + 2] = (value >>> 16)
        this[offset + 3] = (value >>> 24)
        return offset + 4
    }

    Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
        if (value < 0) value = 0xffffffff + value + 1
        this[offset] = (value >>> 24)
        this[offset + 1] = (value >>> 16)
        this[offset + 2] = (value >>> 8)
        this[offset + 3] = (value & 0xff)
        return offset + 4
    }

    function checkIEEE754 (buf, value, offset, ext, max, min) {
        if (offset + ext > buf.length) throw new RangeError('Index out of range')
        if (offset < 0) throw new RangeError('Index out of range')
    }

    function writeFloat (buf, value, offset, littleEndian, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) {
            checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
        }
        ieee754.write(buf, value, offset, littleEndian, 23, 4)
        return offset + 4
    }

    Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
        return writeFloat(this, value, offset, true, noAssert)
    }

    Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
        return writeFloat(this, value, offset, false, noAssert)
    }

    function writeDouble (buf, value, offset, littleEndian, noAssert) {
        value = +value
        offset = offset >>> 0
        if (!noAssert) {
            checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
        }
        ieee754.write(buf, value, offset, littleEndian, 52, 8)
        return offset + 8
    }

    Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
        return writeDouble(this, value, offset, true, noAssert)
    }

    Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
        return writeDouble(this, value, offset, false, noAssert)
    }

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
    Buffer.prototype.copy = function copy (target, targetStart, start, end) {
        if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
        if (!start) start = 0
        if (!end && end !== 0) end = this.length
        if (targetStart >= target.length) targetStart = target.length
        if (!targetStart) targetStart = 0
        if (end > 0 && end < start) end = start

        // Copy 0 bytes; we're done
        if (end === start) return 0
        if (target.length === 0 || this.length === 0) return 0

        // Fatal error conditions
        if (targetStart < 0) {
            throw new RangeError('targetStart out of bounds')
        }
        if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
        if (end < 0) throw new RangeError('sourceEnd out of bounds')

        // Are we oob?
        if (end > this.length) end = this.length
        if (target.length - targetStart < end - start) {
            end = target.length - targetStart + start
        }

        var len = end - start

        if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
            // Use built-in when available, missing from IE11
            this.copyWithin(targetStart, start, end)
        } else if (this === target && start < targetStart && targetStart < end) {
            // descending copy from end
            for (var i = len - 1; i >= 0; --i) {
                target[i + targetStart] = this[i + start]
            }
        } else {
            Uint8Array.prototype.set.call(
                target,
                this.subarray(start, end),
                targetStart
            )
        }

        return len
    }

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
    Buffer.prototype.fill = function fill (val, start, end, encoding) {
        // Handle string cases:
        if (typeof val === 'string') {
            if (typeof start === 'string') {
                encoding = start
                start = 0
                end = this.length
            } else if (typeof end === 'string') {
                encoding = end
                end = this.length
            }
            if (encoding !== undefined && typeof encoding !== 'string') {
                throw new TypeError('encoding must be a string')
            }
            if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
                throw new TypeError('Unknown encoding: ' + encoding)
            }
            if (val.length === 1) {
                var code = val.charCodeAt(0)
                if ((encoding === 'utf8' && code < 128) ||
                    encoding === 'latin1') {
                    // Fast path: If `val` fits into a single byte, use that numeric value.
                    val = code
                }
            }
        } else if (typeof val === 'number') {
            val = val & 255
        }

        // Invalid ranges are not set to a default, so can range check early.
        if (start < 0 || this.length < start || this.length < end) {
            throw new RangeError('Out of range index')
        }

        if (end <= start) {
            return this
        }

        start = start >>> 0
        end = end === undefined ? this.length : end >>> 0

        if (!val) val = 0

        var i
        if (typeof val === 'number') {
            for (i = start; i < end; ++i) {
                this[i] = val
            }
        } else {
            var bytes = Buffer.isBuffer(val)
                ? val
                : new Buffer(val, encoding)
            var len = bytes.length
            if (len === 0) {
                throw new TypeError('The value "' + val +
                    '" is invalid for argument "value"')
            }
            for (i = 0; i < end - start; ++i) {
                this[i + start] = bytes[i % len]
            }
        }

        return this
    }

// HELPER FUNCTIONS
// ================

    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

    function base64clean (str) {
        // Node takes equal signs as end of the Base64 encoding
        str = str.split('=')[0]
        // Node strips out invalid characters like \n and \t from the string, base64-js does not
        str = str.trim().replace(INVALID_BASE64_RE, '')
        // Node converts strings with length < 2 to ''
        if (str.length < 2) return ''
        // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
        while (str.length % 4 !== 0) {
            str = str + '='
        }
        return str
    }

    function toHex (n) {
        if (n < 16) return '0' + n.toString(16)
        return n.toString(16)
    }

    function utf8ToBytes (string, units) {
        units = units || Infinity
        var codePoint
        var length = string.length
        var leadSurrogate = null
        var bytes = []

        for (var i = 0; i < length; ++i) {
            codePoint = string.charCodeAt(i)

            // is surrogate component
            if (codePoint > 0xD7FF && codePoint < 0xE000) {
                // last char was a lead
                if (!leadSurrogate) {
                    // no lead yet
                    if (codePoint > 0xDBFF) {
                        // unexpected trail
                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                        continue
                    } else if (i + 1 === length) {
                        // unpaired lead
                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                        continue
                    }

                    // valid lead
                    leadSurrogate = codePoint

                    continue
                }

                // 2 leads in a row
                if (codePoint < 0xDC00) {
                    if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                    leadSurrogate = codePoint
                    continue
                }

                // valid surrogate pair
                codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
            } else if (leadSurrogate) {
                // valid bmp char, but last char was a lead
                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
            }

            leadSurrogate = null

            // encode utf8
            if (codePoint < 0x80) {
                if ((units -= 1) < 0) break
                bytes.push(codePoint)
            } else if (codePoint < 0x800) {
                if ((units -= 2) < 0) break
                bytes.push(
                    codePoint >> 0x6 | 0xC0,
                    codePoint & 0x3F | 0x80
                )
            } else if (codePoint < 0x10000) {
                if ((units -= 3) < 0) break
                bytes.push(
                    codePoint >> 0xC | 0xE0,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                )
            } else if (codePoint < 0x110000) {
                if ((units -= 4) < 0) break
                bytes.push(
                    codePoint >> 0x12 | 0xF0,
                    codePoint >> 0xC & 0x3F | 0x80,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                )
            } else {
                throw new Error('Invalid code point')
            }
        }

        return bytes
    }

    function asciiToBytes (str) {
        var byteArray = []
        for (var i = 0; i < str.length; ++i) {
            // Node's code seems to be doing this and not & 0x7F..
            byteArray.push(str.charCodeAt(i) & 0xFF)
        }
        return byteArray
    }

    function utf16leToBytes (str, units) {
        var c, hi, lo
        var byteArray = []
        for (var i = 0; i < str.length; ++i) {
            if ((units -= 2) < 0) break

            c = str.charCodeAt(i)
            hi = c >> 8
            lo = c % 256
            byteArray.push(lo)
            byteArray.push(hi)
        }

        return byteArray
    }

    function base64ToBytes (str) {
        return base64.toByteArray(base64clean(str))
    }

    function blitBuffer (src, dst, offset, length) {
        for (var i = 0; i < length; ++i) {
            if ((i + offset >= dst.length) || (i >= src.length)) break
            dst[i + offset] = src[i]
        }
        return i
    }

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
    function isArrayBuffer (obj) {
        return obj instanceof ArrayBuffer ||
            (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
            typeof obj.byteLength === 'number')
    }

    function numberIsNaN (obj) {
        return obj !== obj // eslint-disable-line no-self-compare
    }

},{"base64-js":18,"ieee754":112}],53:[function(require,module,exports){
    var Buffer = require('safe-buffer').Buffer
    var Transform = require('stream').Transform
    var StringDecoder = require('string_decoder').StringDecoder
    var inherits = require('inherits')

    function CipherBase (hashMode) {
        Transform.call(this)
        this.hashMode = typeof hashMode === 'string'
        if (this.hashMode) {
            this[hashMode] = this._finalOrDigest
        } else {
            this.final = this._finalOrDigest
        }
        if (this._final) {
            this.__final = this._final
            this._final = null
        }
        this._decoder = null
        this._encoding = null
    }
    inherits(CipherBase, Transform)

    CipherBase.prototype.update = function (data, inputEnc, outputEnc) {
        if (typeof data === 'string') {
            data = Buffer.from(data, inputEnc)
        }

        var outData = this._update(data)
        if (this.hashMode) return this

        if (outputEnc) {
            outData = this._toString(outData, outputEnc)
        }

        return outData
    }

    CipherBase.prototype.setAutoPadding = function () {}
    CipherBase.prototype.getAuthTag = function () {
        throw new Error('trying to get auth tag in unsupported state')
    }

    CipherBase.prototype.setAuthTag = function () {
        throw new Error('trying to set auth tag in unsupported state')
    }

    CipherBase.prototype.setAAD = function () {
        throw new Error('trying to set aad in unsupported state')
    }

    CipherBase.prototype._transform = function (data, _, next) {
        var err
        try {
            if (this.hashMode) {
                this._update(data)
            } else {
                this.push(this._update(data))
            }
        } catch (e) {
            err = e
        } finally {
            next(err)
        }
    }
    CipherBase.prototype._flush = function (done) {
        var err
        try {
            this.push(this.__final())
        } catch (e) {
            err = e
        }

        done(err)
    }
    CipherBase.prototype._finalOrDigest = function (outputEnc) {
        var outData = this.__final() || Buffer.alloc(0)
        if (outputEnc) {
            outData = this._toString(outData, outputEnc, true)
        }
        return outData
    }

    CipherBase.prototype._toString = function (value, enc, fin) {
        if (!this._decoder) {
            this._decoder = new StringDecoder(enc)
            this._encoding = enc
        }

        if (this._encoding !== enc) throw new Error('can\'t switch encodings')

        var out = this._decoder.write(value)
        if (fin) {
            out += this._decoder.end()
        }

        return out
    }

    module.exports = CipherBase

},{"inherits":113,"safe-buffer":173,"stream":184,"string_decoder":186}],54:[function(require,module,exports){
    (function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

        function isArray(arg) {
            if (Array.isArray) {
                return Array.isArray(arg);
            }
            return objectToString(arg) === '[object Array]';
        }
        exports.isArray = isArray;

        function isBoolean(arg) {
            return typeof arg === 'boolean';
        }
        exports.isBoolean = isBoolean;

        function isNull(arg) {
            return arg === null;
        }
        exports.isNull = isNull;

        function isNullOrUndefined(arg) {
            return arg == null;
        }
        exports.isNullOrUndefined = isNullOrUndefined;

        function isNumber(arg) {
            return typeof arg === 'number';
        }
        exports.isNumber = isNumber;

        function isString(arg) {
            return typeof arg === 'string';
        }
        exports.isString = isString;

        function isSymbol(arg) {
            return typeof arg === 'symbol';
        }
        exports.isSymbol = isSymbol;

        function isUndefined(arg) {
            return arg === void 0;
        }
        exports.isUndefined = isUndefined;

        function isRegExp(re) {
            return objectToString(re) === '[object RegExp]';
        }
        exports.isRegExp = isRegExp;

        function isObject(arg) {
            return typeof arg === 'object' && arg !== null;
        }
        exports.isObject = isObject;

        function isDate(d) {
            return objectToString(d) === '[object Date]';
        }
        exports.isDate = isDate;

        function isError(e) {
            return (objectToString(e) === '[object Error]' || e instanceof Error);
        }
        exports.isError = isError;

        function isFunction(arg) {
            return typeof arg === 'function';
        }
        exports.isFunction = isFunction;

        function isPrimitive(arg) {
            return arg === null ||
                typeof arg === 'boolean' ||
                typeof arg === 'number' ||
                typeof arg === 'string' ||
                typeof arg === 'symbol' ||  // ES6 symbol
                typeof arg === 'undefined';
        }
        exports.isPrimitive = isPrimitive;

        exports.isBuffer = Buffer.isBuffer;

        function objectToString(o) {
            return Object.prototype.toString.call(o);
        }

    }).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":114}],55:[function(require,module,exports){
    (function (Buffer){
        var elliptic = require('elliptic');
        var BN = require('bn.js');

        module.exports = function createECDH(curve) {
            return new ECDH(curve);
        };

        var aliases = {
            secp256k1: {
                name: 'secp256k1',
                byteLength: 32
            },
            secp224r1: {
                name: 'p224',
                byteLength: 28
            },
            prime256v1: {
                name: 'p256',
                byteLength: 32
            },
            prime192v1: {
                name: 'p192',
                byteLength: 24
            },
            ed25519: {
                name: 'ed25519',
                byteLength: 32
            },
            secp384r1: {
                name: 'p384',
                byteLength: 48
            },
            secp521r1: {
                name: 'p521',
                byteLength: 66
            }
        };

        aliases.p224 = aliases.secp224r1;
        aliases.p256 = aliases.secp256r1 = aliases.prime256v1;
        aliases.p192 = aliases.secp192r1 = aliases.prime192v1;
        aliases.p384 = aliases.secp384r1;
        aliases.p521 = aliases.secp521r1;

        function ECDH(curve) {
            this.curveType = aliases[curve];
            if (!this.curveType ) {
                this.curveType = {
                    name: curve
                };
            }
            this.curve = new elliptic.ec(this.curveType.name);
            this.keys = void 0;
        }

        ECDH.prototype.generateKeys = function (enc, format) {
            this.keys = this.curve.genKeyPair();
            return this.getPublicKey(enc, format);
        };

        ECDH.prototype.computeSecret = function (other, inenc, enc) {
            inenc = inenc || 'utf8';
            if (!Buffer.isBuffer(other)) {
                other = new Buffer(other, inenc);
            }
            var otherPub = this.curve.keyFromPublic(other).getPublic();
            var out = otherPub.mul(this.keys.getPrivate()).getX();
            return formatReturnValue(out, enc, this.curveType.byteLength);
        };

        ECDH.prototype.getPublicKey = function (enc, format) {
            var key = this.keys.getPublic(format === 'compressed', true);
            if (format === 'hybrid') {
                if (key[key.length - 1] % 2) {
                    key[0] = 7;
                } else {
                    key [0] = 6;
                }
            }
            return formatReturnValue(key, enc);
        };

        ECDH.prototype.getPrivateKey = function (enc) {
            return formatReturnValue(this.keys.getPrivate(), enc);
        };

        ECDH.prototype.setPublicKey = function (pub, enc) {
            enc = enc || 'utf8';
            if (!Buffer.isBuffer(pub)) {
                pub = new Buffer(pub, enc);
            }
            this.keys._importPublic(pub);
            return this;
        };

        ECDH.prototype.setPrivateKey = function (priv, enc) {
            enc = enc || 'utf8';
            if (!Buffer.isBuffer(priv)) {
                priv = new Buffer(priv, enc);
            }
            var _priv = new BN(priv);
            _priv = _priv.toString(16);
            this.keys._importPrivate(_priv);
            return this;
        };

        function formatReturnValue(bn, enc, len) {
            if (!Array.isArray(bn)) {
                bn = bn.toArray();
            }
            var buf = new Buffer(bn);
            if (len && buf.length < len) {
                var zeros = new Buffer(len - buf.length);
                zeros.fill(0);
                buf = Buffer.concat([zeros, buf]);
            }
            if (!enc) {
                return buf;
            } else {
                return buf.toString(enc);
            }
        }

    }).call(this,require("buffer").Buffer)
},{"bn.js":21,"buffer":52,"elliptic":72}],56:[function(require,module,exports){
    'use strict'
    var inherits = require('inherits')
    var MD5 = require('md5.js')
    var RIPEMD160 = require('ripemd160')
    var sha = require('sha.js')
    var Base = require('cipher-base')

    function Hash (hash) {
        Base.call(this, 'digest')

        this._hash = hash
    }

    inherits(Hash, Base)

    Hash.prototype._update = function (data) {
        this._hash.update(data)
    }

    Hash.prototype._final = function () {
        return this._hash.digest()
    }

    module.exports = function createHash (alg) {
        alg = alg.toLowerCase()
        if (alg === 'md5') return new MD5()
        if (alg === 'rmd160' || alg === 'ripemd160') return new RIPEMD160()

        return new Hash(sha(alg))
    }

},{"cipher-base":53,"inherits":113,"md5.js":119,"ripemd160":172,"sha.js":177}],57:[function(require,module,exports){
    var MD5 = require('md5.js')

    module.exports = function (buffer) {
        return new MD5().update(buffer).digest()
    }

},{"md5.js":119}],58:[function(require,module,exports){
    'use strict'
    var inherits = require('inherits')
    var Legacy = require('./legacy')
    var Base = require('cipher-base')
    var Buffer = require('safe-buffer').Buffer
    var md5 = require('create-hash/md5')
    var RIPEMD160 = require('ripemd160')

    var sha = require('sha.js')

    var ZEROS = Buffer.alloc(128)

    function Hmac (alg, key) {
        Base.call(this, 'digest')
        if (typeof key === 'string') {
            key = Buffer.from(key)
        }

        var blocksize = (alg === 'sha512' || alg === 'sha384') ? 128 : 64

        this._alg = alg
        this._key = key
        if (key.length > blocksize) {
            var hash = alg === 'rmd160' ? new RIPEMD160() : sha(alg)
            key = hash.update(key).digest()
        } else if (key.length < blocksize) {
            key = Buffer.concat([key, ZEROS], blocksize)
        }

        var ipad = this._ipad = Buffer.allocUnsafe(blocksize)
        var opad = this._opad = Buffer.allocUnsafe(blocksize)

        for (var i = 0; i < blocksize; i++) {
            ipad[i] = key[i] ^ 0x36
            opad[i] = key[i] ^ 0x5C
        }
        this._hash = alg === 'rmd160' ? new RIPEMD160() : sha(alg)
        this._hash.update(ipad)
    }

    inherits(Hmac, Base)

    Hmac.prototype._update = function (data) {
        this._hash.update(data)
    }

    Hmac.prototype._final = function () {
        var h = this._hash.digest()
        var hash = this._alg === 'rmd160' ? new RIPEMD160() : sha(this._alg)
        return hash.update(this._opad).update(h).digest()
    }

    module.exports = function createHmac (alg, key) {
        alg = alg.toLowerCase()
        if (alg === 'rmd160' || alg === 'ripemd160') {
            return new Hmac('rmd160', key)
        }
        if (alg === 'md5') {
            return new Legacy(md5, key)
        }
        return new Hmac(alg, key)
    }

},{"./legacy":59,"cipher-base":53,"create-hash/md5":57,"inherits":113,"ripemd160":172,"safe-buffer":173,"sha.js":177}],59:[function(require,module,exports){
    'use strict'
    var inherits = require('inherits')
    var Buffer = require('safe-buffer').Buffer

    var Base = require('cipher-base')

    var ZEROS = Buffer.alloc(128)
    var blocksize = 64

    function Hmac (alg, key) {
        Base.call(this, 'digest')
        if (typeof key === 'string') {
            key = Buffer.from(key)
        }

        this._alg = alg
        this._key = key

        if (key.length > blocksize) {
            key = alg(key)
        } else if (key.length < blocksize) {
            key = Buffer.concat([key, ZEROS], blocksize)
        }

        var ipad = this._ipad = Buffer.allocUnsafe(blocksize)
        var opad = this._opad = Buffer.allocUnsafe(blocksize)

        for (var i = 0; i < blocksize; i++) {
            ipad[i] = key[i] ^ 0x36
            opad[i] = key[i] ^ 0x5C
        }

        this._hash = [ipad]
    }

    inherits(Hmac, Base)

    Hmac.prototype._update = function (data) {
        this._hash.push(data)
    }

    Hmac.prototype._final = function () {
        var h = this._alg(Buffer.concat(this._hash))
        return this._alg(Buffer.concat([this._opad, h]))
    }
    module.exports = Hmac

},{"cipher-base":53,"inherits":113,"safe-buffer":173}],60:[function(require,module,exports){
    'use strict'

    exports.randomBytes = exports.rng = exports.pseudoRandomBytes = exports.prng = require('randombytes')
    exports.createHash = exports.Hash = require('create-hash')
    exports.createHmac = exports.Hmac = require('create-hmac')

    var algos = require('browserify-sign/algos')
    var algoKeys = Object.keys(algos)
    var hashes = ['sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'md5', 'rmd160'].concat(algoKeys)
    exports.getHashes = function () {
        return hashes
    }

    var p = require('pbkdf2')
    exports.pbkdf2 = p.pbkdf2
    exports.pbkdf2Sync = p.pbkdf2Sync

    var aes = require('browserify-cipher')

    exports.Cipher = aes.Cipher
    exports.createCipher = aes.createCipher
    exports.Cipheriv = aes.Cipheriv
    exports.createCipheriv = aes.createCipheriv
    exports.Decipher = aes.Decipher
    exports.createDecipher = aes.createDecipher
    exports.Decipheriv = aes.Decipheriv
    exports.createDecipheriv = aes.createDecipheriv
    exports.getCiphers = aes.getCiphers
    exports.listCiphers = aes.listCiphers

    var dh = require('diffie-hellman')

    exports.DiffieHellmanGroup = dh.DiffieHellmanGroup
    exports.createDiffieHellmanGroup = dh.createDiffieHellmanGroup
    exports.getDiffieHellman = dh.getDiffieHellman
    exports.createDiffieHellman = dh.createDiffieHellman
    exports.DiffieHellman = dh.DiffieHellman

    var sign = require('browserify-sign')

    exports.createSign = sign.createSign
    exports.Sign = sign.Sign
    exports.createVerify = sign.createVerify
    exports.Verify = sign.Verify

    exports.createECDH = require('create-ecdh')

    var publicEncrypt = require('public-encrypt')

    exports.publicEncrypt = publicEncrypt.publicEncrypt
    exports.privateEncrypt = publicEncrypt.privateEncrypt
    exports.publicDecrypt = publicEncrypt.publicDecrypt
    exports.privateDecrypt = publicEncrypt.privateDecrypt

// the least I can do is make error messages for the rest of the node.js/crypto api.
// ;[
//   'createCredentials'
// ].forEach(function (name) {
//   exports[name] = function () {
//     throw new Error([
//       'sorry, ' + name + ' is not implemented yet',
//       'we accept pull requests',
//       'https://github.com/crypto-browserify/crypto-browserify'
//     ].join('\n'))
//   }
// })

    var rf = require('randomfill')

    exports.randomFill = rf.randomFill
    exports.randomFillSync = rf.randomFillSync

    exports.createCredentials = function () {
        throw new Error([
            'sorry, createCredentials is not implemented yet',
            'we accept pull requests',
            'https://github.com/crypto-browserify/crypto-browserify'
        ].join('\n'))
    }

    exports.constants = {
        'DH_CHECK_P_NOT_SAFE_PRIME': 2,
        'DH_CHECK_P_NOT_PRIME': 1,
        'DH_UNABLE_TO_CHECK_GENERATOR': 4,
        'DH_NOT_SUITABLE_GENERATOR': 8,
        'NPN_ENABLED': 1,
        'ALPN_ENABLED': 1,
        'RSA_PKCS1_PADDING': 1,
        'RSA_SSLV23_PADDING': 2,
        'RSA_NO_PADDING': 3,
        'RSA_PKCS1_OAEP_PADDING': 4,
        'RSA_X931_PADDING': 5,
        'RSA_PKCS1_PSS_PADDING': 6,
        'POINT_CONVERSION_COMPRESSED': 2,
        'POINT_CONVERSION_UNCOMPRESSED': 4,
        'POINT_CONVERSION_HYBRID': 6
    }

},{"browserify-cipher":41,"browserify-sign":48,"browserify-sign/algos":45,"create-ecdh":55,"create-hash":56,"create-hmac":58,"diffie-hellman":68,"pbkdf2":133,"public-encrypt":140,"randombytes":151,"randomfill":152}],61:[function(require,module,exports){
    'use strict';
    var token = '%[a-f0-9]{2}';
    var singleMatcher = new RegExp(token, 'gi');
    var multiMatcher = new RegExp('(' + token + ')+', 'gi');

    function decodeComponents(components, split) {
        try {
            // Try to decode the entire string first
            return decodeURIComponent(components.join(''));
        } catch (err) {
            // Do nothing
        }

        if (components.length === 1) {
            return components;
        }

        split = split || 1;

        // Split the array in 2 parts
        var left = components.slice(0, split);
        var right = components.slice(split);

        return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
    }

    function decode(input) {
        try {
            return decodeURIComponent(input);
        } catch (err) {
            var tokens = input.match(singleMatcher);

            for (var i = 1; i < tokens.length; i++) {
                input = decodeComponents(tokens, i).join('');

                tokens = input.match(singleMatcher);
            }

            return input;
        }
    }

    function customDecodeURIComponent(input) {
        // Keep track of all the replacements and prefill the map with the `BOM`
        var replaceMap = {
            '%FE%FF': '\uFFFD\uFFFD',
            '%FF%FE': '\uFFFD\uFFFD'
        };

        var match = multiMatcher.exec(input);
        while (match) {
            try {
                // Decode as big chunks as possible
                replaceMap[match[0]] = decodeURIComponent(match[0]);
            } catch (err) {
                var result = decode(match[0]);

                if (result !== match[0]) {
                    replaceMap[match[0]] = result;
                }
            }

            match = multiMatcher.exec(input);
        }

        // Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
        replaceMap['%C2'] = '\uFFFD';

        var entries = Object.keys(replaceMap);

        for (var i = 0; i < entries.length; i++) {
            // Replace all decoded components
            var key = entries[i];
            input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
        }

        return input;
    }

    module.exports = function (encodedURI) {
        if (typeof encodedURI !== 'string') {
            throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
        }

        try {
            encodedURI = encodedURI.replace(/\+/g, ' ');

            // Try the built in decoder first
            return decodeURIComponent(encodedURI);
        } catch (err) {
            // Fallback to a more advanced decoder
            return customDecodeURIComponent(encodedURI);
        }
    };

},{}],62:[function(require,module,exports){
    'use strict';

    exports.utils = require('./des/utils');
    exports.Cipher = require('./des/cipher');
    exports.DES = require('./des/des');
    exports.CBC = require('./des/cbc');
    exports.EDE = require('./des/ede');

},{"./des/cbc":63,"./des/cipher":64,"./des/des":65,"./des/ede":66,"./des/utils":67}],63:[function(require,module,exports){
    'use strict';

    var assert = require('minimalistic-assert');
    var inherits = require('inherits');

    var proto = {};

    function CBCState(iv) {
        assert.equal(iv.length, 8, 'Invalid IV length');

        this.iv = new Array(8);
        for (var i = 0; i < this.iv.length; i++)
            this.iv[i] = iv[i];
    }

    function instantiate(Base) {
        function CBC(options) {
            Base.call(this, options);
            this._cbcInit();
        }
        inherits(CBC, Base);

        var keys = Object.keys(proto);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            CBC.prototype[key] = proto[key];
        }

        CBC.create = function create(options) {
            return new CBC(options);
        };

        return CBC;
    }

    exports.instantiate = instantiate;

    proto._cbcInit = function _cbcInit() {
        var state = new CBCState(this.options.iv);
        this._cbcState = state;
    };

    proto._update = function _update(inp, inOff, out, outOff) {
        var state = this._cbcState;
        var superProto = this.constructor.super_.prototype;

        var iv = state.iv;
        if (this.type === 'encrypt') {
            for (var i = 0; i < this.blockSize; i++)
                iv[i] ^= inp[inOff + i];

            superProto._update.call(this, iv, 0, out, outOff);

            for (var i = 0; i < this.blockSize; i++)
                iv[i] = out[outOff + i];
        } else {
            superProto._update.call(this, inp, inOff, out, outOff);

            for (var i = 0; i < this.blockSize; i++)
                out[outOff + i] ^= iv[i];

            for (var i = 0; i < this.blockSize; i++)
                iv[i] = inp[inOff + i];
        }
    };

},{"inherits":113,"minimalistic-assert":121}],64:[function(require,module,exports){
    'use strict';

    var assert = require('minimalistic-assert');

    function Cipher(options) {
        this.options = options;

        this.type = this.options.type;
        this.blockSize = 8;
        this._init();

        this.buffer = new Array(this.blockSize);
        this.bufferOff = 0;
    }
    module.exports = Cipher;

    Cipher.prototype._init = function _init() {
        // Might be overrided
    };

    Cipher.prototype.update = function update(data) {
        if (data.length === 0)
            return [];

        if (this.type === 'decrypt')
            return this._updateDecrypt(data);
        else
            return this._updateEncrypt(data);
    };

    Cipher.prototype._buffer = function _buffer(data, off) {
        // Append data to buffer
        var min = Math.min(this.buffer.length - this.bufferOff, data.length - off);
        for (var i = 0; i < min; i++)
            this.buffer[this.bufferOff + i] = data[off + i];
        this.bufferOff += min;

        // Shift next
        return min;
    };

    Cipher.prototype._flushBuffer = function _flushBuffer(out, off) {
        this._update(this.buffer, 0, out, off);
        this.bufferOff = 0;
        return this.blockSize;
    };

    Cipher.prototype._updateEncrypt = function _updateEncrypt(data) {
        var inputOff = 0;
        var outputOff = 0;

        var count = ((this.bufferOff + data.length) / this.blockSize) | 0;
        var out = new Array(count * this.blockSize);

        if (this.bufferOff !== 0) {
            inputOff += this._buffer(data, inputOff);

            if (this.bufferOff === this.buffer.length)
                outputOff += this._flushBuffer(out, outputOff);
        }

        // Write blocks
        var max = data.length - ((data.length - inputOff) % this.blockSize);
        for (; inputOff < max; inputOff += this.blockSize) {
            this._update(data, inputOff, out, outputOff);
            outputOff += this.blockSize;
        }

        // Queue rest
        for (; inputOff < data.length; inputOff++, this.bufferOff++)
            this.buffer[this.bufferOff] = data[inputOff];

        return out;
    };

    Cipher.prototype._updateDecrypt = function _updateDecrypt(data) {
        var inputOff = 0;
        var outputOff = 0;

        var count = Math.ceil((this.bufferOff + data.length) / this.blockSize) - 1;
        var out = new Array(count * this.blockSize);

        // TODO(indutny): optimize it, this is far from optimal
        for (; count > 0; count--) {
            inputOff += this._buffer(data, inputOff);
            outputOff += this._flushBuffer(out, outputOff);
        }

        // Buffer rest of the input
        inputOff += this._buffer(data, inputOff);

        return out;
    };

    Cipher.prototype.final = function final(buffer) {
        var first;
        if (buffer)
            first = this.update(buffer);

        var last;
        if (this.type === 'encrypt')
            last = this._finalEncrypt();
        else
            last = this._finalDecrypt();

        if (first)
            return first.concat(last);
        else
            return last;
    };

    Cipher.prototype._pad = function _pad(buffer, off) {
        if (off === 0)
            return false;

        while (off < buffer.length)
            buffer[off++] = 0;

        return true;
    };

    Cipher.prototype._finalEncrypt = function _finalEncrypt() {
        if (!this._pad(this.buffer, this.bufferOff))
            return [];

        var out = new Array(this.blockSize);
        this._update(this.buffer, 0, out, 0);
        return out;
    };

    Cipher.prototype._unpad = function _unpad(buffer) {
        return buffer;
    };

    Cipher.prototype._finalDecrypt = function _finalDecrypt() {
        assert.equal(this.bufferOff, this.blockSize, 'Not enough data to decrypt');
        var out = new Array(this.blockSize);
        this._flushBuffer(out, 0);

        return this._unpad(out);
    };

},{"minimalistic-assert":121}],65:[function(require,module,exports){
    'use strict';

    var assert = require('minimalistic-assert');
    var inherits = require('inherits');

    var des = require('../des');
    var utils = des.utils;
    var Cipher = des.Cipher;

    function DESState() {
        this.tmp = new Array(2);
        this.keys = null;
    }

    function DES(options) {
        Cipher.call(this, options);

        var state = new DESState();
        this._desState = state;

        this.deriveKeys(state, options.key);
    }
    inherits(DES, Cipher);
    module.exports = DES;

    DES.create = function create(options) {
        return new DES(options);
    };

    var shiftTable = [
        1, 1, 2, 2, 2, 2, 2, 2,
        1, 2, 2, 2, 2, 2, 2, 1
    ];

    DES.prototype.deriveKeys = function deriveKeys(state, key) {
        state.keys = new Array(16 * 2);

        assert.equal(key.length, this.blockSize, 'Invalid key length');

        var kL = utils.readUInt32BE(key, 0);
        var kR = utils.readUInt32BE(key, 4);

        utils.pc1(kL, kR, state.tmp, 0);
        kL = state.tmp[0];
        kR = state.tmp[1];
        for (var i = 0; i < state.keys.length; i += 2) {
            var shift = shiftTable[i >>> 1];
            kL = utils.r28shl(kL, shift);
            kR = utils.r28shl(kR, shift);
            utils.pc2(kL, kR, state.keys, i);
        }
    };

    DES.prototype._update = function _update(inp, inOff, out, outOff) {
        var state = this._desState;

        var l = utils.readUInt32BE(inp, inOff);
        var r = utils.readUInt32BE(inp, inOff + 4);

        // Initial Permutation
        utils.ip(l, r, state.tmp, 0);
        l = state.tmp[0];
        r = state.tmp[1];

        if (this.type === 'encrypt')
            this._encrypt(state, l, r, state.tmp, 0);
        else
            this._decrypt(state, l, r, state.tmp, 0);

        l = state.tmp[0];
        r = state.tmp[1];

        utils.writeUInt32BE(out, l, outOff);
        utils.writeUInt32BE(out, r, outOff + 4);
    };

    DES.prototype._pad = function _pad(buffer, off) {
        var value = buffer.length - off;
        for (var i = off; i < buffer.length; i++)
            buffer[i] = value;

        return true;
    };

    DES.prototype._unpad = function _unpad(buffer) {
        var pad = buffer[buffer.length - 1];
        for (var i = buffer.length - pad; i < buffer.length; i++)
            assert.equal(buffer[i], pad);

        return buffer.slice(0, buffer.length - pad);
    };

    DES.prototype._encrypt = function _encrypt(state, lStart, rStart, out, off) {
        var l = lStart;
        var r = rStart;

        // Apply f() x16 times
        for (var i = 0; i < state.keys.length; i += 2) {
            var keyL = state.keys[i];
            var keyR = state.keys[i + 1];

            // f(r, k)
            utils.expand(r, state.tmp, 0);

            keyL ^= state.tmp[0];
            keyR ^= state.tmp[1];
            var s = utils.substitute(keyL, keyR);
            var f = utils.permute(s);

            var t = r;
            r = (l ^ f) >>> 0;
            l = t;
        }

        // Reverse Initial Permutation
        utils.rip(r, l, out, off);
    };

    DES.prototype._decrypt = function _decrypt(state, lStart, rStart, out, off) {
        var l = rStart;
        var r = lStart;

        // Apply f() x16 times
        for (var i = state.keys.length - 2; i >= 0; i -= 2) {
            var keyL = state.keys[i];
            var keyR = state.keys[i + 1];

            // f(r, k)
            utils.expand(l, state.tmp, 0);

            keyL ^= state.tmp[0];
            keyR ^= state.tmp[1];
            var s = utils.substitute(keyL, keyR);
            var f = utils.permute(s);

            var t = l;
            l = (r ^ f) >>> 0;
            r = t;
        }

        // Reverse Initial Permutation
        utils.rip(l, r, out, off);
    };

},{"../des":62,"inherits":113,"minimalistic-assert":121}],66:[function(require,module,exports){
    'use strict';

    var assert = require('minimalistic-assert');
    var inherits = require('inherits');

    var des = require('../des');
    var Cipher = des.Cipher;
    var DES = des.DES;

    function EDEState(type, key) {
        assert.equal(key.length, 24, 'Invalid key length');

        var k1 = key.slice(0, 8);
        var k2 = key.slice(8, 16);
        var k3 = key.slice(16, 24);

        if (type === 'encrypt') {
            this.ciphers = [
                DES.create({ type: 'encrypt', key: k1 }),
                DES.create({ type: 'decrypt', key: k2 }),
                DES.create({ type: 'encrypt', key: k3 })
            ];
        } else {
            this.ciphers = [
                DES.create({ type: 'decrypt', key: k3 }),
                DES.create({ type: 'encrypt', key: k2 }),
                DES.create({ type: 'decrypt', key: k1 })
            ];
        }
    }

    function EDE(options) {
        Cipher.call(this, options);

        var state = new EDEState(this.type, this.options.key);
        this._edeState = state;
    }
    inherits(EDE, Cipher);

    module.exports = EDE;

    EDE.create = function create(options) {
        return new EDE(options);
    };

    EDE.prototype._update = function _update(inp, inOff, out, outOff) {
        var state = this._edeState;

        state.ciphers[0]._update(inp, inOff, out, outOff);
        state.ciphers[1]._update(out, outOff, out, outOff);
        state.ciphers[2]._update(out, outOff, out, outOff);
    };

    EDE.prototype._pad = DES.prototype._pad;
    EDE.prototype._unpad = DES.prototype._unpad;

},{"../des":62,"inherits":113,"minimalistic-assert":121}],67:[function(require,module,exports){
    'use strict';

    exports.readUInt32BE = function readUInt32BE(bytes, off) {
        var res =  (bytes[0 + off] << 24) |
            (bytes[1 + off] << 16) |
            (bytes[2 + off] << 8) |
            bytes[3 + off];
        return res >>> 0;
    };

    exports.writeUInt32BE = function writeUInt32BE(bytes, value, off) {
        bytes[0 + off] = value >>> 24;
        bytes[1 + off] = (value >>> 16) & 0xff;
        bytes[2 + off] = (value >>> 8) & 0xff;
        bytes[3 + off] = value & 0xff;
    };

    exports.ip = function ip(inL, inR, out, off) {
        var outL = 0;
        var outR = 0;

        for (var i = 6; i >= 0; i -= 2) {
            for (var j = 0; j <= 24; j += 8) {
                outL <<= 1;
                outL |= (inR >>> (j + i)) & 1;
            }
            for (var j = 0; j <= 24; j += 8) {
                outL <<= 1;
                outL |= (inL >>> (j + i)) & 1;
            }
        }

        for (var i = 6; i >= 0; i -= 2) {
            for (var j = 1; j <= 25; j += 8) {
                outR <<= 1;
                outR |= (inR >>> (j + i)) & 1;
            }
            for (var j = 1; j <= 25; j += 8) {
                outR <<= 1;
                outR |= (inL >>> (j + i)) & 1;
            }
        }

        out[off + 0] = outL >>> 0;
        out[off + 1] = outR >>> 0;
    };

    exports.rip = function rip(inL, inR, out, off) {
        var outL = 0;
        var outR = 0;

        for (var i = 0; i < 4; i++) {
            for (var j = 24; j >= 0; j -= 8) {
                outL <<= 1;
                outL |= (inR >>> (j + i)) & 1;
                outL <<= 1;
                outL |= (inL >>> (j + i)) & 1;
            }
        }
        for (var i = 4; i < 8; i++) {
            for (var j = 24; j >= 0; j -= 8) {
                outR <<= 1;
                outR |= (inR >>> (j + i)) & 1;
                outR <<= 1;
                outR |= (inL >>> (j + i)) & 1;
            }
        }

        out[off + 0] = outL >>> 0;
        out[off + 1] = outR >>> 0;
    };

    exports.pc1 = function pc1(inL, inR, out, off) {
        var outL = 0;
        var outR = 0;

        // 7, 15, 23, 31, 39, 47, 55, 63
        // 6, 14, 22, 30, 39, 47, 55, 63
        // 5, 13, 21, 29, 39, 47, 55, 63
        // 4, 12, 20, 28
        for (var i = 7; i >= 5; i--) {
            for (var j = 0; j <= 24; j += 8) {
                outL <<= 1;
                outL |= (inR >> (j + i)) & 1;
            }
            for (var j = 0; j <= 24; j += 8) {
                outL <<= 1;
                outL |= (inL >> (j + i)) & 1;
            }
        }
        for (var j = 0; j <= 24; j += 8) {
            outL <<= 1;
            outL |= (inR >> (j + i)) & 1;
        }

        // 1, 9, 17, 25, 33, 41, 49, 57
        // 2, 10, 18, 26, 34, 42, 50, 58
        // 3, 11, 19, 27, 35, 43, 51, 59
        // 36, 44, 52, 60
        for (var i = 1; i <= 3; i++) {
            for (var j = 0; j <= 24; j += 8) {
                outR <<= 1;
                outR |= (inR >> (j + i)) & 1;
            }
            for (var j = 0; j <= 24; j += 8) {
                outR <<= 1;
                outR |= (inL >> (j + i)) & 1;
            }
        }
        for (var j = 0; j <= 24; j += 8) {
            outR <<= 1;
            outR |= (inL >> (j + i)) & 1;
        }

        out[off + 0] = outL >>> 0;
        out[off + 1] = outR >>> 0;
    };

    exports.r28shl = function r28shl(num, shift) {
        return ((num << shift) & 0xfffffff) | (num >>> (28 - shift));
    };

    var pc2table = [
        // inL => outL
        14, 11, 17, 4, 27, 23, 25, 0,
        13, 22, 7, 18, 5, 9, 16, 24,
        2, 20, 12, 21, 1, 8, 15, 26,

        // inR => outR
        15, 4, 25, 19, 9, 1, 26, 16,
        5, 11, 23, 8, 12, 7, 17, 0,
        22, 3, 10, 14, 6, 20, 27, 24
    ];

    exports.pc2 = function pc2(inL, inR, out, off) {
        var outL = 0;
        var outR = 0;

        var len = pc2table.length >>> 1;
        for (var i = 0; i < len; i++) {
            outL <<= 1;
            outL |= (inL >>> pc2table[i]) & 0x1;
        }
        for (var i = len; i < pc2table.length; i++) {
            outR <<= 1;
            outR |= (inR >>> pc2table[i]) & 0x1;
        }

        out[off + 0] = outL >>> 0;
        out[off + 1] = outR >>> 0;
    };

    exports.expand = function expand(r, out, off) {
        var outL = 0;
        var outR = 0;

        outL = ((r & 1) << 5) | (r >>> 27);
        for (var i = 23; i >= 15; i -= 4) {
            outL <<= 6;
            outL |= (r >>> i) & 0x3f;
        }
        for (var i = 11; i >= 3; i -= 4) {
            outR |= (r >>> i) & 0x3f;
            outR <<= 6;
        }
        outR |= ((r & 0x1f) << 1) | (r >>> 31);

        out[off + 0] = outL >>> 0;
        out[off + 1] = outR >>> 0;
    };

    var sTable = [
        14, 0, 4, 15, 13, 7, 1, 4, 2, 14, 15, 2, 11, 13, 8, 1,
        3, 10, 10, 6, 6, 12, 12, 11, 5, 9, 9, 5, 0, 3, 7, 8,
        4, 15, 1, 12, 14, 8, 8, 2, 13, 4, 6, 9, 2, 1, 11, 7,
        15, 5, 12, 11, 9, 3, 7, 14, 3, 10, 10, 0, 5, 6, 0, 13,

        15, 3, 1, 13, 8, 4, 14, 7, 6, 15, 11, 2, 3, 8, 4, 14,
        9, 12, 7, 0, 2, 1, 13, 10, 12, 6, 0, 9, 5, 11, 10, 5,
        0, 13, 14, 8, 7, 10, 11, 1, 10, 3, 4, 15, 13, 4, 1, 2,
        5, 11, 8, 6, 12, 7, 6, 12, 9, 0, 3, 5, 2, 14, 15, 9,

        10, 13, 0, 7, 9, 0, 14, 9, 6, 3, 3, 4, 15, 6, 5, 10,
        1, 2, 13, 8, 12, 5, 7, 14, 11, 12, 4, 11, 2, 15, 8, 1,
        13, 1, 6, 10, 4, 13, 9, 0, 8, 6, 15, 9, 3, 8, 0, 7,
        11, 4, 1, 15, 2, 14, 12, 3, 5, 11, 10, 5, 14, 2, 7, 12,

        7, 13, 13, 8, 14, 11, 3, 5, 0, 6, 6, 15, 9, 0, 10, 3,
        1, 4, 2, 7, 8, 2, 5, 12, 11, 1, 12, 10, 4, 14, 15, 9,
        10, 3, 6, 15, 9, 0, 0, 6, 12, 10, 11, 1, 7, 13, 13, 8,
        15, 9, 1, 4, 3, 5, 14, 11, 5, 12, 2, 7, 8, 2, 4, 14,

        2, 14, 12, 11, 4, 2, 1, 12, 7, 4, 10, 7, 11, 13, 6, 1,
        8, 5, 5, 0, 3, 15, 15, 10, 13, 3, 0, 9, 14, 8, 9, 6,
        4, 11, 2, 8, 1, 12, 11, 7, 10, 1, 13, 14, 7, 2, 8, 13,
        15, 6, 9, 15, 12, 0, 5, 9, 6, 10, 3, 4, 0, 5, 14, 3,

        12, 10, 1, 15, 10, 4, 15, 2, 9, 7, 2, 12, 6, 9, 8, 5,
        0, 6, 13, 1, 3, 13, 4, 14, 14, 0, 7, 11, 5, 3, 11, 8,
        9, 4, 14, 3, 15, 2, 5, 12, 2, 9, 8, 5, 12, 15, 3, 10,
        7, 11, 0, 14, 4, 1, 10, 7, 1, 6, 13, 0, 11, 8, 6, 13,

        4, 13, 11, 0, 2, 11, 14, 7, 15, 4, 0, 9, 8, 1, 13, 10,
        3, 14, 12, 3, 9, 5, 7, 12, 5, 2, 10, 15, 6, 8, 1, 6,
        1, 6, 4, 11, 11, 13, 13, 8, 12, 1, 3, 4, 7, 10, 14, 7,
        10, 9, 15, 5, 6, 0, 8, 15, 0, 14, 5, 2, 9, 3, 2, 12,

        13, 1, 2, 15, 8, 13, 4, 8, 6, 10, 15, 3, 11, 7, 1, 4,
        10, 12, 9, 5, 3, 6, 14, 11, 5, 0, 0, 14, 12, 9, 7, 2,
        7, 2, 11, 1, 4, 14, 1, 7, 9, 4, 12, 10, 14, 8, 2, 13,
        0, 15, 6, 12, 10, 9, 13, 0, 15, 3, 3, 5, 5, 6, 8, 11
    ];

    exports.substitute = function substitute(inL, inR) {
        var out = 0;
        for (var i = 0; i < 4; i++) {
            var b = (inL >>> (18 - i * 6)) & 0x3f;
            var sb = sTable[i * 0x40 + b];

            out <<= 4;
            out |= sb;
        }
        for (var i = 0; i < 4; i++) {
            var b = (inR >>> (18 - i * 6)) & 0x3f;
            var sb = sTable[4 * 0x40 + i * 0x40 + b];

            out <<= 4;
            out |= sb;
        }
        return out >>> 0;
    };

    var permuteTable = [
        16, 25, 12, 11, 3, 20, 4, 15, 31, 17, 9, 6, 27, 14, 1, 22,
        30, 24, 8, 18, 0, 5, 29, 23, 13, 19, 2, 26, 10, 21, 28, 7
    ];

    exports.permute = function permute(num) {
        var out = 0;
        for (var i = 0; i < permuteTable.length; i++) {
            out <<= 1;
            out |= (num >>> permuteTable[i]) & 0x1;
        }
        return out >>> 0;
    };

    exports.padSplit = function padSplit(num, size, group) {
        var str = num.toString(2);
        while (str.length < size)
            str = '0' + str;

        var out = [];
        for (var i = 0; i < size; i += group)
            out.push(str.slice(i, i + group));
        return out.join(' ');
    };

},{}],68:[function(require,module,exports){
    (function (Buffer){
        var generatePrime = require('./lib/generatePrime')
        var primes = require('./lib/primes.json')

        var DH = require('./lib/dh')

        function getDiffieHellman (mod) {
            var prime = new Buffer(primes[mod].prime, 'hex')
            var gen = new Buffer(primes[mod].gen, 'hex')

            return new DH(prime, gen)
        }

        var ENCODINGS = {
            'binary': true, 'hex': true, 'base64': true
        }

        function createDiffieHellman (prime, enc, generator, genc) {
            if (Buffer.isBuffer(enc) || ENCODINGS[enc] === undefined) {
                return createDiffieHellman(prime, 'binary', enc, generator)
            }

            enc = enc || 'binary'
            genc = genc || 'binary'
            generator = generator || new Buffer([2])

            if (!Buffer.isBuffer(generator)) {
                generator = new Buffer(generator, genc)
            }

            if (typeof prime === 'number') {
                return new DH(generatePrime(prime, generator), generator, true)
            }

            if (!Buffer.isBuffer(prime)) {
                prime = new Buffer(prime, enc)
            }

            return new DH(prime, generator, true)
        }

        exports.DiffieHellmanGroup = exports.createDiffieHellmanGroup = exports.getDiffieHellman = getDiffieHellman
        exports.createDiffieHellman = exports.DiffieHellman = createDiffieHellman

    }).call(this,require("buffer").Buffer)
},{"./lib/dh":69,"./lib/generatePrime":70,"./lib/primes.json":71,"buffer":52}],69:[function(require,module,exports){
    (function (Buffer){
        var BN = require('bn.js');
        var MillerRabin = require('miller-rabin');
        var millerRabin = new MillerRabin();
        var TWENTYFOUR = new BN(24);
        var ELEVEN = new BN(11);
        var TEN = new BN(10);
        var THREE = new BN(3);
        var SEVEN = new BN(7);
        var primes = require('./generatePrime');
        var randomBytes = require('randombytes');
        module.exports = DH;

        function setPublicKey(pub, enc) {
            enc = enc || 'utf8';
            if (!Buffer.isBuffer(pub)) {
                pub = new Buffer(pub, enc);
            }
            this._pub = new BN(pub);
            return this;
        }

        function setPrivateKey(priv, enc) {
            enc = enc || 'utf8';
            if (!Buffer.isBuffer(priv)) {
                priv = new Buffer(priv, enc);
            }
            this._priv = new BN(priv);
            return this;
        }

        var primeCache = {};
        function checkPrime(prime, generator) {
            var gen = generator.toString('hex');
            var hex = [gen, prime.toString(16)].join('_');
            if (hex in primeCache) {
                return primeCache[hex];
            }
            var error = 0;

            if (prime.isEven() ||
                !primes.simpleSieve ||
                !primes.fermatTest(prime) ||
                !millerRabin.test(prime)) {
                //not a prime so +1
                error += 1;

                if (gen === '02' || gen === '05') {
                    // we'd be able to check the generator
                    // it would fail so +8
                    error += 8;
                } else {
                    //we wouldn't be able to test the generator
                    // so +4
                    error += 4;
                }
                primeCache[hex] = error;
                return error;
            }
            if (!millerRabin.test(prime.shrn(1))) {
                //not a safe prime
                error += 2;
            }
            var rem;
            switch (gen) {
                case '02':
                    if (prime.mod(TWENTYFOUR).cmp(ELEVEN)) {
                        // unsuidable generator
                        error += 8;
                    }
                    break;
                case '05':
                    rem = prime.mod(TEN);
                    if (rem.cmp(THREE) && rem.cmp(SEVEN)) {
                        // prime mod 10 needs to equal 3 or 7
                        error += 8;
                    }
                    break;
                default:
                    error += 4;
            }
            primeCache[hex] = error;
            return error;
        }

        function DH(prime, generator, malleable) {
            this.setGenerator(generator);
            this.__prime = new BN(prime);
            this._prime = BN.mont(this.__prime);
            this._primeLen = prime.length;
            this._pub = undefined;
            this._priv = undefined;
            this._primeCode = undefined;
            if (malleable) {
                this.setPublicKey = setPublicKey;
                this.setPrivateKey = setPrivateKey;
            } else {
                this._primeCode = 8;
            }
        }
        Object.defineProperty(DH.prototype, 'verifyError', {
            enumerable: true,
            get: function () {
                if (typeof this._primeCode !== 'number') {
                    this._primeCode = checkPrime(this.__prime, this.__gen);
                }
                return this._primeCode;
            }
        });
        DH.prototype.generateKeys = function () {
            if (!this._priv) {
                this._priv = new BN(randomBytes(this._primeLen));
            }
            this._pub = this._gen.toRed(this._prime).redPow(this._priv).fromRed();
            return this.getPublicKey();
        };

        DH.prototype.computeSecret = function (other) {
            other = new BN(other);
            other = other.toRed(this._prime);
            var secret = other.redPow(this._priv).fromRed();
            var out = new Buffer(secret.toArray());
            var prime = this.getPrime();
            if (out.length < prime.length) {
                var front = new Buffer(prime.length - out.length);
                front.fill(0);
                out = Buffer.concat([front, out]);
            }
            return out;
        };

        DH.prototype.getPublicKey = function getPublicKey(enc) {
            return formatReturnValue(this._pub, enc);
        };

        DH.prototype.getPrivateKey = function getPrivateKey(enc) {
            return formatReturnValue(this._priv, enc);
        };

        DH.prototype.getPrime = function (enc) {
            return formatReturnValue(this.__prime, enc);
        };

        DH.prototype.getGenerator = function (enc) {
            return formatReturnValue(this._gen, enc);
        };

        DH.prototype.setGenerator = function (gen, enc) {
            enc = enc || 'utf8';
            if (!Buffer.isBuffer(gen)) {
                gen = new Buffer(gen, enc);
            }
            this.__gen = gen;
            this._gen = new BN(gen);
            return this;
        };

        function formatReturnValue(bn, enc) {
            var buf = new Buffer(bn.toArray());
            if (!enc) {
                return buf;
            } else {
                return buf.toString(enc);
            }
        }

    }).call(this,require("buffer").Buffer)
},{"./generatePrime":70,"bn.js":21,"buffer":52,"miller-rabin":120,"randombytes":151}],70:[function(require,module,exports){
    var randomBytes = require('randombytes');
    module.exports = findPrime;
    findPrime.simpleSieve = simpleSieve;
    findPrime.fermatTest = fermatTest;
    var BN = require('bn.js');
    var TWENTYFOUR = new BN(24);
    var MillerRabin = require('miller-rabin');
    var millerRabin = new MillerRabin();
    var ONE = new BN(1);
    var TWO = new BN(2);
    var FIVE = new BN(5);
    var SIXTEEN = new BN(16);
    var EIGHT = new BN(8);
    var TEN = new BN(10);
    var THREE = new BN(3);
    var SEVEN = new BN(7);
    var ELEVEN = new BN(11);
    var FOUR = new BN(4);
    var TWELVE = new BN(12);
    var primes = null;

    function _getPrimes() {
        if (primes !== null)
            return primes;

        var limit = 0x100000;
        var res = [];
        res[0] = 2;
        for (var i = 1, k = 3; k < limit; k += 2) {
            var sqrt = Math.ceil(Math.sqrt(k));
            for (var j = 0; j < i && res[j] <= sqrt; j++)
                if (k % res[j] === 0)
                    break;

            if (i !== j && res[j] <= sqrt)
                continue;

            res[i++] = k;
        }
        primes = res;
        return res;
    }

    function simpleSieve(p) {
        var primes = _getPrimes();

        for (var i = 0; i < primes.length; i++)
            if (p.modn(primes[i]) === 0) {
                if (p.cmpn(primes[i]) === 0) {
                    return true;
                } else {
                    return false;
                }
            }

        return true;
    }

    function fermatTest(p) {
        var red = BN.mont(p);
        return TWO.toRed(red).redPow(p.subn(1)).fromRed().cmpn(1) === 0;
    }

    function findPrime(bits, gen) {
        if (bits < 16) {
            // this is what openssl does
            if (gen === 2 || gen === 5) {
                return new BN([0x8c, 0x7b]);
            } else {
                return new BN([0x8c, 0x27]);
            }
        }
        gen = new BN(gen);

        var num, n2;

        while (true) {
            num = new BN(randomBytes(Math.ceil(bits / 8)));
            while (num.bitLength() > bits) {
                num.ishrn(1);
            }
            if (num.isEven()) {
                num.iadd(ONE);
            }
            if (!num.testn(1)) {
                num.iadd(TWO);
            }
            if (!gen.cmp(TWO)) {
                while (num.mod(TWENTYFOUR).cmp(ELEVEN)) {
                    num.iadd(FOUR);
                }
            } else if (!gen.cmp(FIVE)) {
                while (num.mod(TEN).cmp(THREE)) {
                    num.iadd(FOUR);
                }
            }
            n2 = num.shrn(1);
            if (simpleSieve(n2) && simpleSieve(num) &&
                fermatTest(n2) && fermatTest(num) &&
                millerRabin.test(n2) && millerRabin.test(num)) {
                return num;
            }
        }

    }

},{"bn.js":21,"miller-rabin":120,"randombytes":151}],71:[function(require,module,exports){
    module.exports={
        "modp1": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a63a3620ffffffffffffffff"
        },
        "modp2": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece65381ffffffffffffffff"
        },
        "modp5": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca237327ffffffffffffffff"
        },
        "modp14": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aacaa68ffffffffffffffff"
        },
        "modp15": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aaac42dad33170d04507a33a85521abdf1cba64ecfb850458dbef0a8aea71575d060c7db3970f85a6e1e4c7abf5ae8cdb0933d71e8c94e04a25619dcee3d2261ad2ee6bf12ffa06d98a0864d87602733ec86a64521f2b18177b200cbbe117577a615d6c770988c0bad946e208e24fa074e5ab3143db5bfce0fd108e4b82d120a93ad2caffffffffffffffff"
        },
        "modp16": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aaac42dad33170d04507a33a85521abdf1cba64ecfb850458dbef0a8aea71575d060c7db3970f85a6e1e4c7abf5ae8cdb0933d71e8c94e04a25619dcee3d2261ad2ee6bf12ffa06d98a0864d87602733ec86a64521f2b18177b200cbbe117577a615d6c770988c0bad946e208e24fa074e5ab3143db5bfce0fd108e4b82d120a92108011a723c12a787e6d788719a10bdba5b2699c327186af4e23c1a946834b6150bda2583e9ca2ad44ce8dbbbc2db04de8ef92e8efc141fbecaa6287c59474e6bc05d99b2964fa090c3a2233ba186515be7ed1f612970cee2d7afb81bdd762170481cd0069127d5b05aa993b4ea988d8fddc186ffb7dc90a6c08f4df435c934063199ffffffffffffffff"
        },
        "modp17": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aaac42dad33170d04507a33a85521abdf1cba64ecfb850458dbef0a8aea71575d060c7db3970f85a6e1e4c7abf5ae8cdb0933d71e8c94e04a25619dcee3d2261ad2ee6bf12ffa06d98a0864d87602733ec86a64521f2b18177b200cbbe117577a615d6c770988c0bad946e208e24fa074e5ab3143db5bfce0fd108e4b82d120a92108011a723c12a787e6d788719a10bdba5b2699c327186af4e23c1a946834b6150bda2583e9ca2ad44ce8dbbbc2db04de8ef92e8efc141fbecaa6287c59474e6bc05d99b2964fa090c3a2233ba186515be7ed1f612970cee2d7afb81bdd762170481cd0069127d5b05aa993b4ea988d8fddc186ffb7dc90a6c08f4df435c93402849236c3fab4d27c7026c1d4dcb2602646dec9751e763dba37bdf8ff9406ad9e530ee5db382f413001aeb06a53ed9027d831179727b0865a8918da3edbebcf9b14ed44ce6cbaced4bb1bdb7f1447e6cc254b332051512bd7af426fb8f401378cd2bf5983ca01c64b92ecf032ea15d1721d03f482d7ce6e74fef6d55e702f46980c82b5a84031900b1c9e59e7c97fbec7e8f323a97a7e36cc88be0f1d45b7ff585ac54bd407b22b4154aacc8f6d7ebf48e1d814cc5ed20f8037e0a79715eef29be32806a1d58bb7c5da76f550aa3d8a1fbff0eb19ccb1a313d55cda56c9ec2ef29632387fe8d76e3c0468043e8f663f4860ee12bf2d5b0b7474d6e694f91e6dcc4024ffffffffffffffff"
        },
        "modp18": {
            "gen": "02",
            "prime": "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aaac42dad33170d04507a33a85521abdf1cba64ecfb850458dbef0a8aea71575d060c7db3970f85a6e1e4c7abf5ae8cdb0933d71e8c94e04a25619dcee3d2261ad2ee6bf12ffa06d98a0864d87602733ec86a64521f2b18177b200cbbe117577a615d6c770988c0bad946e208e24fa074e5ab3143db5bfce0fd108e4b82d120a92108011a723c12a787e6d788719a10bdba5b2699c327186af4e23c1a946834b6150bda2583e9ca2ad44ce8dbbbc2db04de8ef92e8efc141fbecaa6287c59474e6bc05d99b2964fa090c3a2233ba186515be7ed1f612970cee2d7afb81bdd762170481cd0069127d5b05aa993b4ea988d8fddc186ffb7dc90a6c08f4df435c93402849236c3fab4d27c7026c1d4dcb2602646dec9751e763dba37bdf8ff9406ad9e530ee5db382f413001aeb06a53ed9027d831179727b0865a8918da3edbebcf9b14ed44ce6cbaced4bb1bdb7f1447e6cc254b332051512bd7af426fb8f401378cd2bf5983ca01c64b92ecf032ea15d1721d03f482d7ce6e74fef6d55e702f46980c82b5a84031900b1c9e59e7c97fbec7e8f323a97a7e36cc88be0f1d45b7ff585ac54bd407b22b4154aacc8f6d7ebf48e1d814cc5ed20f8037e0a79715eef29be32806a1d58bb7c5da76f550aa3d8a1fbff0eb19ccb1a313d55cda56c9ec2ef29632387fe8d76e3c0468043e8f663f4860ee12bf2d5b0b7474d6e694f91e6dbe115974a3926f12fee5e438777cb6a932df8cd8bec4d073b931ba3bc832b68d9dd300741fa7bf8afc47ed2576f6936ba424663aab639c5ae4f5683423b4742bf1c978238f16cbe39d652de3fdb8befc848ad922222e04a4037c0713eb57a81a23f0c73473fc646cea306b4bcbc8862f8385ddfa9d4b7fa2c087e879683303ed5bdd3a062b3cf5b3a278a66d2a13f83f44f82ddf310ee074ab6a364597e899a0255dc164f31cc50846851df9ab48195ded7ea1b1d510bd7ee74d73faf36bc31ecfa268359046f4eb879f924009438b481c6cd7889a002ed5ee382bc9190da6fc026e479558e4475677e9aa9e3050e2765694dfc81f56e880b96e7160c980dd98edd3dfffffffffffffffff"
        }
    }
},{}],72:[function(require,module,exports){
    'use strict';

    var elliptic = exports;

    elliptic.version = require('../package.json').version;
    elliptic.utils = require('./elliptic/utils');
    elliptic.rand = require('brorand');
    elliptic.curve = require('./elliptic/curve');
    elliptic.curves = require('./elliptic/curves');

// Protocols
    elliptic.ec = require('./elliptic/ec');
    elliptic.eddsa = require('./elliptic/eddsa');

},{"../package.json":87,"./elliptic/curve":75,"./elliptic/curves":78,"./elliptic/ec":79,"./elliptic/eddsa":82,"./elliptic/utils":86,"brorand":22}],73:[function(require,module,exports){
    'use strict';

    var BN = require('bn.js');
    var elliptic = require('../../elliptic');
    var utils = elliptic.utils;
    var getNAF = utils.getNAF;
    var getJSF = utils.getJSF;
    var assert = utils.assert;

    function BaseCurve(type, conf) {
        this.type = type;
        this.p = new BN(conf.p, 16);

        // Use Montgomery, when there is no fast reduction for the prime
        this.red = conf.prime ? BN.red(conf.prime) : BN.mont(this.p);

        // Useful for many curves
        this.zero = new BN(0).toRed(this.red);
        this.one = new BN(1).toRed(this.red);
        this.two = new BN(2).toRed(this.red);

        // Curve configuration, optional
        this.n = conf.n && new BN(conf.n, 16);
        this.g = conf.g && this.pointFromJSON(conf.g, conf.gRed);

        // Temporary arrays
        this._wnafT1 = new Array(4);
        this._wnafT2 = new Array(4);
        this._wnafT3 = new Array(4);
        this._wnafT4 = new Array(4);

        // Generalized Greg Maxwell's trick
        var adjustCount = this.n && this.p.div(this.n);
        if (!adjustCount || adjustCount.cmpn(100) > 0) {
            this.redN = null;
        } else {
            this._maxwellTrick = true;
            this.redN = this.n.toRed(this.red);
        }
    }
    module.exports = BaseCurve;

    BaseCurve.prototype.point = function point() {
        throw new Error('Not implemented');
    };

    BaseCurve.prototype.validate = function validate() {
        throw new Error('Not implemented');
    };

    BaseCurve.prototype._fixedNafMul = function _fixedNafMul(p, k) {
        assert(p.precomputed);
        var doubles = p._getDoubles();

        var naf = getNAF(k, 1);
        var I = (1 << (doubles.step + 1)) - (doubles.step % 2 === 0 ? 2 : 1);
        I /= 3;

        // Translate into more windowed form
        var repr = [];
        for (var j = 0; j < naf.length; j += doubles.step) {
            var nafW = 0;
            for (var k = j + doubles.step - 1; k >= j; k--)
                nafW = (nafW << 1) + naf[k];
            repr.push(nafW);
        }

        var a = this.jpoint(null, null, null);
        var b = this.jpoint(null, null, null);
        for (var i = I; i > 0; i--) {
            for (var j = 0; j < repr.length; j++) {
                var nafW = repr[j];
                if (nafW === i)
                    b = b.mixedAdd(doubles.points[j]);
                else if (nafW === -i)
                    b = b.mixedAdd(doubles.points[j].neg());
            }
            a = a.add(b);
        }
        return a.toP();
    };

    BaseCurve.prototype._wnafMul = function _wnafMul(p, k) {
        var w = 4;

        // Precompute window
        var nafPoints = p._getNAFPoints(w);
        w = nafPoints.wnd;
        var wnd = nafPoints.points;

        // Get NAF form
        var naf = getNAF(k, w);

        // Add `this`*(N+1) for every w-NAF index
        var acc = this.jpoint(null, null, null);
        for (var i = naf.length - 1; i >= 0; i--) {
            // Count zeroes
            for (var k = 0; i >= 0 && naf[i] === 0; i--)
                k++;
            if (i >= 0)
                k++;
            acc = acc.dblp(k);

            if (i < 0)
                break;
            var z = naf[i];
            assert(z !== 0);
            if (p.type === 'affine') {
                // J +- P
                if (z > 0)
                    acc = acc.mixedAdd(wnd[(z - 1) >> 1]);
                else
                    acc = acc.mixedAdd(wnd[(-z - 1) >> 1].neg());
            } else {
                // J +- J
                if (z > 0)
                    acc = acc.add(wnd[(z - 1) >> 1]);
                else
                    acc = acc.add(wnd[(-z - 1) >> 1].neg());
            }
        }
        return p.type === 'affine' ? acc.toP() : acc;
    };

    BaseCurve.prototype._wnafMulAdd = function _wnafMulAdd(defW,
                                                           points,
                                                           coeffs,
                                                           len,
                                                           jacobianResult) {
        var wndWidth = this._wnafT1;
        var wnd = this._wnafT2;
        var naf = this._wnafT3;

        // Fill all arrays
        var max = 0;
        for (var i = 0; i < len; i++) {
            var p = points[i];
            var nafPoints = p._getNAFPoints(defW);
            wndWidth[i] = nafPoints.wnd;
            wnd[i] = nafPoints.points;
        }

        // Comb small window NAFs
        for (var i = len - 1; i >= 1; i -= 2) {
            var a = i - 1;
            var b = i;
            if (wndWidth[a] !== 1 || wndWidth[b] !== 1) {
                naf[a] = getNAF(coeffs[a], wndWidth[a]);
                naf[b] = getNAF(coeffs[b], wndWidth[b]);
                max = Math.max(naf[a].length, max);
                max = Math.max(naf[b].length, max);
                continue;
            }

            var comb = [
                points[a], /* 1 */
                null, /* 3 */
                null, /* 5 */
                points[b] /* 7 */
            ];

            // Try to avoid Projective points, if possible
            if (points[a].y.cmp(points[b].y) === 0) {
                comb[1] = points[a].add(points[b]);
                comb[2] = points[a].toJ().mixedAdd(points[b].neg());
            } else if (points[a].y.cmp(points[b].y.redNeg()) === 0) {
                comb[1] = points[a].toJ().mixedAdd(points[b]);
                comb[2] = points[a].add(points[b].neg());
            } else {
                comb[1] = points[a].toJ().mixedAdd(points[b]);
                comb[2] = points[a].toJ().mixedAdd(points[b].neg());
            }

            var index = [
                -3, /* -1 -1 */
                -1, /* -1 0 */
                -5, /* -1 1 */
                -7, /* 0 -1 */
                0, /* 0 0 */
                7, /* 0 1 */
                5, /* 1 -1 */
                1, /* 1 0 */
                3  /* 1 1 */
            ];

            var jsf = getJSF(coeffs[a], coeffs[b]);
            max = Math.max(jsf[0].length, max);
            naf[a] = new Array(max);
            naf[b] = new Array(max);
            for (var j = 0; j < max; j++) {
                var ja = jsf[0][j] | 0;
                var jb = jsf[1][j] | 0;

                naf[a][j] = index[(ja + 1) * 3 + (jb + 1)];
                naf[b][j] = 0;
                wnd[a] = comb;
            }
        }

        var acc = this.jpoint(null, null, null);
        var tmp = this._wnafT4;
        for (var i = max; i >= 0; i--) {
            var k = 0;

            while (i >= 0) {
                var zero = true;
                for (var j = 0; j < len; j++) {
                    tmp[j] = naf[j][i] | 0;
                    if (tmp[j] !== 0)
                        zero = false;
                }
                if (!zero)
                    break;
                k++;
                i--;
            }
            if (i >= 0)
                k++;
            acc = acc.dblp(k);
            if (i < 0)
                break;

            for (var j = 0; j < len; j++) {
                var z = tmp[j];
                var p;
                if (z === 0)
                    continue;
                else if (z > 0)
                    p = wnd[j][(z - 1) >> 1];
                else if (z < 0)
                    p = wnd[j][(-z - 1) >> 1].neg();

                if (p.type === 'affine')
                    acc = acc.mixedAdd(p);
                else
                    acc = acc.add(p);
            }
        }
        // Zeroify references
        for (var i = 0; i < len; i++)
            wnd[i] = null;

        if (jacobianResult)
            return acc;
        else
            return acc.toP();
    };

    function BasePoint(curve, type) {
        this.curve = curve;
        this.type = type;
        this.precomputed = null;
    }
    BaseCurve.BasePoint = BasePoint;

    BasePoint.prototype.eq = function eq(/*other*/) {
        throw new Error('Not implemented');
    };

    BasePoint.prototype.validate = function validate() {
        return this.curve.validate(this);
    };

    BaseCurve.prototype.decodePoint = function decodePoint(bytes, enc) {
        bytes = utils.toArray(bytes, enc);

        var len = this.p.byteLength();

        // uncompressed, hybrid-odd, hybrid-even
        if ((bytes[0] === 0x04 || bytes[0] === 0x06 || bytes[0] === 0x07) &&
            bytes.length - 1 === 2 * len) {
            if (bytes[0] === 0x06)
                assert(bytes[bytes.length - 1] % 2 === 0);
            else if (bytes[0] === 0x07)
                assert(bytes[bytes.length - 1] % 2 === 1);

            var res =  this.point(bytes.slice(1, 1 + len),
                bytes.slice(1 + len, 1 + 2 * len));

            return res;
        } else if ((bytes[0] === 0x02 || bytes[0] === 0x03) &&
            bytes.length - 1 === len) {
            return this.pointFromX(bytes.slice(1, 1 + len), bytes[0] === 0x03);
        }
        throw new Error('Unknown point format');
    };

    BasePoint.prototype.encodeCompressed = function encodeCompressed(enc) {
        return this.encode(enc, true);
    };

    BasePoint.prototype._encode = function _encode(compact) {
        var len = this.curve.p.byteLength();
        var x = this.getX().toArray('be', len);

        if (compact)
            return [ this.getY().isEven() ? 0x02 : 0x03 ].concat(x);

        return [ 0x04 ].concat(x, this.getY().toArray('be', len)) ;
    };

    BasePoint.prototype.encode = function encode(enc, compact) {
        return utils.encode(this._encode(compact), enc);
    };

    BasePoint.prototype.precompute = function precompute(power) {
        if (this.precomputed)
            return this;

        var precomputed = {
            doubles: null,
            naf: null,
            beta: null
        };
        precomputed.naf = this._getNAFPoints(8);
        precomputed.doubles = this._getDoubles(4, power);
        precomputed.beta = this._getBeta();
        this.precomputed = precomputed;

        return this;
    };

    BasePoint.prototype._hasDoubles = function _hasDoubles(k) {
        if (!this.precomputed)
            return false;

        var doubles = this.precomputed.doubles;
        if (!doubles)
            return false;

        return doubles.points.length >= Math.ceil((k.bitLength() + 1) / doubles.step);
    };

    BasePoint.prototype._getDoubles = function _getDoubles(step, power) {
        if (this.precomputed && this.precomputed.doubles)
            return this.precomputed.doubles;

        var doubles = [ this ];
        var acc = this;
        for (var i = 0; i < power; i += step) {
            for (var j = 0; j < step; j++)
                acc = acc.dbl();
            doubles.push(acc);
        }
        return {
            step: step,
            points: doubles
        };
    };

    BasePoint.prototype._getNAFPoints = function _getNAFPoints(wnd) {
        if (this.precomputed && this.precomputed.naf)
            return this.precomputed.naf;

        var res = [ this ];
        var max = (1 << wnd) - 1;
        var dbl = max === 1 ? null : this.dbl();
        for (var i = 1; i < max; i++)
            res[i] = res[i - 1].add(dbl);
        return {
            wnd: wnd,
            points: res
        };
    };

    BasePoint.prototype._getBeta = function _getBeta() {
        return null;
    };

    BasePoint.prototype.dblp = function dblp(k) {
        var r = this;
        for (var i = 0; i < k; i++)
            r = r.dbl();
        return r;
    };

},{"../../elliptic":72,"bn.js":21}],74:[function(require,module,exports){
    'use strict';

    var curve = require('../curve');
    var elliptic = require('../../elliptic');
    var BN = require('bn.js');
    var inherits = require('inherits');
    var Base = curve.base;

    var assert = elliptic.utils.assert;

    function EdwardsCurve(conf) {
        // NOTE: Important as we are creating point in Base.call()
        this.twisted = (conf.a | 0) !== 1;
        this.mOneA = this.twisted && (conf.a | 0) === -1;
        this.extended = this.mOneA;

        Base.call(this, 'edwards', conf);

        this.a = new BN(conf.a, 16).umod(this.red.m);
        this.a = this.a.toRed(this.red);
        this.c = new BN(conf.c, 16).toRed(this.red);
        this.c2 = this.c.redSqr();
        this.d = new BN(conf.d, 16).toRed(this.red);
        this.dd = this.d.redAdd(this.d);

        assert(!this.twisted || this.c.fromRed().cmpn(1) === 0);
        this.oneC = (conf.c | 0) === 1;
    }
    inherits(EdwardsCurve, Base);
    module.exports = EdwardsCurve;

    EdwardsCurve.prototype._mulA = function _mulA(num) {
        if (this.mOneA)
            return num.redNeg();
        else
            return this.a.redMul(num);
    };

    EdwardsCurve.prototype._mulC = function _mulC(num) {
        if (this.oneC)
            return num;
        else
            return this.c.redMul(num);
    };

// Just for compatibility with Short curve
    EdwardsCurve.prototype.jpoint = function jpoint(x, y, z, t) {
        return this.point(x, y, z, t);
    };

    EdwardsCurve.prototype.pointFromX = function pointFromX(x, odd) {
        x = new BN(x, 16);
        if (!x.red)
            x = x.toRed(this.red);

        var x2 = x.redSqr();
        var rhs = this.c2.redSub(this.a.redMul(x2));
        var lhs = this.one.redSub(this.c2.redMul(this.d).redMul(x2));

        var y2 = rhs.redMul(lhs.redInvm());
        var y = y2.redSqrt();
        if (y.redSqr().redSub(y2).cmp(this.zero) !== 0)
            throw new Error('invalid point');

        var isOdd = y.fromRed().isOdd();
        if (odd && !isOdd || !odd && isOdd)
            y = y.redNeg();

        return this.point(x, y);
    };

    EdwardsCurve.prototype.pointFromY = function pointFromY(y, odd) {
        y = new BN(y, 16);
        if (!y.red)
            y = y.toRed(this.red);

        // x^2 = (y^2 - 1) / (d y^2 + 1)
        var y2 = y.redSqr();
        var lhs = y2.redSub(this.one);
        var rhs = y2.redMul(this.d).redAdd(this.one);
        var x2 = lhs.redMul(rhs.redInvm());

        if (x2.cmp(this.zero) === 0) {
            if (odd)
                throw new Error('invalid point');
            else
                return this.point(this.zero, y);
        }

        var x = x2.redSqrt();
        if (x.redSqr().redSub(x2).cmp(this.zero) !== 0)
            throw new Error('invalid point');

        if (x.isOdd() !== odd)
            x = x.redNeg();

        return this.point(x, y);
    };

    EdwardsCurve.prototype.validate = function validate(point) {
        if (point.isInfinity())
            return true;

        // Curve: A * X^2 + Y^2 = C^2 * (1 + D * X^2 * Y^2)
        point.normalize();

        var x2 = point.x.redSqr();
        var y2 = point.y.redSqr();
        var lhs = x2.redMul(this.a).redAdd(y2);
        var rhs = this.c2.redMul(this.one.redAdd(this.d.redMul(x2).redMul(y2)));

        return lhs.cmp(rhs) === 0;
    };

    function Point(curve, x, y, z, t) {
        Base.BasePoint.call(this, curve, 'projective');
        if (x === null && y === null && z === null) {
            this.x = this.curve.zero;
            this.y = this.curve.one;
            this.z = this.curve.one;
            this.t = this.curve.zero;
            this.zOne = true;
        } else {
            this.x = new BN(x, 16);
            this.y = new BN(y, 16);
            this.z = z ? new BN(z, 16) : this.curve.one;
            this.t = t && new BN(t, 16);
            if (!this.x.red)
                this.x = this.x.toRed(this.curve.red);
            if (!this.y.red)
                this.y = this.y.toRed(this.curve.red);
            if (!this.z.red)
                this.z = this.z.toRed(this.curve.red);
            if (this.t && !this.t.red)
                this.t = this.t.toRed(this.curve.red);
            this.zOne = this.z === this.curve.one;

            // Use extended coordinates
            if (this.curve.extended && !this.t) {
                this.t = this.x.redMul(this.y);
                if (!this.zOne)
                    this.t = this.t.redMul(this.z.redInvm());
            }
        }
    }
    inherits(Point, Base.BasePoint);

    EdwardsCurve.prototype.pointFromJSON = function pointFromJSON(obj) {
        return Point.fromJSON(this, obj);
    };

    EdwardsCurve.prototype.point = function point(x, y, z, t) {
        return new Point(this, x, y, z, t);
    };

    Point.fromJSON = function fromJSON(curve, obj) {
        return new Point(curve, obj[0], obj[1], obj[2]);
    };

    Point.prototype.inspect = function inspect() {
        if (this.isInfinity())
            return '<EC Point Infinity>';
        return '<EC Point x: ' + this.x.fromRed().toString(16, 2) +
            ' y: ' + this.y.fromRed().toString(16, 2) +
            ' z: ' + this.z.fromRed().toString(16, 2) + '>';
    };

    Point.prototype.isInfinity = function isInfinity() {
        // XXX This code assumes that zero is always zero in red
        return this.x.cmpn(0) === 0 &&
            this.y.cmp(this.z) === 0;
    };

    Point.prototype._extDbl = function _extDbl() {
        // hyperelliptic.org/EFD/g1p/auto-twisted-extended-1.html
        //     #doubling-dbl-2008-hwcd
        // 4M + 4S

        // A = X1^2
        var a = this.x.redSqr();
        // B = Y1^2
        var b = this.y.redSqr();
        // C = 2 * Z1^2
        var c = this.z.redSqr();
        c = c.redIAdd(c);
        // D = a * A
        var d = this.curve._mulA(a);
        // E = (X1 + Y1)^2 - A - B
        var e = this.x.redAdd(this.y).redSqr().redISub(a).redISub(b);
        // G = D + B
        var g = d.redAdd(b);
        // F = G - C
        var f = g.redSub(c);
        // H = D - B
        var h = d.redSub(b);
        // X3 = E * F
        var nx = e.redMul(f);
        // Y3 = G * H
        var ny = g.redMul(h);
        // T3 = E * H
        var nt = e.redMul(h);
        // Z3 = F * G
        var nz = f.redMul(g);
        return this.curve.point(nx, ny, nz, nt);
    };

    Point.prototype._projDbl = function _projDbl() {
        // hyperelliptic.org/EFD/g1p/auto-twisted-projective.html
        //     #doubling-dbl-2008-bbjlp
        //     #doubling-dbl-2007-bl
        // and others
        // Generally 3M + 4S or 2M + 4S

        // B = (X1 + Y1)^2
        var b = this.x.redAdd(this.y).redSqr();
        // C = X1^2
        var c = this.x.redSqr();
        // D = Y1^2
        var d = this.y.redSqr();

        var nx;
        var ny;
        var nz;
        if (this.curve.twisted) {
            // E = a * C
            var e = this.curve._mulA(c);
            // F = E + D
            var f = e.redAdd(d);
            if (this.zOne) {
                // X3 = (B - C - D) * (F - 2)
                nx = b.redSub(c).redSub(d).redMul(f.redSub(this.curve.two));
                // Y3 = F * (E - D)
                ny = f.redMul(e.redSub(d));
                // Z3 = F^2 - 2 * F
                nz = f.redSqr().redSub(f).redSub(f);
            } else {
                // H = Z1^2
                var h = this.z.redSqr();
                // J = F - 2 * H
                var j = f.redSub(h).redISub(h);
                // X3 = (B-C-D)*J
                nx = b.redSub(c).redISub(d).redMul(j);
                // Y3 = F * (E - D)
                ny = f.redMul(e.redSub(d));
                // Z3 = F * J
                nz = f.redMul(j);
            }
        } else {
            // E = C + D
            var e = c.redAdd(d);
            // H = (c * Z1)^2
            var h = this.curve._mulC(this.c.redMul(this.z)).redSqr();
            // J = E - 2 * H
            var j = e.redSub(h).redSub(h);
            // X3 = c * (B - E) * J
            nx = this.curve._mulC(b.redISub(e)).redMul(j);
            // Y3 = c * E * (C - D)
            ny = this.curve._mulC(e).redMul(c.redISub(d));
            // Z3 = E * J
            nz = e.redMul(j);
        }
        return this.curve.point(nx, ny, nz);
    };

    Point.prototype.dbl = function dbl() {
        if (this.isInfinity())
            return this;

        // Double in extended coordinates
        if (this.curve.extended)
            return this._extDbl();
        else
            return this._projDbl();
    };

    Point.prototype._extAdd = function _extAdd(p) {
        // hyperelliptic.org/EFD/g1p/auto-twisted-extended-1.html
        //     #addition-add-2008-hwcd-3
        // 8M

        // A = (Y1 - X1) * (Y2 - X2)
        var a = this.y.redSub(this.x).redMul(p.y.redSub(p.x));
        // B = (Y1 + X1) * (Y2 + X2)
        var b = this.y.redAdd(this.x).redMul(p.y.redAdd(p.x));
        // C = T1 * k * T2
        var c = this.t.redMul(this.curve.dd).redMul(p.t);
        // D = Z1 * 2 * Z2
        var d = this.z.redMul(p.z.redAdd(p.z));
        // E = B - A
        var e = b.redSub(a);
        // F = D - C
        var f = d.redSub(c);
        // G = D + C
        var g = d.redAdd(c);
        // H = B + A
        var h = b.redAdd(a);
        // X3 = E * F
        var nx = e.redMul(f);
        // Y3 = G * H
        var ny = g.redMul(h);
        // T3 = E * H
        var nt = e.redMul(h);
        // Z3 = F * G
        var nz = f.redMul(g);
        return this.curve.point(nx, ny, nz, nt);
    };

    Point.prototype._projAdd = function _projAdd(p) {
        // hyperelliptic.org/EFD/g1p/auto-twisted-projective.html
        //     #addition-add-2008-bbjlp
        //     #addition-add-2007-bl
        // 10M + 1S

        // A = Z1 * Z2
        var a = this.z.redMul(p.z);
        // B = A^2
        var b = a.redSqr();
        // C = X1 * X2
        var c = this.x.redMul(p.x);
        // D = Y1 * Y2
        var d = this.y.redMul(p.y);
        // E = d * C * D
        var e = this.curve.d.redMul(c).redMul(d);
        // F = B - E
        var f = b.redSub(e);
        // G = B + E
        var g = b.redAdd(e);
        // X3 = A * F * ((X1 + Y1) * (X2 + Y2) - C - D)
        var tmp = this.x.redAdd(this.y).redMul(p.x.redAdd(p.y)).redISub(c).redISub(d);
        var nx = a.redMul(f).redMul(tmp);
        var ny;
        var nz;
        if (this.curve.twisted) {
            // Y3 = A * G * (D - a * C)
            ny = a.redMul(g).redMul(d.redSub(this.curve._mulA(c)));
            // Z3 = F * G
            nz = f.redMul(g);
        } else {
            // Y3 = A * G * (D - C)
            ny = a.redMul(g).redMul(d.redSub(c));
            // Z3 = c * F * G
            nz = this.curve._mulC(f).redMul(g);
        }
        return this.curve.point(nx, ny, nz);
    };

    Point.prototype.add = function add(p) {
        if (this.isInfinity())
            return p;
        if (p.isInfinity())
            return this;

        if (this.curve.extended)
            return this._extAdd(p);
        else
            return this._projAdd(p);
    };

    Point.prototype.mul = function mul(k) {
        if (this._hasDoubles(k))
            return this.curve._fixedNafMul(this, k);
        else
            return this.curve._wnafMul(this, k);
    };

    Point.prototype.mulAdd = function mulAdd(k1, p, k2) {
        return this.curve._wnafMulAdd(1, [ this, p ], [ k1, k2 ], 2, false);
    };

    Point.prototype.jmulAdd = function jmulAdd(k1, p, k2) {
        return this.curve._wnafMulAdd(1, [ this, p ], [ k1, k2 ], 2, true);
    };

    Point.prototype.normalize = function normalize() {
        if (this.zOne)
            return this;

        // Normalize coordinates
        var zi = this.z.redInvm();
        this.x = this.x.redMul(zi);
        this.y = this.y.redMul(zi);
        if (this.t)
            this.t = this.t.redMul(zi);
        this.z = this.curve.one;
        this.zOne = true;
        return this;
    };

    Point.prototype.neg = function neg() {
        return this.curve.point(this.x.redNeg(),
            this.y,
            this.z,
            this.t && this.t.redNeg());
    };

    Point.prototype.getX = function getX() {
        this.normalize();
        return this.x.fromRed();
    };

    Point.prototype.getY = function getY() {
        this.normalize();
        return this.y.fromRed();
    };

    Point.prototype.eq = function eq(other) {
        return this === other ||
            this.getX().cmp(other.getX()) === 0 &&
            this.getY().cmp(other.getY()) === 0;
    };

    Point.prototype.eqXToP = function eqXToP(x) {
        var rx = x.toRed(this.curve.red).redMul(this.z);
        if (this.x.cmp(rx) === 0)
            return true;

        var xc = x.clone();
        var t = this.curve.redN.redMul(this.z);
        for (;;) {
            xc.iadd(this.curve.n);
            if (xc.cmp(this.curve.p) >= 0)
                return false;

            rx.redIAdd(t);
            if (this.x.cmp(rx) === 0)
                return true;
        }
        return false;
    };

// Compatibility with BaseCurve
    Point.prototype.toP = Point.prototype.normalize;
    Point.prototype.mixedAdd = Point.prototype.add;

},{"../../elliptic":72,"../curve":75,"bn.js":21,"inherits":113}],75:[function(require,module,exports){
    'use strict';

    var curve = exports;

    curve.base = require('./base');
    curve.short = require('./short');
    curve.mont = require('./mont');
    curve.edwards = require('./edwards');

},{"./base":73,"./edwards":74,"./mont":76,"./short":77}],76:[function(require,module,exports){
    'use strict';

    var curve = require('../curve');
    var BN = require('bn.js');
    var inherits = require('inherits');
    var Base = curve.base;

    var elliptic = require('../../elliptic');
    var utils = elliptic.utils;

    function MontCurve(conf) {
        Base.call(this, 'mont', conf);

        this.a = new BN(conf.a, 16).toRed(this.red);
        this.b = new BN(conf.b, 16).toRed(this.red);
        this.i4 = new BN(4).toRed(this.red).redInvm();
        this.two = new BN(2).toRed(this.red);
        this.a24 = this.i4.redMul(this.a.redAdd(this.two));
    }
    inherits(MontCurve, Base);
    module.exports = MontCurve;

    MontCurve.prototype.validate = function validate(point) {
        var x = point.normalize().x;
        var x2 = x.redSqr();
        var rhs = x2.redMul(x).redAdd(x2.redMul(this.a)).redAdd(x);
        var y = rhs.redSqrt();

        return y.redSqr().cmp(rhs) === 0;
    };

    function Point(curve, x, z) {
        Base.BasePoint.call(this, curve, 'projective');
        if (x === null && z === null) {
            this.x = this.curve.one;
            this.z = this.curve.zero;
        } else {
            this.x = new BN(x, 16);
            this.z = new BN(z, 16);
            if (!this.x.red)
                this.x = this.x.toRed(this.curve.red);
            if (!this.z.red)
                this.z = this.z.toRed(this.curve.red);
        }
    }
    inherits(Point, Base.BasePoint);

    MontCurve.prototype.decodePoint = function decodePoint(bytes, enc) {
        return this.point(utils.toArray(bytes, enc), 1);
    };

    MontCurve.prototype.point = function point(x, z) {
        return new Point(this, x, z);
    };

    MontCurve.prototype.pointFromJSON = function pointFromJSON(obj) {
        return Point.fromJSON(this, obj);
    };

    Point.prototype.precompute = function precompute() {
        // No-op
    };

    Point.prototype._encode = function _encode() {
        return this.getX().toArray('be', this.curve.p.byteLength());
    };

    Point.fromJSON = function fromJSON(curve, obj) {
        return new Point(curve, obj[0], obj[1] || curve.one);
    };

    Point.prototype.inspect = function inspect() {
        if (this.isInfinity())
            return '<EC Point Infinity>';
        return '<EC Point x: ' + this.x.fromRed().toString(16, 2) +
            ' z: ' + this.z.fromRed().toString(16, 2) + '>';
    };

    Point.prototype.isInfinity = function isInfinity() {
        // XXX This code assumes that zero is always zero in red
        return this.z.cmpn(0) === 0;
    };

    Point.prototype.dbl = function dbl() {
        // http://hyperelliptic.org/EFD/g1p/auto-montgom-xz.html#doubling-dbl-1987-m-3
        // 2M + 2S + 4A

        // A = X1 + Z1
        var a = this.x.redAdd(this.z);
        // AA = A^2
        var aa = a.redSqr();
        // B = X1 - Z1
        var b = this.x.redSub(this.z);
        // BB = B^2
        var bb = b.redSqr();
        // C = AA - BB
        var c = aa.redSub(bb);
        // X3 = AA * BB
        var nx = aa.redMul(bb);
        // Z3 = C * (BB + A24 * C)
        var nz = c.redMul(bb.redAdd(this.curve.a24.redMul(c)));
        return this.curve.point(nx, nz);
    };

    Point.prototype.add = function add() {
        throw new Error('Not supported on Montgomery curve');
    };

    Point.prototype.diffAdd = function diffAdd(p, diff) {
        // http://hyperelliptic.org/EFD/g1p/auto-montgom-xz.html#diffadd-dadd-1987-m-3
        // 4M + 2S + 6A

        // A = X2 + Z2
        var a = this.x.redAdd(this.z);
        // B = X2 - Z2
        var b = this.x.redSub(this.z);
        // C = X3 + Z3
        var c = p.x.redAdd(p.z);
        // D = X3 - Z3
        var d = p.x.redSub(p.z);
        // DA = D * A
        var da = d.redMul(a);
        // CB = C * B
        var cb = c.redMul(b);
        // X5 = Z1 * (DA + CB)^2
        var nx = diff.z.redMul(da.redAdd(cb).redSqr());
        // Z5 = X1 * (DA - CB)^2
        var nz = diff.x.redMul(da.redISub(cb).redSqr());
        return this.curve.point(nx, nz);
    };

    Point.prototype.mul = function mul(k) {
        var t = k.clone();
        var a = this; // (N / 2) * Q + Q
        var b = this.curve.point(null, null); // (N / 2) * Q
        var c = this; // Q

        for (var bits = []; t.cmpn(0) !== 0; t.iushrn(1))
            bits.push(t.andln(1));

        for (var i = bits.length - 1; i >= 0; i--) {
            if (bits[i] === 0) {
                // N * Q + Q = ((N / 2) * Q + Q)) + (N / 2) * Q
                a = a.diffAdd(b, c);
                // N * Q = 2 * ((N / 2) * Q + Q))
                b = b.dbl();
            } else {
                // N * Q = ((N / 2) * Q + Q) + ((N / 2) * Q)
                b = a.diffAdd(b, c);
                // N * Q + Q = 2 * ((N / 2) * Q + Q)
                a = a.dbl();
            }
        }
        return b;
    };

    Point.prototype.mulAdd = function mulAdd() {
        throw new Error('Not supported on Montgomery curve');
    };

    Point.prototype.jumlAdd = function jumlAdd() {
        throw new Error('Not supported on Montgomery curve');
    };

    Point.prototype.eq = function eq(other) {
        return this.getX().cmp(other.getX()) === 0;
    };

    Point.prototype.normalize = function normalize() {
        this.x = this.x.redMul(this.z.redInvm());
        this.z = this.curve.one;
        return this;
    };

    Point.prototype.getX = function getX() {
        // Normalize coordinates
        this.normalize();

        return this.x.fromRed();
    };

},{"../../elliptic":72,"../curve":75,"bn.js":21,"inherits":113}],77:[function(require,module,exports){
    'use strict';

    var curve = require('../curve');
    var elliptic = require('../../elliptic');
    var BN = require('bn.js');
    var inherits = require('inherits');
    var Base = curve.base;

    var assert = elliptic.utils.assert;

    function ShortCurve(conf) {
        Base.call(this, 'short', conf);

        this.a = new BN(conf.a, 16).toRed(this.red);
        this.b = new BN(conf.b, 16).toRed(this.red);
        this.tinv = this.two.redInvm();

        this.zeroA = this.a.fromRed().cmpn(0) === 0;
        this.threeA = this.a.fromRed().sub(this.p).cmpn(-3) === 0;

        // If the curve is endomorphic, precalculate beta and lambda
        this.endo = this._getEndomorphism(conf);
        this._endoWnafT1 = new Array(4);
        this._endoWnafT2 = new Array(4);
    }
    inherits(ShortCurve, Base);
    module.exports = ShortCurve;

    ShortCurve.prototype._getEndomorphism = function _getEndomorphism(conf) {
        // No efficient endomorphism
        if (!this.zeroA || !this.g || !this.n || this.p.modn(3) !== 1)
            return;

        // Compute beta and lambda, that lambda * P = (beta * Px; Py)
        var beta;
        var lambda;
        if (conf.beta) {
            beta = new BN(conf.beta, 16).toRed(this.red);
        } else {
            var betas = this._getEndoRoots(this.p);
            // Choose the smallest beta
            beta = betas[0].cmp(betas[1]) < 0 ? betas[0] : betas[1];
            beta = beta.toRed(this.red);
        }
        if (conf.lambda) {
            lambda = new BN(conf.lambda, 16);
        } else {
            // Choose the lambda that is matching selected beta
            var lambdas = this._getEndoRoots(this.n);
            if (this.g.mul(lambdas[0]).x.cmp(this.g.x.redMul(beta)) === 0) {
                lambda = lambdas[0];
            } else {
                lambda = lambdas[1];
                assert(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta)) === 0);
            }
        }

        // Get basis vectors, used for balanced length-two representation
        var basis;
        if (conf.basis) {
            basis = conf.basis.map(function(vec) {
                return {
                    a: new BN(vec.a, 16),
                    b: new BN(vec.b, 16)
                };
            });
        } else {
            basis = this._getEndoBasis(lambda);
        }

        return {
            beta: beta,
            lambda: lambda,
            basis: basis
        };
    };

    ShortCurve.prototype._getEndoRoots = function _getEndoRoots(num) {
        // Find roots of for x^2 + x + 1 in F
        // Root = (-1 +- Sqrt(-3)) / 2
        //
        var red = num === this.p ? this.red : BN.mont(num);
        var tinv = new BN(2).toRed(red).redInvm();
        var ntinv = tinv.redNeg();

        var s = new BN(3).toRed(red).redNeg().redSqrt().redMul(tinv);

        var l1 = ntinv.redAdd(s).fromRed();
        var l2 = ntinv.redSub(s).fromRed();
        return [ l1, l2 ];
    };

    ShortCurve.prototype._getEndoBasis = function _getEndoBasis(lambda) {
        // aprxSqrt >= sqrt(this.n)
        var aprxSqrt = this.n.ushrn(Math.floor(this.n.bitLength() / 2));

        // 3.74
        // Run EGCD, until r(L + 1) < aprxSqrt
        var u = lambda;
        var v = this.n.clone();
        var x1 = new BN(1);
        var y1 = new BN(0);
        var x2 = new BN(0);
        var y2 = new BN(1);

        // NOTE: all vectors are roots of: a + b * lambda = 0 (mod n)
        var a0;
        var b0;
        // First vector
        var a1;
        var b1;
        // Second vector
        var a2;
        var b2;

        var prevR;
        var i = 0;
        var r;
        var x;
        while (u.cmpn(0) !== 0) {
            var q = v.div(u);
            r = v.sub(q.mul(u));
            x = x2.sub(q.mul(x1));
            var y = y2.sub(q.mul(y1));

            if (!a1 && r.cmp(aprxSqrt) < 0) {
                a0 = prevR.neg();
                b0 = x1;
                a1 = r.neg();
                b1 = x;
            } else if (a1 && ++i === 2) {
                break;
            }
            prevR = r;

            v = u;
            u = r;
            x2 = x1;
            x1 = x;
            y2 = y1;
            y1 = y;
        }
        a2 = r.neg();
        b2 = x;

        var len1 = a1.sqr().add(b1.sqr());
        var len2 = a2.sqr().add(b2.sqr());
        if (len2.cmp(len1) >= 0) {
            a2 = a0;
            b2 = b0;
        }

        // Normalize signs
        if (a1.negative) {
            a1 = a1.neg();
            b1 = b1.neg();
        }
        if (a2.negative) {
            a2 = a2.neg();
            b2 = b2.neg();
        }

        return [
            { a: a1, b: b1 },
            { a: a2, b: b2 }
        ];
    };

    ShortCurve.prototype._endoSplit = function _endoSplit(k) {
        var basis = this.endo.basis;
        var v1 = basis[0];
        var v2 = basis[1];

        var c1 = v2.b.mul(k).divRound(this.n);
        var c2 = v1.b.neg().mul(k).divRound(this.n);

        var p1 = c1.mul(v1.a);
        var p2 = c2.mul(v2.a);
        var q1 = c1.mul(v1.b);
        var q2 = c2.mul(v2.b);

        // Calculate answer
        var k1 = k.sub(p1).sub(p2);
        var k2 = q1.add(q2).neg();
        return { k1: k1, k2: k2 };
    };

    ShortCurve.prototype.pointFromX = function pointFromX(x, odd) {
        x = new BN(x, 16);
        if (!x.red)
            x = x.toRed(this.red);

        var y2 = x.redSqr().redMul(x).redIAdd(x.redMul(this.a)).redIAdd(this.b);
        var y = y2.redSqrt();
        if (y.redSqr().redSub(y2).cmp(this.zero) !== 0)
            throw new Error('invalid point');

        // XXX Is there any way to tell if the number is odd without converting it
        // to non-red form?
        var isOdd = y.fromRed().isOdd();
        if (odd && !isOdd || !odd && isOdd)
            y = y.redNeg();

        return this.point(x, y);
    };

    ShortCurve.prototype.validate = function validate(point) {
        if (point.inf)
            return true;

        var x = point.x;
        var y = point.y;

        var ax = this.a.redMul(x);
        var rhs = x.redSqr().redMul(x).redIAdd(ax).redIAdd(this.b);
        return y.redSqr().redISub(rhs).cmpn(0) === 0;
    };

    ShortCurve.prototype._endoWnafMulAdd =
        function _endoWnafMulAdd(points, coeffs, jacobianResult) {
            var npoints = this._endoWnafT1;
            var ncoeffs = this._endoWnafT2;
            for (var i = 0; i < points.length; i++) {
                var split = this._endoSplit(coeffs[i]);
                var p = points[i];
                var beta = p._getBeta();

                if (split.k1.negative) {
                    split.k1.ineg();
                    p = p.neg(true);
                }
                if (split.k2.negative) {
                    split.k2.ineg();
                    beta = beta.neg(true);
                }

                npoints[i * 2] = p;
                npoints[i * 2 + 1] = beta;
                ncoeffs[i * 2] = split.k1;
                ncoeffs[i * 2 + 1] = split.k2;
            }
            var res = this._wnafMulAdd(1, npoints, ncoeffs, i * 2, jacobianResult);

            // Clean-up references to points and coefficients
            for (var j = 0; j < i * 2; j++) {
                npoints[j] = null;
                ncoeffs[j] = null;
            }
            return res;
        };

    function Point(curve, x, y, isRed) {
        Base.BasePoint.call(this, curve, 'affine');
        if (x === null && y === null) {
            this.x = null;
            this.y = null;
            this.inf = true;
        } else {
            this.x = new BN(x, 16);
            this.y = new BN(y, 16);
            // Force redgomery representation when loading from JSON
            if (isRed) {
                this.x.forceRed(this.curve.red);
                this.y.forceRed(this.curve.red);
            }
            if (!this.x.red)
                this.x = this.x.toRed(this.curve.red);
            if (!this.y.red)
                this.y = this.y.toRed(this.curve.red);
            this.inf = false;
        }
    }
    inherits(Point, Base.BasePoint);

    ShortCurve.prototype.point = function point(x, y, isRed) {
        return new Point(this, x, y, isRed);
    };

    ShortCurve.prototype.pointFromJSON = function pointFromJSON(obj, red) {
        return Point.fromJSON(this, obj, red);
    };

    Point.prototype._getBeta = function _getBeta() {
        if (!this.curve.endo)
            return;

        var pre = this.precomputed;
        if (pre && pre.beta)
            return pre.beta;

        var beta = this.curve.point(this.x.redMul(this.curve.endo.beta), this.y);
        if (pre) {
            var curve = this.curve;
            var endoMul = function(p) {
                return curve.point(p.x.redMul(curve.endo.beta), p.y);
            };
            pre.beta = beta;
            beta.precomputed = {
                beta: null,
                naf: pre.naf && {
                    wnd: pre.naf.wnd,
                    points: pre.naf.points.map(endoMul)
                },
                doubles: pre.doubles && {
                    step: pre.doubles.step,
                    points: pre.doubles.points.map(endoMul)
                }
            };
        }
        return beta;
    };

    Point.prototype.toJSON = function toJSON() {
        if (!this.precomputed)
            return [ this.x, this.y ];

        return [ this.x, this.y, this.precomputed && {
            doubles: this.precomputed.doubles && {
                step: this.precomputed.doubles.step,
                points: this.precomputed.doubles.points.slice(1)
            },
            naf: this.precomputed.naf && {
                wnd: this.precomputed.naf.wnd,
                points: this.precomputed.naf.points.slice(1)
            }
        } ];
    };

    Point.fromJSON = function fromJSON(curve, obj, red) {
        if (typeof obj === 'string')
            obj = JSON.parse(obj);
        var res = curve.point(obj[0], obj[1], red);
        if (!obj[2])
            return res;

        function obj2point(obj) {
            return curve.point(obj[0], obj[1], red);
        }

        var pre = obj[2];
        res.precomputed = {
            beta: null,
            doubles: pre.doubles && {
                step: pre.doubles.step,
                points: [ res ].concat(pre.doubles.points.map(obj2point))
            },
            naf: pre.naf && {
                wnd: pre.naf.wnd,
                points: [ res ].concat(pre.naf.points.map(obj2point))
            }
        };
        return res;
    };

    Point.prototype.inspect = function inspect() {
        if (this.isInfinity())
            return '<EC Point Infinity>';
        return '<EC Point x: ' + this.x.fromRed().toString(16, 2) +
            ' y: ' + this.y.fromRed().toString(16, 2) + '>';
    };

    Point.prototype.isInfinity = function isInfinity() {
        return this.inf;
    };

    Point.prototype.add = function add(p) {
        // O + P = P
        if (this.inf)
            return p;

        // P + O = P
        if (p.inf)
            return this;

        // P + P = 2P
        if (this.eq(p))
            return this.dbl();

        // P + (-P) = O
        if (this.neg().eq(p))
            return this.curve.point(null, null);

        // P + Q = O
        if (this.x.cmp(p.x) === 0)
            return this.curve.point(null, null);

        var c = this.y.redSub(p.y);
        if (c.cmpn(0) !== 0)
            c = c.redMul(this.x.redSub(p.x).redInvm());
        var nx = c.redSqr().redISub(this.x).redISub(p.x);
        var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
        return this.curve.point(nx, ny);
    };

    Point.prototype.dbl = function dbl() {
        if (this.inf)
            return this;

        // 2P = O
        var ys1 = this.y.redAdd(this.y);
        if (ys1.cmpn(0) === 0)
            return this.curve.point(null, null);

        var a = this.curve.a;

        var x2 = this.x.redSqr();
        var dyinv = ys1.redInvm();
        var c = x2.redAdd(x2).redIAdd(x2).redIAdd(a).redMul(dyinv);

        var nx = c.redSqr().redISub(this.x.redAdd(this.x));
        var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
        return this.curve.point(nx, ny);
    };

    Point.prototype.getX = function getX() {
        return this.x.fromRed();
    };

    Point.prototype.getY = function getY() {
        return this.y.fromRed();
    };

    Point.prototype.mul = function mul(k) {
        k = new BN(k, 16);

        if (this._hasDoubles(k))
            return this.curve._fixedNafMul(this, k);
        else if (this.curve.endo)
            return this.curve._endoWnafMulAdd([ this ], [ k ]);
        else
            return this.curve._wnafMul(this, k);
    };

    Point.prototype.mulAdd = function mulAdd(k1, p2, k2) {
        var points = [ this, p2 ];
        var coeffs = [ k1, k2 ];
        if (this.curve.endo)
            return this.curve._endoWnafMulAdd(points, coeffs);
        else
            return this.curve._wnafMulAdd(1, points, coeffs, 2);
    };

    Point.prototype.jmulAdd = function jmulAdd(k1, p2, k2) {
        var points = [ this, p2 ];
        var coeffs = [ k1, k2 ];
        if (this.curve.endo)
            return this.curve._endoWnafMulAdd(points, coeffs, true);
        else
            return this.curve._wnafMulAdd(1, points, coeffs, 2, true);
    };

    Point.prototype.eq = function eq(p) {
        return this === p ||
            this.inf === p.inf &&
            (this.inf || this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0);
    };

    Point.prototype.neg = function neg(_precompute) {
        if (this.inf)
            return this;

        var res = this.curve.point(this.x, this.y.redNeg());
        if (_precompute && this.precomputed) {
            var pre = this.precomputed;
            var negate = function(p) {
                return p.neg();
            };
            res.precomputed = {
                naf: pre.naf && {
                    wnd: pre.naf.wnd,
                    points: pre.naf.points.map(negate)
                },
                doubles: pre.doubles && {
                    step: pre.doubles.step,
                    points: pre.doubles.points.map(negate)
                }
            };
        }
        return res;
    };

    Point.prototype.toJ = function toJ() {
        if (this.inf)
            return this.curve.jpoint(null, null, null);

        var res = this.curve.jpoint(this.x, this.y, this.curve.one);
        return res;
    };

    function JPoint(curve, x, y, z) {
        Base.BasePoint.call(this, curve, 'jacobian');
        if (x === null && y === null && z === null) {
            this.x = this.curve.one;
            this.y = this.curve.one;
            this.z = new BN(0);
        } else {
            this.x = new BN(x, 16);
            this.y = new BN(y, 16);
            this.z = new BN(z, 16);
        }
        if (!this.x.red)
            this.x = this.x.toRed(this.curve.red);
        if (!this.y.red)
            this.y = this.y.toRed(this.curve.red);
        if (!this.z.red)
            this.z = this.z.toRed(this.curve.red);

        this.zOne = this.z === this.curve.one;
    }
    inherits(JPoint, Base.BasePoint);

    ShortCurve.prototype.jpoint = function jpoint(x, y, z) {
        return new JPoint(this, x, y, z);
    };

    JPoint.prototype.toP = function toP() {
        if (this.isInfinity())
            return this.curve.point(null, null);

        var zinv = this.z.redInvm();
        var zinv2 = zinv.redSqr();
        var ax = this.x.redMul(zinv2);
        var ay = this.y.redMul(zinv2).redMul(zinv);

        return this.curve.point(ax, ay);
    };

    JPoint.prototype.neg = function neg() {
        return this.curve.jpoint(this.x, this.y.redNeg(), this.z);
    };

    JPoint.prototype.add = function add(p) {
        // O + P = P
        if (this.isInfinity())
            return p;

        // P + O = P
        if (p.isInfinity())
            return this;

        // 12M + 4S + 7A
        var pz2 = p.z.redSqr();
        var z2 = this.z.redSqr();
        var u1 = this.x.redMul(pz2);
        var u2 = p.x.redMul(z2);
        var s1 = this.y.redMul(pz2.redMul(p.z));
        var s2 = p.y.redMul(z2.redMul(this.z));

        var h = u1.redSub(u2);
        var r = s1.redSub(s2);
        if (h.cmpn(0) === 0) {
            if (r.cmpn(0) !== 0)
                return this.curve.jpoint(null, null, null);
            else
                return this.dbl();
        }

        var h2 = h.redSqr();
        var h3 = h2.redMul(h);
        var v = u1.redMul(h2);

        var nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
        var ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
        var nz = this.z.redMul(p.z).redMul(h);

        return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype.mixedAdd = function mixedAdd(p) {
        // O + P = P
        if (this.isInfinity())
            return p.toJ();

        // P + O = P
        if (p.isInfinity())
            return this;

        // 8M + 3S + 7A
        var z2 = this.z.redSqr();
        var u1 = this.x;
        var u2 = p.x.redMul(z2);
        var s1 = this.y;
        var s2 = p.y.redMul(z2).redMul(this.z);

        var h = u1.redSub(u2);
        var r = s1.redSub(s2);
        if (h.cmpn(0) === 0) {
            if (r.cmpn(0) !== 0)
                return this.curve.jpoint(null, null, null);
            else
                return this.dbl();
        }

        var h2 = h.redSqr();
        var h3 = h2.redMul(h);
        var v = u1.redMul(h2);

        var nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
        var ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
        var nz = this.z.redMul(h);

        return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype.dblp = function dblp(pow) {
        if (pow === 0)
            return this;
        if (this.isInfinity())
            return this;
        if (!pow)
            return this.dbl();

        if (this.curve.zeroA || this.curve.threeA) {
            var r = this;
            for (var i = 0; i < pow; i++)
                r = r.dbl();
            return r;
        }

        // 1M + 2S + 1A + N * (4S + 5M + 8A)
        // N = 1 => 6M + 6S + 9A
        var a = this.curve.a;
        var tinv = this.curve.tinv;

        var jx = this.x;
        var jy = this.y;
        var jz = this.z;
        var jz4 = jz.redSqr().redSqr();

        // Reuse results
        var jyd = jy.redAdd(jy);
        for (var i = 0; i < pow; i++) {
            var jx2 = jx.redSqr();
            var jyd2 = jyd.redSqr();
            var jyd4 = jyd2.redSqr();
            var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));

            var t1 = jx.redMul(jyd2);
            var nx = c.redSqr().redISub(t1.redAdd(t1));
            var t2 = t1.redISub(nx);
            var dny = c.redMul(t2);
            dny = dny.redIAdd(dny).redISub(jyd4);
            var nz = jyd.redMul(jz);
            if (i + 1 < pow)
                jz4 = jz4.redMul(jyd4);

            jx = nx;
            jz = nz;
            jyd = dny;
        }

        return this.curve.jpoint(jx, jyd.redMul(tinv), jz);
    };

    JPoint.prototype.dbl = function dbl() {
        if (this.isInfinity())
            return this;

        if (this.curve.zeroA)
            return this._zeroDbl();
        else if (this.curve.threeA)
            return this._threeDbl();
        else
            return this._dbl();
    };

    JPoint.prototype._zeroDbl = function _zeroDbl() {
        var nx;
        var ny;
        var nz;
        // Z = 1
        if (this.zOne) {
            // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html
            //     #doubling-mdbl-2007-bl
            // 1M + 5S + 14A

            // XX = X1^2
            var xx = this.x.redSqr();
            // YY = Y1^2
            var yy = this.y.redSqr();
            // YYYY = YY^2
            var yyyy = yy.redSqr();
            // S = 2 * ((X1 + YY)^2 - XX - YYYY)
            var s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
            s = s.redIAdd(s);
            // M = 3 * XX + a; a = 0
            var m = xx.redAdd(xx).redIAdd(xx);
            // T = M ^ 2 - 2*S
            var t = m.redSqr().redISub(s).redISub(s);

            // 8 * YYYY
            var yyyy8 = yyyy.redIAdd(yyyy);
            yyyy8 = yyyy8.redIAdd(yyyy8);
            yyyy8 = yyyy8.redIAdd(yyyy8);

            // X3 = T
            nx = t;
            // Y3 = M * (S - T) - 8 * YYYY
            ny = m.redMul(s.redISub(t)).redISub(yyyy8);
            // Z3 = 2*Y1
            nz = this.y.redAdd(this.y);
        } else {
            // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html
            //     #doubling-dbl-2009-l
            // 2M + 5S + 13A

            // A = X1^2
            var a = this.x.redSqr();
            // B = Y1^2
            var b = this.y.redSqr();
            // C = B^2
            var c = b.redSqr();
            // D = 2 * ((X1 + B)^2 - A - C)
            var d = this.x.redAdd(b).redSqr().redISub(a).redISub(c);
            d = d.redIAdd(d);
            // E = 3 * A
            var e = a.redAdd(a).redIAdd(a);
            // F = E^2
            var f = e.redSqr();

            // 8 * C
            var c8 = c.redIAdd(c);
            c8 = c8.redIAdd(c8);
            c8 = c8.redIAdd(c8);

            // X3 = F - 2 * D
            nx = f.redISub(d).redISub(d);
            // Y3 = E * (D - X3) - 8 * C
            ny = e.redMul(d.redISub(nx)).redISub(c8);
            // Z3 = 2 * Y1 * Z1
            nz = this.y.redMul(this.z);
            nz = nz.redIAdd(nz);
        }

        return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype._threeDbl = function _threeDbl() {
        var nx;
        var ny;
        var nz;
        // Z = 1
        if (this.zOne) {
            // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-3.html
            //     #doubling-mdbl-2007-bl
            // 1M + 5S + 15A

            // XX = X1^2
            var xx = this.x.redSqr();
            // YY = Y1^2
            var yy = this.y.redSqr();
            // YYYY = YY^2
            var yyyy = yy.redSqr();
            // S = 2 * ((X1 + YY)^2 - XX - YYYY)
            var s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
            s = s.redIAdd(s);
            // M = 3 * XX + a
            var m = xx.redAdd(xx).redIAdd(xx).redIAdd(this.curve.a);
            // T = M^2 - 2 * S
            var t = m.redSqr().redISub(s).redISub(s);
            // X3 = T
            nx = t;
            // Y3 = M * (S - T) - 8 * YYYY
            var yyyy8 = yyyy.redIAdd(yyyy);
            yyyy8 = yyyy8.redIAdd(yyyy8);
            yyyy8 = yyyy8.redIAdd(yyyy8);
            ny = m.redMul(s.redISub(t)).redISub(yyyy8);
            // Z3 = 2 * Y1
            nz = this.y.redAdd(this.y);
        } else {
            // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-3.html#doubling-dbl-2001-b
            // 3M + 5S

            // delta = Z1^2
            var delta = this.z.redSqr();
            // gamma = Y1^2
            var gamma = this.y.redSqr();
            // beta = X1 * gamma
            var beta = this.x.redMul(gamma);
            // alpha = 3 * (X1 - delta) * (X1 + delta)
            var alpha = this.x.redSub(delta).redMul(this.x.redAdd(delta));
            alpha = alpha.redAdd(alpha).redIAdd(alpha);
            // X3 = alpha^2 - 8 * beta
            var beta4 = beta.redIAdd(beta);
            beta4 = beta4.redIAdd(beta4);
            var beta8 = beta4.redAdd(beta4);
            nx = alpha.redSqr().redISub(beta8);
            // Z3 = (Y1 + Z1)^2 - gamma - delta
            nz = this.y.redAdd(this.z).redSqr().redISub(gamma).redISub(delta);
            // Y3 = alpha * (4 * beta - X3) - 8 * gamma^2
            var ggamma8 = gamma.redSqr();
            ggamma8 = ggamma8.redIAdd(ggamma8);
            ggamma8 = ggamma8.redIAdd(ggamma8);
            ggamma8 = ggamma8.redIAdd(ggamma8);
            ny = alpha.redMul(beta4.redISub(nx)).redISub(ggamma8);
        }

        return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype._dbl = function _dbl() {
        var a = this.curve.a;

        // 4M + 6S + 10A
        var jx = this.x;
        var jy = this.y;
        var jz = this.z;
        var jz4 = jz.redSqr().redSqr();

        var jx2 = jx.redSqr();
        var jy2 = jy.redSqr();

        var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));

        var jxd4 = jx.redAdd(jx);
        jxd4 = jxd4.redIAdd(jxd4);
        var t1 = jxd4.redMul(jy2);
        var nx = c.redSqr().redISub(t1.redAdd(t1));
        var t2 = t1.redISub(nx);

        var jyd8 = jy2.redSqr();
        jyd8 = jyd8.redIAdd(jyd8);
        jyd8 = jyd8.redIAdd(jyd8);
        jyd8 = jyd8.redIAdd(jyd8);
        var ny = c.redMul(t2).redISub(jyd8);
        var nz = jy.redAdd(jy).redMul(jz);

        return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype.trpl = function trpl() {
        if (!this.curve.zeroA)
            return this.dbl().add(this);

        // hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#tripling-tpl-2007-bl
        // 5M + 10S + ...

        // XX = X1^2
        var xx = this.x.redSqr();
        // YY = Y1^2
        var yy = this.y.redSqr();
        // ZZ = Z1^2
        var zz = this.z.redSqr();
        // YYYY = YY^2
        var yyyy = yy.redSqr();
        // M = 3 * XX + a * ZZ2; a = 0
        var m = xx.redAdd(xx).redIAdd(xx);
        // MM = M^2
        var mm = m.redSqr();
        // E = 6 * ((X1 + YY)^2 - XX - YYYY) - MM
        var e = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
        e = e.redIAdd(e);
        e = e.redAdd(e).redIAdd(e);
        e = e.redISub(mm);
        // EE = E^2
        var ee = e.redSqr();
        // T = 16*YYYY
        var t = yyyy.redIAdd(yyyy);
        t = t.redIAdd(t);
        t = t.redIAdd(t);
        t = t.redIAdd(t);
        // U = (M + E)^2 - MM - EE - T
        var u = m.redIAdd(e).redSqr().redISub(mm).redISub(ee).redISub(t);
        // X3 = 4 * (X1 * EE - 4 * YY * U)
        var yyu4 = yy.redMul(u);
        yyu4 = yyu4.redIAdd(yyu4);
        yyu4 = yyu4.redIAdd(yyu4);
        var nx = this.x.redMul(ee).redISub(yyu4);
        nx = nx.redIAdd(nx);
        nx = nx.redIAdd(nx);
        // Y3 = 8 * Y1 * (U * (T - U) - E * EE)
        var ny = this.y.redMul(u.redMul(t.redISub(u)).redISub(e.redMul(ee)));
        ny = ny.redIAdd(ny);
        ny = ny.redIAdd(ny);
        ny = ny.redIAdd(ny);
        // Z3 = (Z1 + E)^2 - ZZ - EE
        var nz = this.z.redAdd(e).redSqr().redISub(zz).redISub(ee);

        return this.curve.jpoint(nx, ny, nz);
    };

    JPoint.prototype.mul = function mul(k, kbase) {
        k = new BN(k, kbase);

        return this.curve._wnafMul(this, k);
    };

    JPoint.prototype.eq = function eq(p) {
        if (p.type === 'affine')
            return this.eq(p.toJ());

        if (this === p)
            return true;

        // x1 * z2^2 == x2 * z1^2
        var z2 = this.z.redSqr();
        var pz2 = p.z.redSqr();
        if (this.x.redMul(pz2).redISub(p.x.redMul(z2)).cmpn(0) !== 0)
            return false;

        // y1 * z2^3 == y2 * z1^3
        var z3 = z2.redMul(this.z);
        var pz3 = pz2.redMul(p.z);
        return this.y.redMul(pz3).redISub(p.y.redMul(z3)).cmpn(0) === 0;
    };

    JPoint.prototype.eqXToP = function eqXToP(x) {
        var zs = this.z.redSqr();
        var rx = x.toRed(this.curve.red).redMul(zs);
        if (this.x.cmp(rx) === 0)
            return true;

        var xc = x.clone();
        var t = this.curve.redN.redMul(zs);
        for (;;) {
            xc.iadd(this.curve.n);
            if (xc.cmp(this.curve.p) >= 0)
                return false;

            rx.redIAdd(t);
            if (this.x.cmp(rx) === 0)
                return true;
        }
        return false;
    };

    JPoint.prototype.inspect = function inspect() {
        if (this.isInfinity())
            return '<EC JPoint Infinity>';
        return '<EC JPoint x: ' + this.x.toString(16, 2) +
            ' y: ' + this.y.toString(16, 2) +
            ' z: ' + this.z.toString(16, 2) + '>';
    };

    JPoint.prototype.isInfinity = function isInfinity() {
        // XXX This code assumes that zero is always zero in red
        return this.z.cmpn(0) === 0;
    };

},{"../../elliptic":72,"../curve":75,"bn.js":21,"inherits":113}],78:[function(require,module,exports){
    'use strict';

    var curves = exports;

    var hash = require('hash.js');
    var elliptic = require('../elliptic');

    var assert = elliptic.utils.assert;

    function PresetCurve(options) {
        if (options.type === 'short')
            this.curve = new elliptic.curve.short(options);
        else if (options.type === 'edwards')
            this.curve = new elliptic.curve.edwards(options);
        else
            this.curve = new elliptic.curve.mont(options);
        this.g = this.curve.g;
        this.n = this.curve.n;
        this.hash = options.hash;

        assert(this.g.validate(), 'Invalid curve');
        assert(this.g.mul(this.n).isInfinity(), 'Invalid curve, G*N != O');
    }
    curves.PresetCurve = PresetCurve;

    function defineCurve(name, options) {
        Object.defineProperty(curves, name, {
            configurable: true,
            enumerable: true,
            get: function() {
                var curve = new PresetCurve(options);
                Object.defineProperty(curves, name, {
                    configurable: true,
                    enumerable: true,
                    value: curve
                });
                return curve;
            }
        });
    }

    defineCurve('p192', {
        type: 'short',
        prime: 'p192',
        p: 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff',
        a: 'ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc',
        b: '64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1',
        n: 'ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831',
        hash: hash.sha256,
        gRed: false,
        g: [
            '188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012',
            '07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811'
        ]
    });

    defineCurve('p224', {
        type: 'short',
        prime: 'p224',
        p: 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001',
        a: 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe',
        b: 'b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4',
        n: 'ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d',
        hash: hash.sha256,
        gRed: false,
        g: [
            'b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21',
            'bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34'
        ]
    });

    defineCurve('p256', {
        type: 'short',
        prime: null,
        p: 'ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff',
        a: 'ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc',
        b: '5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b',
        n: 'ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551',
        hash: hash.sha256,
        gRed: false,
        g: [
            '6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296',
            '4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5'
        ]
    });

    defineCurve('p384', {
        type: 'short',
        prime: null,
        p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
        'fffffffe ffffffff 00000000 00000000 ffffffff',
        a: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
        'fffffffe ffffffff 00000000 00000000 fffffffc',
        b: 'b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f ' +
        '5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef',
        n: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 ' +
        'f4372ddf 581a0db2 48b0a77a ecec196a ccc52973',
        hash: hash.sha384,
        gRed: false,
        g: [
            'aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 ' +
            '5502f25d bf55296c 3a545e38 72760ab7',
            '3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 ' +
            '0a60b1ce 1d7e819d 7a431d7c 90ea0e5f'
        ]
    });

    defineCurve('p521', {
        type: 'short',
        prime: null,
        p: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
        'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
        'ffffffff ffffffff ffffffff ffffffff ffffffff',
        a: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
        'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
        'ffffffff ffffffff ffffffff ffffffff fffffffc',
        b: '00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b ' +
        '99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd ' +
        '3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00',
        n: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ' +
        'ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 ' +
        'f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409',
        hash: hash.sha512,
        gRed: false,
        g: [
            '000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 ' +
            '053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 ' +
            'a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66',
            '00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 ' +
            '579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 ' +
            '3fad0761 353c7086 a272c240 88be9476 9fd16650'
        ]
    });

    defineCurve('curve25519', {
        type: 'mont',
        prime: 'p25519',
        p: '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed',
        a: '76d06',
        b: '1',
        n: '1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed',
        hash: hash.sha256,
        gRed: false,
        g: [
            '9'
        ]
    });

    defineCurve('ed25519', {
        type: 'edwards',
        prime: 'p25519',
        p: '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed',
        a: '-1',
        c: '1',
        // -121665 * (121666^(-1)) (mod P)
        d: '52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3',
        n: '1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3e