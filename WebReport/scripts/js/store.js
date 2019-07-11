/**
 * Created by richie on 16/3/19.
 */
;
if (!window.PluginHelper) {
    window.PluginHelper = {};
}
if (window.parent && window.parent.FS && window.parent.FS.PluginOperator) {
    PluginHelper.isWar = window.parent.FS.PluginOperator.isWar;
}
// PluginHelper.useWebSocket = 'WebSocket' in window  && document.location.protocol === 'http:';
PluginHelper.useWebSocket = false;


/**
 * 从服务器上安装插件
 * @param {String} pluginID 插件ID
 * @param {Function} callback 回调函数,安装过程中会使用回调函数返回安装进度
 */
PluginHelper.installPluginOnline = PluginHelper.installPluginOnline || function (pluginInfo, callback) {
    if (PluginHelper.isWar) {
        FR.Msg.alert(FR.i18nText("FS-Msg_Warning"), FR.i18nText("FS-Web-Error_Cannot_Delete_In_War_Or_Cluster"));
    }
    var processCallback = function (value) {
        if (value && value.progress) {
            callback(value.progress);
        }
        if (value && value.status) {
            callback.call(this, value.status);
            var info = value.info || "";
            if (value.status === "success") {
                FR.showNeededDialog(info + FR.i18nText("FR-Plugin_Install_Success"));
            } else if (value.status === 'failed') {
                if (value.errorcode === '37') {
                    FR.Msg.confirm(FR.i18nText("FS-Msg_Prompt"), FR.i18nText("FR-Plugin_Has_Install_Lower"),
                        function (r) {
                            if (r === true) {
                                Store.Progress.showProgress();
                                var arry = pluginInfo.split("_");
                                //从已安装的插件中找到需要更新的插件
                                var plugin = Store.Installed.findInstalledPluginByID(arry[0]);
                                var pluginInfoArray = [plugin];
                                PluginHelper.updatePluginOnline(pluginInfoArray, callback);
                            }
                        });
                } else {
                    FR.showNeededDialog(info);
                }
            }
        }
    };
    var channel = "install_online_" + pluginInfo;
    PluginHelper.getProgress('progress', channel, processCallback);
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=online_install',
        type: 'POST',
        data: {
            'pluginInfo': pluginInfo,
            'channel': channel
        },
        complete: function (res, status) {
            if (status === 'success') {
                var value = FR.jsonDecode(res.responseText);
                if (value && value.status === 'failed') {
                    FR.showNeededDialog(value.message);
                }
            }
        }
    });
};


/**
 * 创建websocket连接
 * @para {String} channel 操作的标识
 * @para {Function} processCallback 接收消息执行函数
 */
PluginHelper.createWebScoketManager = PluginHelper.createWebScoketManager || function (channel, processCallback, cmd) {
    var websocket = new WebSocket("ws://" + location.hostname + ":8096" + "/" + channel);

    websocket.onerror = function () {
        PluginHelper.useWebSocket = false;
        PluginHelper.getProgressByPoll(cmd, processCallback);
    };
    websocket.onopen = function (event) {
        PluginHelper.useWebSocket = true;
    };
    websocket.onmessage = function (event) {
        var result = FR.jsonDecode(event.data);
        if (result) {
            processCallback.call(this, result);
        }
        if (result && result.status) {
            websocket.close();
        }
    };
    //连接关闭的回调方法
    websocket.onclose = function () {

    };
    //监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接，防止连接还没断开就关闭窗口，server端会抛异常。
    window.onbeforeunload = function () {
        websocket.close();
    };
    return websocket;
};

/**
 * 获取操作进度
 * @para {String} cmd action的url
 * @para {String} channel 操作的标识
 * @para {Function} callback 回调函数
 */
PluginHelper.getProgress = PluginHelper.getProgress || function (cmd, channel, callback) {
    if (!PluginHelper.useWebSocket) {
        PluginHelper.getProgressByPoll(cmd, callback);
    } else {
        PluginHelper.createWebScoketManager(channel, callback, cmd);
    }
};


PluginHelper.getProgressByPoll = function (cmd, callback) {
    var processOver = false;
    var operation = setInterval(function () {
        FR.ajax({
            url: FR.servletURL + '?op=plugin&cmd=' + cmd + '&timestamp=' + new Date().getTime(),
            complete: function (res, status) {
                if (processOver) {
                    return;
                }
                if (status === 'success') {
                    var value = FR.jsonDecode(res.responseText);
                    if (value && value.status) {
                        processOver = true;
                        clearInterval(operation);
                    }
                    callback.call(this, value);
                }
            }
        });
    }, 200);
};

/**
 * 从磁盘安装插件
 * @param {String} filePath 插件ID
 * @param {Function} callback 回调函数,安装过程中会使用回调函数返回安装进度
 */
PluginHelper.installPluginFromDisk = PluginHelper.installPluginFromDisk || function (path, callback) {
    if (PluginHelper.isWar) {
        FR.Msg.alert(FR.i18nText("FS-Msg_Warning"), FR.i18nText("FS-Web-Error_Cannot_Delete_In_War_Or_Cluster"));
    }
    var channel = "install_fromDisk_" + new Date().getTime();
    var $form = $("#install-from-disk-form");
    var $input = $("#install-from-disk");
    $input.val("").unbind();
    var processCallback = function (value) {
        if (value && value.progress) {
            callback(value.progress);
        }
        if (value && value.status) {
            callback.call(this, value.status);
            var info = value.info || "";
            if (value.status === 'success') {
                FR.showNeededDialog(info + FR.i18nText("FR-Plugin_Install_Success"));
            } else if (value.status === 'failed') {
                if (value.errorcode === '37') {
                    FR.Msg.confirm(FR.i18nText("FS-Msg_Prompt"), FR.i18nText("FR-Plugin_Has_Install_Lower"),
                        function (r) {
                            if (r === true) {
                                Store.Progress.showProgress();
                                PluginHelper.updatePluginFromDisk($form, callback);
                            }
                        });
                } else {
                    FR.showNeededDialog(info);
                }
            }
        }
    };
    var inputChangeFc = function (form) {
        FR.autoSubmit({
            el: this,
            url: FR.servletURL + '?op=plugin&cmd=local_install&channel=' + channel + '&timestamp=' + new Date().getTime(),
            allowTypes: 'zip',
            callback: function (res, status) {
                if (status === 'success') {
                    var value = FR.jsonDecode(res.responseText);
                    if (value && value.status === 'failed') {
                        FR.showNeededDialog(value.message);
                    }
                }
            }
        }, form);
        PluginHelper.getProgress('install_from_disk_progress', channel, processCallback)
    };

    var $file = $('input:file', path);
    if ($file.val()) {
        inputChangeFc(path);
    } else {
        $input.val("");
        $input.unbind();
        $input.change(function () {
            inputChangeFc($form);
        });
        $input.click();

    }
};

/**
 * 卸载插件
 * @param [Array] pluginIDs 插件ID集合
 * @param {Function} callback 回调函数,卸载过程中会使用回调函数返回卸载进度
 */
PluginHelper.uninstallPlugin = PluginHelper.uninstallPlugin || function (pluginMarker, isForce, callback) {
    if (PluginHelper.isWar) {
        FR.Msg.alert(FR.i18nText("FS-Msg_Warning"), FR.i18nText("FS-Web-Error_Cannot_Delete_In_War_Or_Cluster"));
    }
    var channel = "uninstall_" + pluginMarker;
    FR.Msg.confirm(FR.i18nText("FS-Msg_Prompt"), FR.i18nText("FS-Msg-Delete_YES_NO"), function (result) {
        if (result) {
            var processCallback = function (value) {
                if (value && value.progress) {
                    callback(value.progress);
                }
                if (value && value.status) {
                    callback.call(this, value.status);
                    var info = value.info || "";
                    if (value.status === "success") {
                        FR.showNeededDialog(info + FR.i18nText("FR-Plugin_Delete_Success"));
                    } else if (value.status === "failed") {
                        if (value.errorcode === '30') {
                            FR.Msg.confirm(FR.i18nText("FS-Msg_Prompt"), FR.i18nText("FR-Plugin_Delete_Dependence"),
                                function (r) {
                                    if (r === true) {
                                        PluginHelper.uninstallPlugin(pluginMarker, true, callback);
                                    } else {
                                        FR.showNeededDialog(FR.i18nText("FR-Plugin_Delete_Failed"));
                                    }
                                });
                        } else {
                            FR.showNeededDialog(info);
                        }
                    }
                }
            };
            PluginHelper.getProgress('uninstall_plugin_progress', channel, processCallback);
            FR.ajax({
                url: FR.servletURL + '?op=plugin&cmd=delete',
                type: 'POST',
                data: {
                    'pluginMarker': pluginMarker,
                    'forceDelete': isForce,
                    'channel': channel
                },
                complete: function (res, status) {
                    if (status === 'success') {
                        var errorinfo = FR.jsonDecode(res.responseText);
                        if (errorinfo.status === 'failed') {
                            FR.showNeededDialog(errorinfo.message);
                        }
                    }
                }
            });
        }
    }, "100px");
};


/**
 * 从服务器上更新插件
 * @param {String} pluginID 插件ID
 * @param {Function} callback 回调函数,安装过程中会使用回调函数返回更新进度
 */
