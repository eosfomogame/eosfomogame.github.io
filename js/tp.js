(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = require('./src/tp');
},{"./src/tp":2}],2:[function(require,module,exports){

var TYPE_MAP = {
    eth: '1',
    jingtum: '2',
    moac: '3',
    eos: '4'
};

var _getTypeByStr = function _getTypeByStr(typeStr) {
    var reTrim = /^\s+|\s+$/g;
    typeStr += '';
    typeStr = typeStr.replace(reTrim, '').toLowerCase();
    return TYPE_MAP[typeStr] || typeStr;
};

var _getCallbackName = function _getCallbackName() {
    return 'tp_callback_' + new Date().getTime();
};

var tp = {
    version: '1.1.1',
    isConnected: function isConnected() {
        return !!(window.TPJSBrigeClient || window.webkit);
    },
    eosTokenTransfer: function eosTokenTransfer(params) {
        // 必填项
        if (!params.from || !params.to || !params.amount || !params.tokenName || !params.contract || !params.precision) {
            throw new Error('missing params; "from", "to", "amount", "tokenName","contract", "precision" is required');
        }

        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {
                    var res = JSON.parse(result);
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            };
            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('eosTokenTransfer', JSON.stringify(params), tpCallbackFun);
            }
            // ios
            if (window.webkit) {
                window.webkit.messageHandlers.eosTokenTransfer.postMessage({ body: { 'params': JSON.stringify(params), 'callback': tpCallbackFun } });
            }
        });
    },
    pushEosAction: function pushEosAction(params) {
        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {
                    var res = JSON.parse(result);
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            };
            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('pushEosAction', JSON.stringify(params), tpCallbackFun);
            }
            // iOS
            else if (window.webkit) {
                    window.webkit.messageHandlers.pushEosAction.postMessage({ body: { 'params': JSON.stringify(params), 'callback': tpCallbackFun } });
                }
        });
    },
    getAppInfo: function getAppInfo() {
        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {
                    var res = JSON.parse(result);
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            };
            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('getAppInfo', '', tpCallbackFun);
            }
            // iOS
            else if (window.webkit) {
                    window.webkit.messageHandlers.getAppInfo.postMessage({ body: { 'params': '', 'callback': tpCallbackFun } });
                }
        });
    },
    getEosBalance: function getEosBalance(params) {

        if (!params.account || !params.contract || !params.symbol) {
            throw new Error('missing params; "account", "contract", "symbol" is required ');
        }

        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {
                    var res = JSON.parse(result);
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            };
            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('getEosBalance', JSON.stringify(params), tpCallbackFun);
            }
            // ios
            if (window.webkit) {
                window.webkit.messageHandlers.getEosBalance.postMessage({ body: { 'params': JSON.stringify(params), 'callback': tpCallbackFun } });
            }
        });
    },
    getTableRows: function (params) {
        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {
                    var res = JSON.parse(result);
                    resolve(res);
                }
                catch (e) {
                    reject(e);
                }
            }
            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('getTableRows', JSON.stringify(params), tpCallbackFun);
            }
            // iOS
            else if (window.webkit) {
                window.webkit.messageHandlers.getTableRows.postMessage({body:{'params': JSON.stringify(params), 'callback': tpCallbackFun}});
            }
        });
    },
    // getEosAccountInfo: function getEosAccountInfo(params) {

    //     if (!params.account) {
    //         throw new Error('missing params; "account" is required ');
    //     }

    //     return new Promise(function (resolve, reject) {
    //         var tpCallbackFun = _getCallbackName();

    //         window[tpCallbackFun] = function (result) {

    //             try {
    //                 var res = JSON.parse(result);
    //                 resolve(res);
    //             } catch (e) {
    //                 reject(e);
    //             }
    //         };
    //         // android
    //         if (window.TPJSBrigeClient) {
    //             window.TPJSBrigeClient.callMessage('getEosAccountInfo', JSON.stringify(params), tpCallbackFun);
    //         }
    //         // ios
    //         if (window.webkit) {
    //             window.webkit.messageHandlers.getEosAccountInfo.postMessage({ body: { 'params': JSON.stringify(params), 'callback': tpCallbackFun } });
    //         }
    //     });
    // },
    getDeviceId: function getDeviceId() {
        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {
                    var res = JSON.parse(result);
                    if (res.device_id) {
                        res.data = res.device_id;
                    }
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            };
            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('getDeviceId', '', tpCallbackFun);
            }
            // ios
            if (window.webkit) {
                window.webkit.messageHandlers.getDeviceId.postMessage({ body: { 'params': '', 'callback': tpCallbackFun } });
            }
        });
    },
    getWalletList: function getWalletList(type) {
        type = _getTypeByStr(type);

        if (!type) {
            throw new Error('type invalid');
        }

        var params = { type: type };

        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {

                    var res = JSON.parse(result);
                    resolve(res);
                } catch (e) {
                    reject(e);
                }
            };

            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('getWalletList', JSON.stringify(params), tpCallbackFun);
            }
            // ios
            if (window.webkit) {
                window.webkit.messageHandlers.getWalletList.postMessage({ body: { 'params': JSON.stringify(params), 'callback': tpCallbackFun } });
            }
        });
    },
    invokeQRScanner: function invokeQRScanner() {
        return new Promise(function (resolve, reject) {
            var tpCallbackFun = _getCallbackName();

            window[tpCallbackFun] = function (result) {

                try {
                    var res = JSON.parse(result);
                    var data = res.qrResult || '';
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            };
            // android
            if (window.TPJSBrigeClient) {
                window.TPJSBrigeClient.callMessage('invokeQRScanner', '', tpCallbackFun);
            }
            // ios
            if (window.webkit) {
                window.webkit.messageHandlers.invokeQRScanner.postMessage({ body: { 'params': '', 'callback': tpCallbackFun } });
            }
        });
    },
    shareNewsToSNS: function shareNewsToSNS(params) {

        var title = params.title || 'TokenPocket 你的通用数字钱包';
        var description = params.desc || '';
        var url = params.url || 'https://www.mytokenpocket.vip/';
        var previewImage = params.previewImage || '';

        var data = { title: title, description: description, url: url, previewImage: previewImage };

        if (window.webkit) {
            window.webkit.messageHandlers.shareNewsToSNS.postMessage({ body: { 'params': JSON.stringify(data), 'callback': '' } });
        }
        if (window.TPJSBrigeClient) {
            window.TPJSBrigeClient.callMessage('shareNewsToSNS', JSON.stringify(data), '');
        }
    }
};

module.exports = tp;

},{}],3:[function(require,module,exports){
var tp = require('./index');

window.tp = tp;
},{"./index":1}]},{},[3]);
