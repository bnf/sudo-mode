/**
 * @module TYPO3/CMS/SudoMode/BackendEventListener
 */
define(
    [
        'jquery',
        'TYPO3/CMS/Backend/Modal',
        // opt(ional) modules using loader plugin
        'TYPO3/CMS/SudoMode/opt!TYPO3/CMS/Backend/BroadcastService',
        'TYPO3/CMS/SudoMode/opt!TYPO3/CMS/Backend/BroadcastMessage',
        'TYPO3/CMS/SudoMode/opt!TYPO3/CMS/Rsaauth/RsaEncryptionModule'
    ],
    function ($, Modal, broadcastService, BroadcastMessageModule, RsaEncryption) {
        'use strict';

        if (!broadcastService || !BroadcastMessageModule) {
            console.info('BroadcastService or BroadcastMessage not found, which is fine in TYPO3 v9');
        }

        function EventHandler(message) {
            this.canCancel = true;
            this.message = message;
            this.action = message.action;
            this.response = message.response;
            this.processToken = message.processToken;
            this.modal = null;
            this.resolve = message.resolve || null;
            this.reject = message.reject || null;
            this.nextMiddleware = message.nextMiddleware || null;
            this.request = message.request || null;
        }

        EventHandler.prototype.handle = function() {
            if (!this.isRelevant()) {
                return;
            }
            this.requestAction();
        }

        EventHandler.prototype.showModal = function(instruction) {
            var that = this;
            var $content = $(instruction.content);
            var $invalid = $content.find('#' + instruction.invalidId)
                .hide();

            this.modal = Modal.advanced({
                type: Modal.types.default,
                title: instruction.title,
                content: $content,
                severity: instruction.severity,
                buttons: [
                    {
                        btnClass: 'btn-default',
                        text: instruction.button.cancel,
                        trigger: function(evt) {
                            console.log('cancel btn', evt, that.canCancel)
                            if (that.canCancel) {
                                that.cancelAction(instruction);
                                that.resolve(that.response)
                                // @todo remove
                                that.broadcast('revert');
                            }
                            that.modal.trigger('modal-dismiss');
                        }
                    },
                    {
                        btnClass: 'btn-warning',
                        text: instruction.button.confirm,
                        trigger: function(evt) {
                            evt.preventDefault();
                            var form = evt.currentTarget.parentElement.parentElement.querySelector('#' + instruction.formId);
                            var isInIframe = window.location !== window.parent.location;
                            if (isInIframe) {
                                top.require(['jquery'], function($) {
                                    $(form).submit();
                                });
                            } else {
                                $(form).submit()
                            }
                        }
                    }
                ]
            }).on('shown.bs.modal', function(evt) {
                if (RsaEncryption) {
                    var form = that.modal.find('#' + instruction.formId).get(0)
                    var isInIframe = window.location !== window.parent.location;
                    // TYPO3 v9 ext:rsaauth initialization
                    if (isInIframe) {
                        // No need for opt! module, as we already know that RsaEcnryption is available
                        top.require(['TYPO3/CMS/Rsaauth/RsaEncryptionModule'], function(RsaEncryption) {
                            RsaEncryption.registerForm(form);
                        })
                    } else {
                        RsaEncryption.registerForm(form);
                    }
                }
            }).on('hidden.bs.modal', function(evt) {
                if (that.canCancel) {
                    that.cancelAction(instruction);
                    that.resolve(that.response)
                    // @todo remove
                    that.broadcast('revert');
                }
                // remove memory reference with next tick
                setTimeout(function() {
                    that.modal = null;
                }, 0);
            })

            var form = this.modal.find('#' + instruction.formId).get(0)
            var generateSubmitHandler = function($) {
              return function (evt) {
                evt.preventDefault();
                that.verifyAction(instruction, $(evt.currentTarget), $invalid);
              }
            }
            var isInIframe = window.location !== window.parent.location;
            if (isInIframe) {
                top.require(['jquery'], function($) {
                    $(form).on('submit', generateSubmitHandler($));
                });
            } else {
                $(form).on('submit', generateSubmitHandler($));
            }
        }

        EventHandler.prototype.isRelevant = function() {
            var expectedValue = 'sudo-mode:confirmation-request';
            return this.response.headers && this.response.headers.get('x-typo3-emitevent') === expectedValue;
        }

        EventHandler.prototype.requestAction = function() {
            var that = this;
            var req = function(uri) {
                $.ajax({
                    method: 'GET',
                    dataType: 'json',
                    url: uri
                }).done(function(response) {
                    that.showModal(response);
                });
            };
            if (this.response instanceof Response) {
                this.response.clone().json().then(function(body) {
                    req(body.uri)
                });
            } else {
                // @todo drop, it is unneeded
                req(this.response.body.uri);
            }
        }

        EventHandler.prototype.verifyAction = function(instruction, $form, $invalid) {
            var that = this;
            var formData = new FormData($form.get(0));
            $invalid.hide();
            $.ajax({
                method: 'POST',
                url: instruction.uri.verify,
                data: formData,
                processData: false,
                contentType: false
            }).done(function(response, status, xhr) {
                that.canCancel = false;
                if (that.resolve) {
                    console.log('success sudo', {response, status, xhr})
                    // Re-issue the original request, now that the session is privileged
                    that.nextMiddleware(that.request).then(that.resolve, that.reject);
                } else {
                    that.broadcast(that.action);
                }
                that.modal.trigger('modal-dismiss');
            }).fail(function(xhr, status, error) {
                $invalid.show();
            });
        }

        EventHandler.prototype.cancelAction = function(instruction) {
            this.canCancel = false;
            var that = this;
            $.ajax({
                method: 'GET',
                url: instruction.uri.cancel
            }).fail(function(xhr, status, error) {
                console.warn('Cancel action failed: ' + error);
                that.canCancel = true;
            })
        }

        EventHandler.prototype.broadcast = function(action) {
            var instruction = {
                action: action,
                processToken: this.processToken,
                parameters: this.message.parameters,
                elementIdentifier: this.message.elementIdentifier
            };
            broadcastService.post(
                // class BroadcastMessage is wrapped in module object
                new BroadcastMessageModule.BroadcastMessage(
                    'ajax-data-handler',
                    'instruction@' + this.processToken,
                    instruction
                )
            );
        }

        return EventHandler;
    }
);