PluginHelper.updatePluginOnline = PluginHelper.updatePluginOnline || function (pluginInfo, callback) {
    if (PluginHelper.isWar) {
        FR.Msg.alert(FR.i18nText("FS-Msg_Warning"), FR.i18nText("FS-Web-Error_Cannot_Delete_In_War_Or_Cluster"));
    }
    var channel = "update_online_" + new Date().getTime();
    var processCallback = function (value) {
        if (value && value.progress) {
            callback(value.progress);
        }
        if (value && value.status) {
            callback.call(this, value.status);
            var info = value.info || "";
            if (value.status === "success") {
                FR.showNeededDialog(info + FR.i18nText("FR-Plugin_Update_Success"));
            } else if (value.status === 'failed') {
                FR.showNeededDialog(info);
            }
        }
    };
    PluginHelper.getProgress('update_progress', channel, processCallback);

    if (!FR.isEmptyArray(pluginInfo)) {
        var tempObj = {'obj': pluginInfo};
        FR.ajax({
            url: FR.servletURL + '?op=plugin&cmd=update_online',
            type: 'POST',
            data: {
                'pluginIDs': tempObj,
                'channel': channel
            },
            complete: function (res, status) {
                if (status === 'success') {
                    var value = FR.jsonDecode(res.responseText);
                    if (value && value.status === 'failed') {
                        FR.showNeededDialog(value.message);
                    }
                }
            }
        });
    }
};

/**
 * 从磁盘上更新插件
 * @param {String} filePath 插件更新包文件路径
 * @param {Function} callback 回调函数,安装过程中会使用回调函数返回更新进度
 */
PluginHelper.updatePluginFromDisk = PluginHelper.updatePluginFromDisk || function (path, callback) {
    if (PluginHelper.isWar) {
        FR.Msg.alert(FR.i18nText("FS-Msg_Warning"), FR.i18nText("FS-Web-Error_Cannot_Delete_In_War_Or_Cluster"));
    }
    var $form = $("#update-from-disk-form"),
        $input = $("#update-from-disk");
    var channel = "update_fromDisk_" + new Date().getTime();
    var processCallback = function (value) {
        if (value && value.progress) {
            callback(value.progress);
        }
        if (value && value.status) {
            callback.call(this, value.status);
            var info = value.info || "";
            if (value.status === 'success') {
                callback(value.status);
                FR.showNeededDialog(info + FR.i18nText("FR-Plugin_Update_Success"));
            } else if (value.status === 'failed') {
                if (value.errorcode === '35') {
                    FR.Msg.confirm(FR.i18nText("FS-Msg_Prompt"), FR.i18nText("FR-Plugin_No_Plugin_Update"),
                        function (r) {
                            if (r === true) {
                                Store.Progress.showProgress();
                                PluginHelper.installPluginFromDisk($form, callback);
                            }
                        });
                } else {
                    callback(value.status);
                    FR.showNeededDialog(info);
                }
            }
        }
    }
    PluginHelper.getProgress('update_from_disk_progress', channel, processCallback);
    $input.val("").unbind();
    var inputChangeFc = function (form) {
        FR.autoSubmit({
            el: this,
            url: FR.servletURL + '?op=plugin&cmd=local_update&channel=' + channel + '&timestamp=' + new Date().getTime(),
            allowTypes: 'zip',
            callback: function (res, status) {
                if (status === 'success') {
                    var value = FR.jsonDecode(res.responseText);
                    if (value && value.status === 'failed') {
                        FR.showNeededDialog(value.message);
                    }
                }
            }
        }, form);
    };


    var $file = $('input:file', path);
    if ($file.val()) {
        inputChangeFc(path);
    } else {

        $input.val("");
        $input.unbind();
        $input.change(function () {
            inputChangeFc($form);
        });
        $input.click();
    }

};

/**
 * 设置插件的启用状态
 * @para {String} pluginID 插件ID
 * @para {Function} callback 状态改变后的信息
 */
PluginHelper.setPluginActive = PluginHelper.setPluginActive || function (pluginInfo, callback) {
    if (PluginHelper.isWar) {
        FR.Msg.alert(FR.i18nText("FS-Msg_Warning"), FR.i18nText("FS-Web-Error_Cannot_Delete_In_War_Or_Cluster"));
    }
    var processCallback = function (value) {
        if (value && value.progress) {
            callback(value.progress);
        }
        if (value && value.status) {
            if (value.status === 'failed') {
                FR.showNeededDialog(value.message);
                return;
            }
            callback.call(this, value.status);
            if (value.pluginstatus === false) {
                FR.showNeededDialog(FR.i18nText("FR-Plugin_Has_Been_Disabled"));
            } else {
                FR.showNeededDialog(FR.i18nText("FR-Plugin_Has_Been_Actived"));
            }
        }
    };
    var channel = "set_pluginActive_" + pluginInfo;
    PluginHelper.getProgress('modify_status_progress', channel, processCallback);
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=status',
        type: 'POST',
        data: {
            'pluginInfo': pluginInfo,
            'channel': channel
        },
        complete: function (res, status) {
            if (status === 'success') {
                var value = FR.jsonDecode(res.responseText);
                if (value && value.status === "failed") {
                    FR.showNeededDialog(value.message);
                }
            }
        }
    });
};

/**
 * 文件选择器
 * @return {String} 选择的文件的路径
 */
PluginHelper.showFileChooser = PluginHelper.showFileChooser || function () {
};

/**
 * 文件选择器(带过滤器)
 * @param {String} des 描述
 * @param {String} filter 符合条件的文件后缀名
 * @return {String} 选择的文件的路径
 */
PluginHelper.showFileChooserWithFilter = PluginHelper.showFileChooserWithFilter || function (description, filter) {
    return 'local_temp.zip'; //这里返回固定值
};

/**
 * 文件选择器(带过滤器)
 * @param {String} des 描述
 * @param [Array] filter 符合条件的文件后缀名数组
 * @return {String} 选择的文件的路径
 */
PluginHelper.showFileChooserWithFilters = PluginHelper.showFileChooserWithFilters || function (description, filter) {
};


/**
 * 获取已经安装的插件
 * @return {Array} 已安装的插件信息数组
 */
PluginHelper.getInstalledPlugins = PluginHelper.getInstalledPlugins || function () {
    var plugins = [];
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=installed' + '&timestamp=' + new Date().getTime(),
        async: false,
        complete: function (res, status) {
            if (status === 'success') {
                plugins = FR.jsonDecode(res.responseText);
                $.each(plugins, function (i, plugin) {
                    var id = plugin.id, name = plugin.name, version = plugin.version, active = plugin.active;
                    var vendor = plugin.vendor, jartime = plugin.jartime, description = plugin.description;
                    plugin.getID = function () {
                        return id;
                    };
                    plugin.getName = function () {
                        return name;
                    };
                    plugin.getVersion = function () {
                        return version;
                    };
                    plugin.getVendor = function () {
                        return vendor;
                    };
                    plugin.isHidden = function () {
                        return plugin.hidden;
                    };
                    plugin.getRequiredJarTime = function () {
                        return jartime;
                    };
                    plugin.getDescription = function () {
                        return description;
                    };
                    plugin.isActive = function () {
                        return active;
                    };
                    plugin.isLicDamaged = function () {
                        return plugin.is_jar_damaged;
                    };

                    plugin.isAvailable = function () {
                        return plugin.is_available;
                    };

                    plugin.getLeftDays = function () {
                        return plugin.left_time;
                    };

                    plugin.isOnTrial = function () {
                        return plugin.is_trial;
                    };

                    plugin.isFree = function () {
                        return plugin.is_free;
                    };
                });
            }
        }
    });
    return plugins;
};

/**
 * 获取远端的插件信息
 * @return {String} 插件的信息
 */
PluginHelper.getPluginFromStore = PluginHelper.getPluginFromStore || function (pg, cid, type, callback) {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=store',
        type: 'POST',
        data: {
            'categories': pg,
            'cid': cid,
            'type': type
        },
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                callback(result);
            }
        }
    });
};

/**
 * 获取远端的插件信息 新api
 * @return {String} 插件的信息
 */
PluginHelper.getPluginFromStoreNew = PluginHelper.getPluginFromStoreNew || function (classifyInfo, callback) {

    var data = JSON.parse(classifyInfo);

    // 旧接口使用的数据
    data.type = data.fee;
    data.cid = data.seller;

    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=store',
        type: 'POST',
        data: data,
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                callback(result);
            }
        }
    });
};


/**
 * 关闭窗口
 * @type {Function}
 */
PluginHelper.closeWindow = PluginHelper.closeWindow || function () {
};

/**
 * 重启对话框
 * @param {String} 要显示的信息
 */
PluginHelper.showRestartMessage = PluginHelper.showRestartMessage || function (message) {
};

/**
 * 在线搜索
 * @type {Function}
 */
PluginHelper.searchPlugin = PluginHelper.searchPlugin || function (keyword, callback) {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=search_online',
        type: 'POST',
        data: {
            "keyword": keyword
        },
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                callback(result);
            }
        }
    });
};

/**
 * 检查更新
 * @type {Function}
 */
PluginHelper.readUpdateOnline = PluginHelper.readUpdateOnline || function (callback) {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=read_update' + '&timestamp=' + new Date().getTime(),
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                callback(result);
            }
        }
    });
};

/**
 * 检查更新 新窗口打开详情页
 * @type {Function}
 */
PluginHelper.openShopUrlAtWebBrowser = PluginHelper.openShopUrlAtWebBrowser || function (url) {
    window.open(url);
};

/**
 * 在线获取插件分类
 * @type {Function}
 */
PluginHelper.getPluginCategories = PluginHelper.getPluginCategories || function (callback) {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=category' + '&timestamp=' + new Date().getTime(),
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                callback(result);
            }
        }
    });
};

/**
 * 窗口是否无装饰(判断是否使用系统标题栏)
 */
PluginHelper.isCustomTitleBar = PluginHelper.isCustomTitleBar || function () {
};

/**
 * 获取打开动作配置
 */
PluginHelper.getRunConfig = PluginHelper.getRunConfig || function () {
    return "";
};

/**
 * 清除打开动作配置
 */
PluginHelper.clearRunConfig = PluginHelper.clearRunConfig || function () {
};

/**
 * 获取用户登录信息
 * @type {Function}
 */
