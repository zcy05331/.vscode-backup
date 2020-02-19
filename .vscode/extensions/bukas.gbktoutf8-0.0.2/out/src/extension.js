"use strict";
var vscode_1 = require('vscode');
var fs = require('fs');
var iconv = require('iconv-lite');
function activate(context) {
    var disposable = vscode_1.workspace.onDidOpenTextDocument(function (doc) {
        var text = doc.getText();
        if (text.indexOf('�') !== -1) {
            var conf_1 = vscode_1.workspace.getConfiguration('files');
            var done_1 = false;
            var absolutePath = doc.uri.fsPath;
            var chunks_1 = [];
            var reader = fs.createReadStream(absolutePath).pipe(iconv.decodeStream('gbk'));
            reader.on('data', function (buf) {
                chunks_1.push(buf);
            });
            reader.on('error', function (error) {
                if (!done_1) {
                    done_1 = true;
                    vscode_1.window.showErrorMessage('failed to change file coding');
                }
            });
            reader.on('end', function () {
                if (!done_1) {
                    done_1 = true;
                    var content_1 = chunks_1.join('');
                    setTimeout(function () {
                        var editor = vscode_1.window.activeTextEditor;
                        var start = new vscode_1.Position(0, 0);
                        var end = new vscode_1.Position(doc.lineCount, 0);
                        var range = new vscode_1.Range(start, end);
                        editor.edit(function (editBuilder) {
                            editBuilder.replace(range, content_1);
                            vscode_1.window.showInformationMessage('successfully changed file coding to ' + conf_1.get('encoding'));
                        });
                    }, 500);
                }
            });
        }
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map