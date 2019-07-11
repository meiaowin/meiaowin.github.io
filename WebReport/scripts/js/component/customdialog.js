/**
 *@param {JSON} config 对话框的配置属性
 *@param {String} arguments 对话框展示的文本信息
 *@static
 */
;(function() {
    $.extend(FR, {
        //定制一个简单的对话框,基于FR.Dialog
        showNeededDialog : function (arg) {
            var content;
            if (typeof arg === 'string') {
                content = arg;
            }
            var dlg = new FR.Dialog({
                title : FR.i18nText("FS-Msg_Prompt"),
                height : 155,
                width: 320,
                widgetName: 'customdialog',
                contentWidget: {
                    type: 'absolute',
                    items: [
                        {
                            el: $('<div>'+content+'</div>').css({'left': 30, 'top': 35, 'font-size': '14px'})
                        },
                        {
                            type: 'quickbutton',
                            text: FR.i18nText("FS-Button_OK"),
                            width: 60,
                            height: 30,
                            x: 130,
                            y: 75,
                            handler: function () {
                                //关闭dialog窗口
                                dlg.getWidgetByName('customdialog').doClose();
                            }
                        }
                    ]
                }
            });
            dlg.setVisible(true);
            return dlg;
        }
    });
})();