PluginHelper.getLoginInfo = PluginHelper.getLoginInfo || function (callback) {
    var timestamp = new Date().valueOf();
    var username = "";
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=loginInfo' + "&t=" + timestamp,
        async: false,
        complete: function (res, status) {
            if (status === 'success') {
                var result = FR.jsonDecode(res.responseText);
                var $loginInfo = $('.loginInfo');
                username = result.username;
                if (username === "" || !username) {
                    $loginInfo.text(FR.i18nText('FR-Plugin-Store_Not_Login'));
                } else {
                    $loginInfo.text(username);
                }
                callback(username);
            }

        }
    });
    return username;
};

PluginHelper.registerLoginInfo = PluginHelper.registerLoginInfo || function (callback) {
    var timestamp = new Date().valueOf();
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=loginInfo' + "&t=" + timestamp,
        complete: function (res, status) {
            if (status === 'success') {
                var result = FR.jsonDecode(res.responseText);
                var $loginInfo = $('.loginInfo');
                var username = result.username;
                if (username === "" || !username) {
                    $loginInfo.text(FR.i18nText('FR-Plugin-Store_Not_Login'));
                } else {
                    $loginInfo.text(username);
                }
                callback(username);
            }
        }
    });
};

/**
 * 弹出登录窗口
 * @type {*|Function}
 */
PluginHelper.loginContent = PluginHelper.loginContent || function () {
};

/**
 * 弹出私人消息窗口
 * @type {Function}
 */
PluginHelper.getPriviteMessage = PluginHelper.getPriviteMessage || function () {
    window.open("http://bbs.fanruan.com/home.php?mod=space&do=pm");
};


/*-------------------------------登录部分的处理----------------------------------*/


/**
 * 注册的跳转
 * @type {Function}
 */
PluginHelper.registerHref = PluginHelper.registerHref || function () {
    window.open("http://id.fanruan.com/register/register.php?clueSource=activityfr");
};

/**
 * 忘记密码的跳转
 * @type {Function}
 */
PluginHelper.forgetHref = PluginHelper.forgetHref || function () {
    window.open("http://id.fanruan.com/forget/forget.php?clue=activityf");
};

/**
 * 获取插件信息前缀
 * @type {Function}
 */
PluginHelper.getPluginPrefix = PluginHelper.getPluginPrefix || function (callback) {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=plugin_url_prefix' + '&timestamp=' + new Date().getTime(),
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                callback(result);
            }
        }
    });
};

/**
 * 默认论坛账号登录
 * @type {Function}
 */
PluginHelper.defaultLogin = PluginHelper.defaultLogin || function (userInfo, password, callback) {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=defaultLogin',
        type: 'POST',
        data: {
            username: encodeURIComponent(encodeURIComponent(userInfo)),
            password: encodeURIComponent(encodeURIComponent(password))
        },
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                if ($.isFunction(callback)) {
                    var decodeResult = Store.Tool.jsonDecode(result);
                    var loginTag = decodeResult[0].loginTag;
                    var uid = decodeResult[0].uid;
                    var username = decodeResult[0].username;
                    loginTag = parseInt(loginTag, 10);
                    callback(loginTag);
                    if (loginTag === 0) {
                        $('.loginInfo').text(username);
                        Store.Login.LoginUser = username;
                        PluginHelper.ucsynLogin(uid, username, '', function (result) {
                            $('.sync-log').remove();
                            $('body').append('<div class="sync-log">' + result + '</div>');
                        });
                    }
                }
            }
        }
    });
};


PluginHelper.ucsynLogin = PluginHelper.ucsynLogin || function (uid, username, password, callback) {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=ucsyn',
        data: {uid: encodeURI(uid), username: encodeURI(username), password: encodeURI(password)},
        complete: function (res, status) {
            if (status === 'success') {
                var result = res.responseText;
                callback(result);
            }
        }
    });
};

/**
 * 展示qq登录窗口
 * @type {Function}
 */
PluginHelper.showQQ = PluginHelper.showQQ || function () {
};

/**
 * 清除用户信息
 * @type {Function}
 */
PluginHelper.clearUserInfo = PluginHelper.clearUserInfo || function () {
    FR.ajax({
        url: FR.servletURL + '?op=plugin&cmd=clearInfo' + '&timestamp=' + new Date().getTime(),
        complete: function (res, status) {
            if (status === 'success') {
                Store.Login.LoginUser = "";
            }
        }
    });
};


/**
 * 初始化一些其他不同的界面显示
 */
PluginHelper.initExtraDiff = PluginHelper.initExtraDiff || function () {
    //登录框
    this.createLoginStatusPane();
    if (!PluginHelper.isDesigner()) {
        $("#install-plugin-from-disk").css("padding", "0px");
        $("#update-plugin-from-disk").css("padding", "0px");
    }
};

/**
 * 创建登录状态pane
 */
PluginHelper.createLoginStatusPane = function () {
    var $panel_head = $('#app-shop-header');
    var $div = $('<div class="login"></div>');
    var $button = $('<Button class="loginInfo" type="button"></Button>');
    $div.append($button);
    $panel_head.append($div);

    var $panel_body = $("#panel-body");
    var $login_btn = $('<div class="loginBtn"></div>');
    var $bbsMsg = $('<Button class="bbs-msg" type="button"></Button>');
    var $loginIn = $('<Button class="loginIn" type="button"></Button>');
    $login_btn.append($bbsMsg);
    $login_btn.append($loginIn);
    $panel_body.append($login_btn);
};


/**
 * 创建文件选择框
 */
PluginHelper.createFileChooser = function (formId, inputId) {
    //文件选择框
    var $form = $("<form>");
    $form.attr({
        "style": "display : none",
        "id": formId,
        "enctype": "multipart/form-data",
        "method": "post"
    });
    var $input = $("<input>");
    $input.attr({
        "id": inputId,
        "name": inputId,
        "type": "file",
        "accept": "application/zip"
    });
    $("body").append($form);
    $form.append($input);
};

/**
 * 国际化解析
 */
PluginHelper.parseI18 = PluginHelper.parseI18 || function (key) {
    return FR.i18nText(key);
};


/**
 * 区分设计器端和FS端
 */
PluginHelper.isDesigner = PluginHelper.isDesigner || function () {
    return false;
};






/**
 * Created by vito on 16/3/25.
 * 插件商店操作类
 */
