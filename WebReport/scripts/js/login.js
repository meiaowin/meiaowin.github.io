/**
 * Created by lp on 2016/8/8.
 */
if (!window.LoginHelper) {
    window.LoginHelper = {};
}

/**
 * 关闭窗口
 * @type {Function}
 */
LoginHelper.closeWindow = LoginHelper.closeWindow || function () {
};

/**
 * 注册的跳转
 * @type {Function}
 */
LoginHelper.registerHref = LoginHelper.registerHref || function () {
};

/**
 * 忘记密码的跳转
 * @type {Function}
 */
LoginHelper.forgetHref = LoginHelper.forgetHref || function () {
};

/**
 * 默认论坛账号登录
 * @type {Function}
 */
LoginHelper.defaultLogin = LoginHelper.defaultLogin || function (username, password, cb) {
};

/**
 * 展示qq登录窗口
 * @type {Function}
 */
LoginHelper.showQQ = LoginHelper.showQQ || function () {
};
/**
 * Created by lp on 2016/8/8.
 */
(function ($) {
    if (window.assemb === null || window.assemb === undefined) {
        window.assemb = {};
    }

    assemb.components = {
        init: function () {
            this.setRegisterHref();
            this.setForgetHref();
            this.defaultLogin();
            this.closeDialog();
            this.qqLogin();
            this.keyBind();
        },

        setRegisterHref: function () {
            $('.register').bind('click', function () {
                LoginHelper.registerHref();
            });
        },

        setForgetHref: function () {
            $('.forget').bind('click', function () {
                LoginHelper.forgetHref();
            });
        },

        defaultLogin: function () {
            var self = this;
            $('.login-btn').bind('click', function () {
                self.hideErrorMsg();
                var username = $('.user-info').val();
                var password = $('.password').val();
                if (username.length === 0 || password.length === 0) {
                    self.showErrorMsg(PluginHelper.parseI18("FR-Plugin-Store_Not_Null"));
                    return;
                }
                self.showTransition();
                LoginHelper.defaultLogin(username, password, function (result) {
                    var assembComponent = assemb.components;
                    assembComponent.hideTransition();
                    var res = parseInt(result, 10);
                    if (res === -1) {
                        assembComponent.showErrorMsg("用户名不存在");
                    }
                    if (res === -2) {
                        assembComponent.showErrorMsg("用户名或密码错误");
                    }
                    if (res === -3) {
                        assembComponent.showErrorMsg("未知错误");
                    }
                    if (res === -4) {
                        assembComponent.showErrorMsg("网络连接失败");
                    }
                    if (res === -5) {
                        assembComponent.showErrorMsg("用户名或密码不能为空");
                    }
                });

            });
        },

        closeDialog: function () {
            $('.login-close').bind('click', function () {
                LoginHelper.closeWindow();
            });
        },

        qqLogin: function () {
            $('.qq-login-btn').bind('click', function () {
                LoginHelper.showQQ();
            });
        },

        showTransition: function () {
            $('.login-content .transition').show();
            $('.default-login').addClass('blur-loading');
            $('.login-btn').prop('disabled', true);
        },

        hideTransition: function () {
            $('.login-content .login-btn').prop('disabled', false);
            $('.transition').hide();
            $('.default-login').removeClass('blur-loading');
        },

        showErrorMsg: function (text) {
            var $errorMag = $('.error-msg');
            $errorMag.text(text);
            $errorMag.show();
        },

        hideErrorMsg: function () {
            var $errorMag = $('.error-msg');
            $errorMag.text("");
            $errorMag.hide();
        },

        keyBind: function () {
            $('.user-info').keydown(handleKeyDown);
            $('.password').keydown(handleKeyDown);

            function handleKeyDown(event) {
                if (event.which === 13) {
                    event.preventDefault();
                    $('.login-btn').click();
                }
            }

        }
    };

})(jQuery);

/**
 * Created by lp on 2016/8/8.
 */
(function ($) {
    if (window.assemb == null) {
        window.assemb = {};
    }

    assemb.build = function () {
        this.components.init();
    };
})(jQuery);