/**
 * @module TYPO3/CMS/SudoMode/BackendEventListener
 */
define(
    ['require', 'exports', 'TYPO3/CMS/SudoMode/EventHandler', 'TYPO3/CMS/Backend/AjaxDataHandler'],
    function (require, exports, EventHandler, AjaxDataHandler) {
        'use strict';

        AjaxDataHandler.addMiddleware(function(request, next) {
            // Requests are not immutable, therefore we clone to be able to re-submit exactly the same request later on
            var requestClone = request.clone();
            return next(request).then(function(response) {
                console.log('[sudo_mode] processing response', response)
                return new Promise(function(resolve, reject) {
                    var eventHandler = new EventHandler({
                        request: requestClone,
                        response: response,
                        resolve: resolve,
                        reject: reject,
                        nextMiddleware: next
                    })
                    if (eventHandler.isRelevant()) {
                        console.log('[sudo_mode] response is relevant', response)
                        eventHandler.requestAction()
                    } else {
                        // Pass on the original response if we do not need to intercept
                        resolve(response);
                    }
                });
            });
        });
    }
);