(function ($) {
    if (window.Store == null) {
        window.Store = {};
    }


    /**
     * 标题栏
     */
    Store.TitleBar = {
        init: function () {
            if (!PluginHelper.isDesigner()) {
                return;
            }
            try {
                var $div = $('<div class = title-bar></div>');
                $div.append($('<div class="dialog-title"></div>'));
                $div.append($('<div class="dialog-close"></div>'));
                $("body").prepend($div);
                var isCustomTitleBar = PluginHelper.isCustomTitleBar();
                if (isCustomTitleBar) {
                    $('.dialog-title').text(PluginHelper.parseI18("FR-Designer-Plugin_Manager"));
                    this.closeDialog();
                } else {
                    $('.title-bar').remove();
                    $('.mainView,.sideView').addClass('old-tab-padding');
                    $('.mainView .panel-heading, .sideView .panel-heading').addClass('old-panel-heading');
                }

            } catch (e) {//没有这个api的去掉标题栏
                $('.title-bar').remove();
                $('.mainView,.sideView').addClass('old-tab-padding');
                $('.panel-heading').addClass('old-panel-heading');
            }
        },
        closeDialog: function () {
            $('.dialog-close').bind('click', function () {
                PluginHelper.closeWindow();
            });
        }
    };

    Store.Plugin = {
        /**
         * 插件基本操作回调函数
         */
        defaultCallback: function (value) {
            if (value.indexOf('%') != -1) {
                Store.Progress.setProgress(value);
            } else {
                if (value.indexOf('success') != -1) {
                    Store.Progress.setProgress("100%");
                    window.setTimeout(function () {
                        Store.Progress.removeProress();
                    }, 500);
                }
                if (value.indexOf('failed') != -1) {
                    Store.Progress.setProgress("100%");
                    window.setTimeout(function () {
                        Store.Progress.removeProress();
                    }, 500);
                }
                Store.Installed.showInstalledPlugin();
                Store.Installed.checkUpdate();
            }
        }
    };

    /**
     * 商品分类显示
     * @type {{type: string, classifyInfo: {}, component: string, selectPlugin: {}, init: Store.Nav.init, getCategories: Store.Nav.getCategories, get_plugins_online: Store.Nav.get_plugins_online, isConnected: Store.Nav.isConnected, setNavBarListener: Store.Nav.setNavBarListener, setTagBarListener: Store.Nav.setTagBarListener, setSelectPluginListener: Store.Nav.setSelectPluginListener, setInstallFromDiskBtnListener: Store.Nav.setInstallFromDiskBtnListener, setInstallOnlineBtnListener: Store.Nav.setInstallOnlineBtnListener, setSearchOnlineBtnListener: Store.Nav.setSearchOnlineBtnListener, removeSearchTag: Store.Nav.removeSearchTag, setPluginMoreInfo: Store.Nav.setPluginMoreInfo}}
     */
    Store.Nav = {

        type: 'online',

        classifyInfo: {},

        component: '',

        selectPlugin: {},

        clock: '',

        showOnlinePluginCount: PluginHelper.isDesigner() ? 4 : 5,

        init: function (component) {
            //建立分类记录
            this.classifyInfo = new Store.ClassifyInfo();
            this.component = component;
            this.getCategories();
            this.setNavBarListener();
            this.setTagBarListener();
            this.setInstallFromDiskBtnListener();
            this.setSearchOnlineBtnListener();
            this.runWithConfig();
            this.setSelectPluginListener();
            this.setInstallOnlineBtnListener();
        },


        runWithConfig: function () {
            try {
                var config = Store.Tool.jsonDecode(PluginHelper.getRunConfig());
                switch (config.action) {
                    case Store.RUNACTION.SEARCH:
                        if (config.keyword && config.keyword != '') {
                            this.fetchSearch(config.keyword);
                            PluginHelper.clearRunConfig();
                        } else {
                            this.get_plugins_online();
                        }
                        break;
                    case Store.RUNACTION.SHOW_RESULT:
                        if (config.pluginInfo && config.pluginInfo != '') {
                            this.showPluginResult(config.keyword, config.pluginInfo);
                            PluginHelper.clearRunConfig();
                        } else {
                            this.get_plugins_online();
                        }
                        break;
                    default:
                        this.get_plugins_online();
                }
            } catch (e) {
                this.get_plugins_online();
            }
        },
        /**
         * 获取插件的分类
         *
         */
        getCategories: function () {
            try {
                PluginHelper.getPluginCategories(function (result) {
                    var categories = Store.Tool.jsonDecode(result);
                    Store.Render.showCategories({
                        renderEl: $('.nav-group'),
                        removeEl: $('.nav-category'),
                        categories: categories
                    });
                    Store.Nav.setNavBarListener();
                });
            } catch (e) {//catch为了兼容没有升级jar,以后会去掉
            }
        },

        /**
         * 插件页面用于获取上架插件信息并用于显示
         */
        get_plugins_online: function () {
            this.showTransition();
            var self = this;
            var callback = function (result) {
                //vito:这个webview的js环境逗比到不能解析that,只能使用Store.Nav.xx,也是无话可说。。
                Store.Nav.hideTransition();
                if (!Store.Nav.isConnected(result)) {
                    return;
                }
                var pluginInfo = Store.Tool.jsonDecode(result);
                Store.Nav.component.html('');
                if (pluginInfo && pluginInfo.length != 0 && $.isArray(pluginInfo) && Store.Nav.component) {
                    Store.Render.window_show(pluginInfo, Store.Nav.component, Store.Nav.showOnlinePluginCount, Store.Nav.type);
                    Store.Nav.setClearSelectedListener();
                }
                Store.Nav.clearSelected();
            };
            if (PluginHelper.isDesigner() === true && PluginHelper.getPluginFromStoreNew === undefined) {
                PluginHelper.getPluginFromStore(self.classifyInfo.categories, self.classifyInfo.seller, self.classifyInfo.fee, callback);
            } else {
                PluginHelper.getPluginFromStoreNew(JSON.stringify(self.classifyInfo), callback);
            }
        },

        /**
         * 根据返回值判断网络状态
         * @param result 请求返回值
         */
        isConnected: function (result) {
            if (result && result.indexOf('[') == -1 || result == '404' || result == -1) {
                $('.product-info-panel-body').html('<div class="disconnected"></div><div class="oops">' + PluginHelper.parseI18("FR-Plugin-Store_Disconnected") + '</div>');
                return false;
            }
            return true;
        },

        /**
         * 插件分类栏监听
         */
        setNavBarListener: function () {
            var that = this;
            $('.nav-seller').unbind("click");
            $('.nav-fee').unbind("click");
            $('.nav-scope').unbind("click");
            $('.nav-category').unbind("click");
            //初始化监听器
            $('.nav-seller').click(function (e) {
                if (e.target && e.target.nodeName.toUpperCase() == 'A') {
                    that.removeSearchTag();
                    that.classifyInfo.clearSeller();
                    $('.tags').append('<div class="status-item pull-left" id="' + e.target.id + '-tag">' + e.target.text + '<div class="tag-close"></div></div>');
                    that.classifyInfo.seller = e.target.id;
                    $(e.target).addClass('selected-item');
                    that.get_plugins_online();
                }
                return false;
            });
            $('.nav-fee').click(function (e) {
                if (e.target && e.target.nodeName.toUpperCase() == 'A') {
                    that.removeSearchTag();
                    that.classifyInfo.clearFee();
                    $('.tags').append('<div class="status-item pull-left" id="' + e.target.id + '-tag">' + e.target.text + '<div class="tag-close"></div></div>');
                    that.classifyInfo.fee = e.target.id;
                    $(e.target).addClass('selected-item');
                    that.get_plugins_online();
                }
                return false;
            });
            $('.nav-scope').click(function (e) {
                if (e.target && e.target.nodeName.toUpperCase() == 'A') {
                    that.removeSearchTag();
                    that.classifyInfo.clearScope();
                    $('.tags').append('<div class="status-item pull-left" id="' + e.target.id + '-tag">' + e.target.text + '<div class="tag-close"></div></div>');
                    that.classifyInfo.scope = e.target.id;
                    $(e.target).addClass('selected-item');
                    that.get_plugins_online();
                }
                return false;
            });
            $('.nav-category').click(function (e) {
                if (e.target && e.target.nodeName.toUpperCase() == 'A') {
                    that.removeSearchTag();
                    that.classifyInfo.clearCategory();
                    $('.tags').append('<div class="status-item pull-left" id="' + e.target.id + '-tag">' + e.target.text + '<div class="tag-close"></div></div>');
                    that.classifyInfo.categories = e.target.id;
                    $(e.target).addClass('selected-item');
                    that.get_plugins_online();
                }
                return false;
            });
        },

        /**
         * 已选择标签监听
         */
        setTagBarListener: function () {
            var that = this;
            $('.tags').click(function (e) {
                if (e.target && e.target.className == 'tag-close') {
                    $(e.target.parentNode).remove();
                    var navClassName = e.target.parentNode.id.split('-')[0];
                    switch (navClassName) {
                        case 'seller':
                            $('#' + that.classifyInfo.seller).removeClass('selected-item');
                            that.classifyInfo.seller = '';
                            break;
                        case 'fee':
                            $('#' + that.classifyInfo.fee).removeClass('selected-item');
                            that.classifyInfo.fee = '';
                            break;
                        case 'scope':
                            $('#' + that.classifyInfo.scope).removeClass('selected-item');
                            that.classifyInfo.scope = '';
                            break;
                        case 'category':
                            $('#' + that.classifyInfo.categories).removeClass('selected-item');
                            that.classifyInfo.categories = '';
                            break;
                    }
                    if (that.classifyInfo.isEmpty()) {
                        $('<div class="recommend-item pull-left" id="recommend-tag"></div>').text(PluginHelper.parseI18("FR-Plugin-Store_Recommend")).appendTo($('.tags'));
                    }
                    that.get_plugins_online();
                }
                return false;
            });
        },

        /**
         * 点击选中插件监听
         */
        setSelectPluginListener: function () {
            var that = this;
            this.component.click(function (e) {
                var id;
                var installBtn = $('#install-plugin-btn');
                if (e.target.offsetParent.className.indexOf('thumbnail') != -1) {
                    id = e.target.offsetParent.id;
                } else if (e.target.className.indexOf('thumbnail') != -1) {
                    id = e.target.id;
                } else {
                    that.clearSelected();
                    installBtn.attr('disabled', 'disabled');
                    return false;
                }
                if (that.selectPlugin.id && id == that.selectPlugin.id) {
                    that.clearSelected();
                    return false;
                }
                that.clearSelected();
                var currentPlugin = $('#' + id);
                currentPlugin.append('<div class="fr-thumbnail-marked"></div>');
                currentPlugin.addClass('fr-thumbnail-selected-border');
                that.selectPlugin.pluginid = currentPlugin.data('pluginid');
                that.selectPlugin.version = currentPlugin.data('version');
                that.selectPlugin.id = id;
                installBtn.removeAttr('disabled');
                return false;
            });
        },

        /**
         * 清除选中和按钮状态
         */
        clearSelected: function () {
            var installBtn = $('#install-plugin-btn');
            if (this.selectPlugin && this.selectPlugin.id) {
                $('#' + this.selectPlugin.id).removeClass('fr-thumbnail-selected-border');
                $('#' + this.selectPlugin.id + ' .fr-thumbnail-marked').remove();
                this.selectPlugin = {};
                installBtn.attr('disabled', 'disabled');
            }
        },

        /**
         * 安装按钮监听
         */
        setInstallFromDiskBtnListener: function () {
            var $localBtn = $('#install-plugin-from-disk');
            $localBtn.bind('click', function () {
                var path = PluginHelper.showFileChooserWithFilter(PluginHelper.parseI18("FR-Plugin-Install_Package") + "(*.zip)", "*.zip");
                if (!path) {
                    return false;
                }
                PluginHelper.installPluginFromDisk(path, function (value) {
                    Store.Plugin.defaultCallback(value);
                });
            });

            return false;
        },

        /**
         * 在线安装按钮监听
         */
        setInstallOnlineBtnListener: function () {
            var $localBtn = $('#install-plugin-btn');
            var that = this;
            var env = true;//是否需要检测环境
            $localBtn.bind('click', function () {
                //下载更新前先校验登录
                try {
                    var pluginId = Store.Nav.selectPlugin.pluginid;
                    var pluginVersion = Store.Nav.selectPlugin.version;
                    if (Store.Login.getLoginInfo() == '') {
                        var clock = Store.Nav.clock;
                        window.clearInterval(Number(clock));
                        var inter = window.setInterval(function () {
                            Store.Nav.info(pluginId, pluginVersion);
                        }, 1000);
                        Store.Nav.clock = inter;
                        Store.Nav.showLoginDlg();
                    } else {
                        Store.Progress.showProgress();
                        PluginHelper.installPluginOnline(pluginId + "_" + pluginVersion, function (value) {
                            Store.Plugin.defaultCallback(value);
                        });
                    }
                } catch (e) {
                    alert(e.message);
                }

            });
        },

        info: function (pluginId, version) {
            var res = Store.Login.LoginUser;
            if (res != '') {
                var clock = Store.Nav.clock;
                window.clearInterval(Number(clock));
                Store.Progress.showProgress();
                PluginHelper.installPluginOnline(pluginId + "_" + version, function (value) {
                    Store.Plugin.defaultCallback(value);
                });
            }
        },

        /**
         * 在线搜索监听
         */
        setSearchOnlineBtnListener: function () {
            var search = $('.fr-search-query-online');
            var that = this;
            search.bind('keydown', function (e) {//回车不显示
                if (e && e.keyCode == 13) {
                    return false;
                }
            });
            search.bind('click', function () {
                if (search.text().trim().indexOf(PluginHelper.parseI18("FR-Plugin-Store_Commodity_Description")) != -1) {
                    search.text('');
                    search.focus();
                }
                return false;
            });
            search.bind('blur', function () {
                if (search.text().trim() === '') {
                    search.text(PluginHelper.parseI18("FR-Plugin-Store_Commodity_Description"));
                }
            });
            search.bind('keyup', function (e) {
                if (e && e.keyCode == 13) {
                    that.fetchSearch(search.text().trim());
                }
            });
        },

        fetchSearch: function (keyword) {
            if (!keyword || keyword == '') {
                return;
            }
            this.classifyInfo.clear();
            this.removeSearchTag();
            $('.tags').append('<div class="status-item pull-left search-tag">' + PluginHelper.parseI18("FR-Plugin-Store_Key_Word") + ':' + keyword + '<div class="tag-close"></div></div>');
            this.showTransition();
            PluginHelper.searchPlugin(encodeURI(keyword), function (value) {
                Store.Nav.hideTransition();
                if (!Store.Nav.isConnected(value)) {
                    return false;
                }
                var pluginInfo = Store.Tool.jsonDecode(value);
                Store.Nav.component.html('');
                if (pluginInfo && pluginInfo.length != 0) {
                    Store.Render.window_show(pluginInfo, Store.Nav.component, Store.Nav.showOnlinePluginCount, Store.Nav.type);
                }
            });
        },

        /**
         * 根据插件信息从设计器跳转过来时展示对应插件，同时默认选中第一项
         * @param keyword 搜索关键字
         * @param data 设计器传过来的插件信息
         */
        showPluginResult: function (keyword, data) {
            this.classifyInfo.clear();
            this.removeSearchTag();
            Store.Nav.hideTransition();
            if (keyword && keyword != '') {
                $('.tags').append('<div class="status-item pull-left search-tag">' + PluginHelper.parseI18("FR-Plugin-Store_Key_Word") + ':' + keyword + '<div class="tag-close"></div></div>');
            }
            var pluginInfo = Store.Tool.jsonDecode(data);
            Store.Nav.component.html('');
            if (pluginInfo && pluginInfo.length != 0) {
                Store.Render.window_show(pluginInfo, Store.Nav.component, Store.Nav.showOnlinePluginCount, Store.Nav.type);
                setTimeout(function () {
                    $('#' + pluginInfo[0].id).click();
                }, 200);
            }

        },

        removeSearchTag: function () {
            var $searchTag = $('.search-tag');
            if ($searchTag) {
                $searchTag.remove();
            }
        },

        setPluginMoreInfo: function () {
            var $moreInfo = $('.moreInfo');
            $moreInfo.off('click').on('click', function (e) {
                var url = $(e.target).data("url");
                PluginHelper.openShopUrlAtWebBrowser(url);
                return false;
            });
        },

        /**
         * 点击安装面板,清除所有选择
         */
        setClearSelectedListener: function () {
            var that = this;
            var $mainView = $('.mainView .panel-body');
            $mainView.bind('click', function () {
                that.clearSelected();
                return false;
            });
        },

        showTransition: function () {
            $('.transition').show();
            $('.product-row').addClass('blur-loading');
        },

        hideTransition: function () {
            $('.transition').hide();
            $('.product-row').removeClass('blur-loading');
        },

        showLoginDlg: function () {
            $('.login-dlg').css('display', 'block');
        }
    };

    /**
     * 已安装面板
     * @type {{type: string, component: string, installedPlugin: Array, selectPlugin: Array, init: Store.Installed.init, get_plugins_local: Store.Installed.get_plugins_local, showInstalledPlugin: Store.Installed.showInstalledPlugin, setBtnStates: Store.Installed.setBtnStates, setSelectPluginListener: Store.Installed.setSelectPluginListener, setDisableBtnListener: Store.Installed.setDisableBtnListener, setUninstallBtnListener: Store.Installed.setUninstallBtnListener, setUpdateFromDisk: Store.Installed.setUpdateFromDisk, setUpdateAllBtnListener: Store.Installed.setUpdateAllBtnListener, setSearchLocalBtnListener: Store.Installed.setSearchLocalBtnListener}}
     */
    Store.Installed = {

        type: 'local',

        component: '',

        installedPlugin: [],

        selectPlugin: {},

        availableUpdate: [],

        clock: '',

        showInstalledPluginCount: PluginHelper.isDesigner() ? 2 : 3,

        init: function (component) {
            this.component = component;
            this.showInstalledPlugin();
            this.checkUpdate();
            this.setSelectPluginListener();
            this.setDisableBtnListener();
            this.setUninstallBtnListener();
            this.setUpdateFromDisk();
            this.setUpdateAllBtnListener();
            this.setSearchLocalBtnListener();
            this.setBtnStates();
        },

        /**
         * 插件页面用于获取本地插件信息并用于显示
         */
        get_plugins_local: function () {
            this.installedPlugin = [];
            var plugins = PluginHelper.getInstalledPlugins();
            var that = this;
            if (plugins) {
                $.each(plugins, function (i, plugin) {
                    var pluginInfo = {};
                    pluginInfo.id = plugin.getID();
                    pluginInfo.name = plugin.getName();
                    pluginInfo.version = plugin.getVersion();
                    pluginInfo.vendor = plugin.getVendor();
                    pluginInfo.active = plugin.isActive();
                    pluginInfo.hidden = plugin.isHidden();
                    pluginInfo.jartime = plugin.getRequiredJarTime();
                    pluginInfo.description = plugin.getDescription();
                    pluginInfo.is_jar_damaged = plugin.isLicDamaged();
                    pluginInfo.is_available = plugin.isAvailable();
                    pluginInfo.left_time = plugin.getLeftDays();
                    pluginInfo.is_trial = plugin.isOnTrial();
                    pluginInfo.is_free = plugin.isFree();
                    that.installedPlugin.push(pluginInfo);
                });
            }
        },

        /**
         * 展示安装的插件
         */
        showInstalledPlugin: function () {
            this.get_plugins_local();
            if (this.component) {
                this.component.html('');
                var pluginsToShow = this.filterHidePlugins();
                $('.installed-count').html(PluginHelper.parseI18('FR-Plugin-Store_Installed') + pluginsToShow.length + PluginHelper.parseI18('FR-Plugin-Store_Plugins_Count'));

                //todo 这边可能需要判断容器确定每行展示插件数
                Store.Render.window_show(pluginsToShow, this.component, Store.Installed.showInstalledPluginCount, this.type);
                this.setClearSelectedListener();
            }
        },

        /**
         * 展示安装的插件(过滤隐藏的插件)
         */
        filterHidePlugins: function () {
            var plugins = [];
            for (var i = 0; i < this.installedPlugin.length; i++) {
                if (!this.installedPlugin[i].hidden) {
                    plugins.push(this.installedPlugin[i]);
                }
            }
            return plugins;
        },

        /**
         * 按键状态
         */
        setBtnStates: function () {
            var $disableBtn = $('#disable-plugin-btn');
            var $deleteBtn = $('#delete-plugin-btn');
            var $updateAllBtn = $('#update-all-plugin-btn');
            if (this.selectPlugin && this.selectPlugin.id) {
                $deleteBtn.removeAttr('disabled');
                if (this.selectPlugin.active) {
                    $disableBtn.text(PluginHelper.parseI18('FR-Plugin-Store_Disabled'));
                } else {
                    $disableBtn.text(PluginHelper.parseI18('FR-Plugin-Store_Enable'));
                }
                $disableBtn.removeAttr('disabled');
                $updateAllBtn.text(PluginHelper.parseI18('FR-Plugin-Store_Update'));
                for (var i = 0; i < this.availableUpdate.length; i++) {
                    if (this.availableUpdate[i].id == this.selectPlugin.id) {
                        $updateAllBtn.removeAttr('disabled');
                        return;
                    }
                }
                $updateAllBtn.attr('disabled', 'disabled');
            } else {
                if (this.availableUpdate.length == 0) {
                    $updateAllBtn.attr('disabled', 'disabled');
                } else {
                    $updateAllBtn.removeAttr('disabled');
                }
                $updateAllBtn.text(PluginHelper.parseI18('FR-Plugin-Store_Update-ALL'));
                $disableBtn.attr('disabled', 'disabled');
                $deleteBtn.attr('disabled', 'disabled');
            }
        },

        /**
         * 选择插件监听
         */
        setSelectPluginListener: function () {
            var that = this;
            this.component.click(function (e) {
                var id;
                if (e.target.offsetParent.className.indexOf('thumbnail') != -1) {
                    id = e.target.offsetParent.id;
                } else if (e.target.className.indexOf('thumbnail') != -1) {
                    id = e.target.id;
                } else {
                    that.clearSelected();
                    that.setBtnStates();
                    return false;
                }
                if (id.replace(/-/g, '.') == that.selectPlugin.id) {
                    that.clearSelected();
                    return false;
                }
                that.clearSelected();
                var currentPlugin = $('#' + id);
                currentPlugin.append('<div class="fr-thumbnail-marked"></div>');
                currentPlugin.addClass('fr-thumbnail-selected-border');
                for (var i = 0; i < that.installedPlugin.length; i++) {
                    if (id.replace(/-/g, '.') == that.installedPlugin[i].id) {
                        that.selectPlugin = that.installedPlugin[i];
                        break;
                    }
                }
                that.setBtnStates();
                return false;
            })
        },

        /**
         * 清除选中和按钮状态
         */
        clearSelected: function () {
            if (this.selectPlugin && this.selectPlugin.id) {
                $('#' + this.selectPlugin.id.replace(/\./g, '-')).removeClass('fr-thumbnail-selected-border');
                $('#' + this.selectPlugin.id.replace(/\./g, '-') + ' .fr-thumbnail-marked').remove();
                this.selectPlugin = {};
                this.setBtnStates();
            }
        },

        /**
         * 清除选中状态监听
         */
        setClearSelectedListener: function () {
            var $sideView = $('.sideView .panel-body');
            var that = this;
            $sideView.bind('click', function () {
                that.clearSelected();
                return false;
            });
        },

        /**
         * 插件禁用启用监听
         */
        setDisableBtnListener: function () {
            var that = this;
            var $disableBtn = $('#disable-plugin-btn');
            $disableBtn.bind('click', function () {
                PluginHelper.setPluginActive(that.selectPlugin.id + "_" + that.selectPlugin.version, function () {
                    for (var i = 0; i < Store.Installed.installedPlugin.length; i++) {
                        if (Store.Installed.selectPlugin.id == Store.Installed.installedPlugin[i].id) {
                            Store.Installed.installedPlugin[i].active = !Store.Installed.installedPlugin[i].active;
                            Store.Installed.selectPlugin.active = Store.Installed.installedPlugin[i].active;
                            break;
                        }
                    }

                    Store.Installed.showInstalledPlugin();
                    Store.Installed.checkUpdate();

                });
                return false;
            });
        },

        /**
         * 卸载按钮监听
         */
        setUninstallBtnListener: function () {
            var that = this;
            var $uninstallBtn = $('#delete-plugin-btn');
            $uninstallBtn.bind('click', function () {
                var pluginInfo = that.selectPlugin.id + "_" + that.selectPlugin.version;
                PluginHelper.uninstallPlugin(pluginInfo, false, function () {
                    Store.Installed.showInstalledPlugin();
                    Store.Installed.checkUpdate();
                });
                return false;
            })
        },

        /**
         * 从硬盘升级
         */
        setUpdateFromDisk: function () {
            var $updateFromDisk = $('#update-plugin-from-disk');
            $updateFromDisk.bind('click', function () {
                var path = PluginHelper.showFileChooserWithFilter(PluginHelper.parseI18("FR-Plugin-Install_Package") + "(*.zip)", "*.zip");
                if (!path) {
                    return false;
                }
                PluginHelper.updatePluginFromDisk(path, function (value) {
                    Store.Plugin.defaultCallback(value);
                });
            });

            return false;
        },

        /**
         * 升级所有选择插件监听
         */
        setUpdateAllBtnListener: function () {
            var that = this;
            var $updateAllBtn = $('#update-all-plugin-btn');
            $updateAllBtn.bind('click', function () {
                //下载更新前先校验登录
                Store.Login.getLoginInfo();
                var pluginInfo = [];
                var waitToUpdate = [];
                if (Store.Installed.selectPlugin && Store.Installed.selectPlugin.id) {
                    waitToUpdate.push(that.selectPlugin);
                } else {
                    waitToUpdate = Store.Installed.availableUpdate;
                }
                for (var i = 0; i < waitToUpdate.length; i++) {
                    pluginInfo.push(waitToUpdate[i].id + "_" + waitToUpdate[i].version);
                }
                //这边获取用户名信息
                if (Store.Login.LoginUser == '') {
                    var clock = Store.Installed.clock;
                    window.clearInterval(Number(clock));
                    var inter = window.setInterval(function () {
                        Store.Installed.info(pluginInfo);
                    }, 1000);
                    Store.Installed.clock = inter;
                    Store.Nav.showLoginDlg();
                } else {
                    Store.Progress.showProgress();
                    PluginHelper.updatePluginOnline(pluginInfo, function (value) {
                        Store.Plugin.defaultCallback(value);
                    });
                }
                // return false;

            })
        },

        //这边也要改
        info: function (pluginIDs) {
            var res = Store.Login.LoginUser;
            if (res != '') {
                var clock = Store.Installed.clock;
                window.clearInterval(Number(clock));
                Store.Progress.showProgress();
                PluginHelper.updatePluginOnline(pluginIDs, function (value) {
                    Store.Plugin.defaultCallback(value);
                });
            }
        },

        /**
         * 本地搜索插件
         */
        setSearchLocalBtnListener: function () {
            var search = $('.fr-search-query-local');
            var that = this;
            search.bind('keydown', function (e) {
                if (e && e.keyCode == 13) {//回车不显示
                    return false;
                }
            });
            search.bind('click', function () {
                if (search.text().trim().indexOf(PluginHelper.parseI18("FR-Plugin-Store_Commodity_Description")) != -1) {
                    search.text('');
                    search.focus();
                }
                return false;
            });
            search.bind('blur', function () {
                if (search.text().trim() == '') {
                    search.text(PluginHelper.parseI18("FR-Plugin-Store_Commodity_Description"));
                }
            });
            search.bind('keyup', function (e) {
                that.selectPlugin = {};
                that.setBtnStates();
                var keyword = search.text().trim();
                if (e && e.keyCode == 13) {
                    var searchResult = [];
                    for (var i = 0; i < that.installedPlugin.length; i++) {
                        if (that.installedPlugin[i].name.toUpperCase().indexOf(keyword.toUpperCase()) != -1
                            || keyword == that.installedPlugin[i].version
                            || (that.installedPlugin[i].description ? that.installedPlugin[i].description.toUpperCase().indexOf(keyword.toUpperCase()) != -1 : false)) {
                            searchResult.push(that.installedPlugin[i]);
                        }
                    }
                    Store.Render.window_show(searchResult, that.component, Store.Installed.showInstalledPluginCount, that.type);
                }
                if (e && e.keyCode == 8 || e.keyCode == 46) {
                    if (keyword == '') {
                        Store.Render.window_show(that.installedPlugin, that.component, Store.Installed.showInstalledPluginCount, that.type);
                    }
                }
            });
        },

        /**
         * 根据插件id获取已经安装的插件信息
         */
        findInstalledPluginByID: function (pluginID) {
            var plugins = Store.Installed.installedPlugin;
            for (var i = 0; i < plugins.length; i++) {
                if (plugins[i].id === pluginID) {
                    return plugins[i].id + "_" + plugins[i].version;
                }
            }

        },

        /**
         * 检查更新
         */
        checkUpdate: function () {
            Store.Installed.availableUpdate = [];
            PluginHelper.readUpdateOnline(function (value) {
                var plugin = Store.Tool.jsonDecode(value);
                if (plugin) {
                    for (var i = 0; i < Store.Installed.installedPlugin.length; i++) {
                        for (var j = 0; j < plugin.length; j++) {
                            if (Store.Installed.installedPlugin[i].id == plugin[j].pluginid) {
                                Store.Installed.installedPlugin[i].hasUpdate = true;
                                Store.Installed.availableUpdate.push(Store.Installed.installedPlugin[i]);
                            }
                        }
                    }
                    var plugins = Store.Installed.filterHidePlugins();
                    Store.Render.window_show(plugins, Store.Installed.component, Store.Installed.showInstalledPluginCount, Store.Installed.type);
                    if (Store.Installed.selectPlugin.id) {
                        var id = isNaN(Store.Installed.selectPlugin.id) ? Store.Installed.selectPlugin.id.replace(/\./g, '-') : Store.Installed.selectPlugin.id;
                        var currentPlugin = $('#' + id);
                        currentPlugin.append('<div class="fr-thumbnail-marked"></div>');
                        currentPlugin.addClass('fr-thumbnail-selected-border');
                    }
                    Store.Installed.setBtnStates();
                }
            });
        }
    };

    /**
     * 进度条
     * @type {{$process: (*|HTMLElement), showProgress: Store.Progress.showProgress, setProgress: Store.Progress.setProgress, removeProress: Store.Progress.removeProress}}
     */
    Store.Progress = {
        $process: $('<div class="fr-progress pull-left"><div class="fr-progress-bar"></div></div>'),

        /**
         * 展示进度条
         */
        showProgress: function () {
            this.$process.appendTo($('.install-btn-group'));
        },

        /**
         * 设置进度条
         * @param value {string} 百分比
         */
        setProgress: function (value) {
            $('.fr-progress .fr-progress-bar').css('width', value);
        },

        /**
         * 移除进度条
         */
        removeProress: function () {
            this.$process.remove();
            this.$process.children(".fr-progress-bar").css('width', 0)
        }
    };


    /**
     * 渲染
     * @type {{window_show: Store.Render.window_show, showInDetail: Store.Render.showInDetail}}
     */
    Store.Render = {
        SHOP_PRODUCT: "",

        getUrlPrefix: function () {
            var that = this;
            PluginHelper.getPluginPrefix(function (result) {
                Store.Render.SHOP_PRODUCT = result;
            });
        },
        /**
         * 显示分类标签
         *
         * @cfg {JSON}      options 配置属性
         * @cfg {jquery}    options.renderEl 要显示在该jquery对象下
         * @cfg {jquery}    [options.removeEl] 要删除的内容
         * @cfg {JSON}      options.categories 分类信息
         */
        showCategories: function (options) {
            var renderEl = $(options.renderEl);
            var categories = options.categories;
            var row = [];
            if (categories && categories != []) {
                if (options.removeEl) {//判断需不需要清除原来的内容
                    $(options.removeEl).remove();
                }
                var currentRow;
                for (var i = 0; i < categories.length; i++) {
                    if (i === 0) {
                        row[row.length] = $('<div class="row last-row nav-category"></div>').appendTo(renderEl);
                        $('<div class="items-head" id="items-head-class"></div>')
                            .text("类别")
                            .appendTo(row[i]);
                        var itemsBody = $('<div class="items-body"></div>').appendTo(row[i]);
                        currentRow = $('<div class="items extra-items category-items"></div>').appendTo(itemsBody);
                    } else if (i % 8 == 0) {
                        row[row.length] = $('<div class="row nav-category"></div>').appendTo(renderEl);
                        var itemsBodyEx = $('<div class="items-body"></div>').appendTo(row[row.length - 1]);
                        currentRow = $('<div class="items category-items"></div>').appendTo(itemsBodyEx);
                    }
                    $('<a href="#" class="item" id="category-' + categories[i].id + '">' + categories[i].name + '</a>').appendTo(currentRow);
                }
            }
        },

        /**
         * 用窗户的样式显示各个插件
         * @param ces 数据
         * @param content 要显示的目标id
         * @param numPreRow 每行要显示的条目
         * @param type 由于两边的数据结构不同,需要进行区分处理
         */
        window_show: function (ces, content, numPreRow, type) {
            this.getUrlPrefix();
            window.frrows = [];
            var c, imgtag, tipDirection, licenseInfo = '';
            content.html('');
            for (var i = 0; i < ces.length; i++) {
                if (i % numPreRow == 0) {
                    frrows[frrows.length] = $('<div class="row"/>').appendTo(content);
                }
                if (i % numPreRow < numPreRow / 2) {
                    tipDirection = 'right';
                } else {
                    tipDirection = 'left';
                }
                c = $('<div class="thumbnail clearfix" id="' + (isNaN(ces[i].id) ? ces[i].id.replace(/\./g, '-') : ces[i].id) + '">').appendTo($('<div class="col-sm-' + Math.floor(12 / numPreRow) + '"/>').appendTo(frrows[frrows.length - 1]));
                if (type && type == 'local') {
                    this.showLocal(ces[i], c, tipDirection);
                } else if (type && type == 'online') {
                    this.showOnline(ces[i], c, tipDirection);
                }
                if (ces[i].pic && ces[i].pic != 'null' && ces[i].pic.indexOf("default_product.png") === -1) {
                    imgtag = '<img width=100px height=100px src="' + ces[i].pic + '" class="img-responsive center-block"/>';
                } else {
                    imgtag = '<img width=100px height=100px src="scripts/img/product-01.png" alt="Product" class="img-responsive center-block"/>'
                }
                c.append('<div class="left"><div class="image">' + imgtag + '</div></div>');
                licenseInfo = this.licenseInfo(ces[i]);
                c.append('<div class="right"><div class="name">' + ces[i].name + '</div><div class="version">V' + ces[i].version + licenseInfo + '</div></div>');
            }
            var $toolTip = $('[data-toggle="delayTooltip"]');
            $toolTip.delayTooltip();
            $toolTip.on('shown.bs.delayTooltip', function () {//绑定弹出框弹出后绑定一个更多信息的按钮
                Store.Nav.setPluginMoreInfo();
            })
        },

        /**
         * 授权信息
         * @param product 插件
         * @returns {string} 显示的信息
         */
        licenseInfo: function (product) {
            var licenseInfo = '';
            if (product.is_jar_damaged) {
                licenseInfo = PluginHelper.parseI18('FR-Plugin-Store_Jar_Damaged');
            } else if (typeof (product.left_time) == 'number' && !product.is_free) {
                if (product.is_available) {
                    licenseInfo = (product.is_trial ? PluginHelper.parseI18('FR-Plugin-Store_Probation') : PluginHelper.parseI18('FR-Plugin-Store_Authorize')) + (product.left_time > 9999 ? PluginHelper.parseI18('FR-Plugin-Store_Permanent') : product.left_time + PluginHelper.parseI18('FR-Plugin-Store_Day'));
                } else if (product.is_available === false) {
                    licenseInfo = (product.is_trial ? PluginHelper.parseI18('FR-Plugin-Store_Probation') : PluginHelper.parseI18('FR-Plugin-Store_Authorize')) + PluginHelper.parseI18('FR-Plugin-Store_Expired');
                }
            }
            return licenseInfo;
        },

        /**
         * 用于弹窗显示插件详细信息(在线商店)
         * @param {object}product       插件
         * @param {jquery}component     用于显示的jquery对象
         * @param {string}tipDirection  tips显示的方向
         * @returns {string}            显示的内容
         */
        showOnline: function (product, component, tipDirection) {
            this._toolTip(product, component);
            component.attr('data-placement', tipDirection);
            component.data('pluginid', product.pluginid);//由于商城过来的数据,这里pluginid存在data中
            component.data('version', product.version);

        },

        _toolTip: function (product, component) {
            var priceShow = '', footerExtra = '', moreInfoBtn = '', description = '', vendor = '';
            if (product.vendor) {
                vendor = product.vendor.toLowerCase().indexOf('finereport') == -1 ? product.vendor : PluginHelper.parseI18('FR-Plugin-Store_Finereport');
                vendor = vendor.length < 6 ? vendor : (vendor.slice(0, 5) + '..');
            }
            if (product.description) {
                //去除说明中所有html的标签和内嵌样式,否则会在详细信息截取的时候造成不可预知的错误,比如截取半个标签
                description = product.description.replace(/<.*?>/g, '').replace(/<\/.*?>/g, '');
                description = description.length > 100 ? description.slice(0, 100) + '..' : description + '&nbsp&nbsp&nbsp&nbsp';
            }
            if (product.uploadTime) {
                footerExtra = '<div class="upload_time pull-right" >' + PluginHelper.parseI18('FR-Plugin-Store_Update') + ':' + product.uploadTime.split('T')[0].replace(/-/g, '/') + '</div>' +
                    '<div class="version pull-left" >' + PluginHelper.parseI18('FR-Plugin-Store_Version') + ':' + product.version + '</div>';
                moreInfoBtn = '<button data-url="' + Store.Render.SHOP_PRODUCT + product.id + '" class="moreInfo" id="moreInfo' + product.id + '"></button>';
                if ($.isNumeric(product.price) && Number(product.price) > 0) {
                    price = '￥' + product.price;
                } else {
                    price = PluginHelper.parseI18('FR-Plugin-Store_Free');
                }
                priceShow = '<div class="head-right">' + price + '</div>';
            } else if (typeof (product.left_time) == 'number') {//本地就用来显示授权状态
                priceShow = '<div class="head-right">' + (this.licenseInfo(product) == '' ? PluginHelper.parseI18('FR-Plugin-Store_Free') : this.licenseInfo(product)) + '</div>';
            }
            var jarTime = product.jartime ? product.jartime.split('T')[0].replace(/-/g, '/') : '';
            var temp = '<div class="tooltip">' +
                '<div class="fr-tooltip" role="tooltip">' +
                '<div class="head-left">' + product.name + '</div>' + priceShow +
                '<div class="content">' + description + moreInfoBtn +
                '<div class="footer">' +
                '<div class="vendor pull-left" >' + PluginHelper.parseI18('FR-Plugin-Store_Developer') + ':' + vendor + '</div>' + footerExtra +
                '<div class="jar_time pull-right" >' + PluginHelper.parseI18('FR-Plugin-Store_Jar') + ':' + jarTime + '</div></div></div></div>';
            var inner = '-00-';
            component.attr('data-toggle', 'delayTooltip');
            component.attr('data-html', true);
            component.attr('data-title', inner);
            component.attr('data-template', temp);
        },

        /**
         * 用于展示本地插件
         * @param product 插件对象
         * @param component 展示区jq对象
         * @param tipDirection tip的方位
         */
        showLocal: function (product, component, tipDirection) {
            if (product.active == false && product.hasUpdate == true) {
                component.append('<div class="fr-thumbnail-disable-new-tag"></div>');
            } else {
                if (product.active == false) {
                    component.append('<div class="fr-thumbnail-disable-tag"></div>');
                }
                if (product.hasUpdate == true) {
                    component.append('<div class="fr-thumbnail-new-tag"></div>');
                }
            }
            this._toolTip(product, component, tipDirection);
            component.attr('data-placement', 'bottom-' + tipDirection);
        }
    };

    /**
     * 解析工具
     * @type {{jsonDecode: Store.Tool.jsonDecode, hasDateInJson: Store.Tool.hasDateInJson}}
     */
    Store.Tool = {
        jsonDecode: function (text) {
            try {
                // 注意0啊
                //var jo = $.parseJSON(text) || {};
                if (text === "") {
                    text = "{}";
                }
                var jo = $.parseJSON(text);
                if (jo == null) {
                    jo = {};
                }
            } catch (e) {
                /*
                 * richie:浏览器只支持标准的JSON字符串转换，而jQuery会默认调用浏览器的window.JSON.parse()函数进行解析
                 * 比如：var str = "{'a':'b'}",这种形式的字符串转换为JSON就会抛异常
                 */
                try {
                    jo = new Function("return " + text)() || {};
                } catch (e) {
                    //do nothing
                }
                if (jo == null) {
                    jo = [];
                }
            }
            if (!this.hasDateInJson(text)) {
                return jo;
            }
            return (function (o) {
                if (typeof o === "string") {
                    return o;
                }
                if (o && o.__time__ != null) {
                    return new Date(o.__time__);
                }
                for (var a in o) {
                    if (o[a] == o || typeof o[a] == 'object' || $.isFunction(o[a])) {
                        break;
                    }
                    o[a] = arguments.callee(o[a]);
                }

                return o;
            })(jo);
        },

        hasDateInJson: function (json) {
            if (!json || typeof json !== "string") {
                return false;
            }
            return json.indexOf("__time__") != -1;
        }
    };

    /**
     * 分类信息
     * @constructor
     */
    Store.ClassifyInfo = function () {
        this.categories = '';
        this.seller = '';
        this.fee = '';
        this.scope = '';
    };
    /**
     * 分类信息是否为空
     * @type {{isEmpty: Store.ClassifyInfo.isEmpty}}
     */
    Store.ClassifyInfo.prototype = {
        isEmpty: function () {
            return this.categories == '' && this.seller == '' && this.fee == '' && this.scope == '';
        },

        clear: function () {
            this.clearCategory();
            this.clearSeller();
            this.clearFee();
            this.clearScope();
        },

        removeExist: function (id) {
            var recommendTag = $('#recommend-tag');
            if (recommendTag) {
                recommendTag.remove();
            }
            if (id && id != '') {
                $('#' + id + '-tag').remove();
            }
        },

        clearCategory: function () {
            $('#' + this.categories).removeClass('selected-item');
            this.removeExist(this.categories);
            this.categories = '';
        },

        clearSeller: function () {
            $('#' + this.seller).removeClass('selected-item');
            this.removeExist(this.seller);
            this.seller = '';
        },

        clearFee: function () {
            $('#' + this.fee).removeClass('selected-item');
            this.removeExist(this.fee);
            this.fee = '';
        },
        clearScope: function () {
            $('#' + this.scope).removeClass('selected-item');
            this.removeExist(this.scope);
            this.scope = '';
        }
    };

    Store.RUNACTION = {
        SEARCH: 'search',
        SHOW_RESULT: 'showResult'
    };

})(jQuery);


/**
 * Created by jinsihou on 16/4/8.
 */

window.onresize = function () {
    getWindowSize();
};

function getWindowSize() {
    $('.debuginfo').text('width:' + document.body.clientWidth + ',height' + document.body.clientHeight);
}
/**
 * Created by Slpire on 16/9/28.
 */
(function ($) {
    var fun = function (e) {
        // vito:目前不知道e.originalEvent的意思，先这样兼容
        var qqLoginResult = Store.Tool.jsonDecode((e.originalEvent || e).data);
        if (!qqLoginResult) {
            return;
        }
        var uid = qqLoginResult.uid;
        var username = qqLoginResult.username;
        var password = qqLoginResult.password;
        var $loginInfo = $('.loginInfo');
        if (uid > 0) {
            $('.qq-dialog-close').trigger('click');
            $loginInfo.text(username);
            Store.Login.LoginUser = username;
            PluginHelper.ucsynLogin(uid, username, password, function (result) {
                $('.sync-log').remove();
                $('body').append('<div class="sync-log">' + result + '</div>');
            });
            Store.Login.hideDialog();
        }
    };
    if (window.addEventListener) {
        window.addEventListener('message', fun, false);
    } else {
        window.attachEvent("onmessage", fun);
    }

    if (window.Store === undefined) {
        window.Store = {};
    }

    Store.Login = {
        LoginUser: "",

        init: function () {
            this.registerLoginInfo();
            this.setLoginListener();
            this.setRegisterHref();
            this.setForgetHref();
            this.defaultLogin();
            this.closeDialog();
            this.qqLogin();
            this.closeQQDialog();
            this.keyBind();
        },

        registerLoginInfo: function () {
            PluginHelper.registerLoginInfo(function (result) {
                Store.Login.LoginUser = result;
            });
        },

        getLoginInfo: function () {
            return PluginHelper.getLoginInfo(function (result) {
                Store.Login.LoginUser = result;
            });
        },

        setLoginListener: function () {
            var self = this;
            $('.loginInfo').bind('click', function () {
                if (Store.Login.LoginUser === "") {
                    $('.username').val("");
                    $('.password').val("");
                    $('.error-msg').text("");
                    self.showDialog();
                } else {
                    if ($('.loginBtn').css('display') === 'none') {
                        $('.loginBtn').css('display', 'block');
                    } else {
                        $('.loginBtn').css('display', 'none');
                    }
                }
            });

            $('.bbs-msg').text(PluginHelper.parseI18('FR-Plugin-Store_Private_Message'))
                .bind('click', function () {
                    $('.loginBtn').css('display', 'none');
                    PluginHelper.getPriviteMessage();
                });
            $('.loginIn').text(PluginHelper.parseI18('FR-Plugin-Store_Switch_Account'))
                .bind('click', function () {
                    PluginHelper.clearUserInfo();
                    $('.loginInfo').text(PluginHelper.parseI18('FR-Plugin-Store_Not_Login'));
                    $('.loginBtn').css('display', 'none');
                    self.showDialog();
                });
        },

        setRegisterHref: function () {
            $('.register').bind('click', function () {
                PluginHelper.registerHref();
            });
        },

        setForgetHref: function () {
            $('.forget').bind('click', function () {
                PluginHelper.forgetHref();
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
                // 这个方法设计器也在用，回调中需使用绝对路径调用
                PluginHelper.defaultLogin(username, password, function (res) {
                    Store.Login.hideTransition();
                    var result = parseInt(res, 10);
                    if (result >= 0) {
                        Store.Login.LoginUser = $('.user-info').val();
                        Store.Login.hideDialog();
                    }
                    if (result === -1) {
                        Store.Login.showErrorMsg(PluginHelper.parseI18("FR-Plugin-Store_User_Not_Exist"));
                    }
                    if (result === -2) {
                        Store.Login.showErrorMsg(PluginHelper.parseI18("FR-Plugin-Store_User_Password_Error"));
                    }
                    if (result === -3) {
                        Store.Login.showErrorMsg(PluginHelper.parseI18("FR-Plugin-Store_Unexpected_Error"));
                    }
                    if (result === -4) {
                        Store.Login.showErrorMsg(PluginHelper.parseI18("FR-Plugin-Store_Net_Connect_Failed"));
                    }
                    if (result === -5) {
                        Store.Login.showErrorMsg(PluginHelper.parseI18("FR-Plugin-Store_Not_Null"));
                    }
                });
            });
        },

        closeDialog: function () {
            var self = this;
            $('.login-close').bind('click', function () {
                self.hideDialog();
            });
        },

        qqLogin: function () {
            var self = this;
            $('.qqLoginIn').bind('click', function () {
                self.hideDialog();
                document.getElementById('qqlogin').style.backgroundColor = "#def";
                document.getElementById('qqlogin').src = "https://graph.qq.com/oauth/show?which=ConfirmPage&display=pc&response_type=code&client_id=101332435&redirect_uri=http://login.fanruan.com/qq_login.php" + '&a=' + Math.random();
                $('.qqLoginIframe').css('display', 'block');
            });
        },

        closeQQDialog: function () {
            $('.qq-dialog-close').bind('click', function () {
                $('.qqLoginIframe').css('display', 'none');
            });
        },

        showDialog: function () {
            $('.login-dlg').show();
            $('.user-info').focus();
        },

        hideDialog: function () {
            $('.login-dlg').hide();
            this.hideTransition();
            this.hideErrorMsg();
            $('.user-info').val("");
            $('.password').val("");
        },

        showTransition: function () {
            $('.login-content .transition').show();
            $('.default-login').addClass('blur-loading');
            $('.login-btn').prop('disabled', true);
        },

        hideTransition: function () {
            $('.login-btn').prop('disabled', false);
            $('.login-content .transition').hide();
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
(function ($) {
    if (window.Store === null) {
        window.Store = {};
    }
    Store.build = function () {
        // 将页面中的国际化解析后渲染出来
        this.dealI18nText();
        this.initExtraDiff();
        this.TitleBar.init();
        this.Installed.init($('.installed-row'));
        this.Nav.init($('#product-row'));
        this.Login.init();
    };

    Store.dealI18nText = function () {
        $("#app-shop-header").text(PluginHelper.parseI18("FR-Plugin-Store_App"));
        $("#items-head-businesses").text(PluginHelper.parseI18("FR-Plugin-Store_Businesses"));
        $("#seller-finereport").text(PluginHelper.parseI18("FR-Plugin-Store_Official"));
        $("#seller-developer").text(PluginHelper.parseI18("FR-Plugin-Store_Not_Official"));
        $("#items-head-fee").text(PluginHelper.parseI18("FR-Plugin-Store_Cost"));
        $("#fee-charge").text(PluginHelper.parseI18("FR-Plugin-Store_Pay"));
        $("#fee-free").text(PluginHelper.parseI18("FR-Plugin-Store_Free"));
        $("#items-head-scope").text("场景");
        $("#scope-universal").text("通用");
        $("#scope-program").text("方案");
        $("#items-head-class").text(PluginHelper.parseI18("FR-Plugin-Store_Category"));
        $("#recommend-tag").text(PluginHelper.parseI18("FR-Plugin-Store_Recommend"));
        $("#fr-online-search").text(PluginHelper.parseI18("FR-Plugin-Store_Commodity_Description"));
        $("#install-plugin-btn").text(PluginHelper.parseI18("FR-Plugin-Store_Install"));
        if (PluginHelper.isDesigner()) {
            $("#install-plugin-from-disk").text(PluginHelper.parseI18("FR-Plugin-Store_Install_From_Local"));
            $("#update-plugin-from-disk").text(PluginHelper.parseI18("FR-Plugin-Store_Update_From_Local"));
        }
        $("#local-plugins").text(PluginHelper.parseI18("FR-Plugin-Store_My_Plugins"));
        $("#fr-local-search").text(PluginHelper.parseI18("FR-Plugin-Store_Commodity_Description"));
        $("#installed-plugin-count").text(PluginHelper.parseI18("FR-Plugin-Store_No_Plugins"));
        $("#disable-plugin-btn").text(PluginHelper.parseI18("FR-Plugin-Store_Disabled"));
        $("#delete-plugin-btn").text(PluginHelper.parseI18("FR-Plugin-Store_Delete"));
        $("#update-all-plugin-btn").text(PluginHelper.parseI18("FR-Plugin-Store_Update-ALL"));
        $("#bbs-login").text(PluginHelper.parseI18("FR-Plugin-Store_BBS_Account_Login"));
        $("#Register").text(PluginHelper.parseI18("FR-Plugin-Store_Register"));
        $("#loginForget").text(PluginHelper.parseI18("FR-Plugin-Store_Forgot_Password"));
        $("#quick_login").text(PluginHelper.parseI18("FR-Plugin-Store_Quick_Login"));
    };

    Store.initExtraDiff = function () {
        PluginHelper.initExtraDiff();
    }

})(jQuery);
