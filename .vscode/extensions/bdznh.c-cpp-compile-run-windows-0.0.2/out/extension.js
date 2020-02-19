'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const VSCodeUI_1 = require("./VSCodeUI");
function activate(context) {
    let CompileRunCommand = vscode.commands.registerCommand('extension.CompileRun', () => {
        let currentFile = vscode.window.activeTextEditor.document.fileName;
        let outputFile = path.join(path.parse(currentFile).dir, path.parse(currentFile).name);
        if (!currentFile) {
            return;
        }
        switch (path.parse(currentFile).ext) {
            case '.cpp': {
                VSCodeUI_1.VSCodeUI.runInTerminal('g++ -std=c++11 -Wall -O2 ' + "\"" + currentFile + "\"" + ' -o ' + "\"" + outputFile + ".exe\"");
                //VSCodeUI.runInTerminal("cls");
                VSCodeUI_1.VSCodeUI.runInTerminal("\"" + outputFile + ".exe\"");
                break;
            }
            case '.c': {
                VSCodeUI_1.VSCodeUI.runInTerminal('gcc -Wall -Wextra ' + "\"" + currentFile + "\"" + ' -o ' + "\"" + outputFile + ".exe\"");
                VSCodeUI_1.VSCodeUI.runInTerminal("cls");
                VSCodeUI_1.VSCodeUI.runInTerminal("\"" + outputFile + ".exe\"");
                break;
            }
            default: {
                break;
            }
        }
    });
    context.subscriptions.push(CompileRunCommand);
    context.subscriptions.push(vscode.window.onDidCloseTerminal((closedTerminal) => {
        VSCodeUI_1.VSCodeUI.onDidCloseTerminal(closedTerminal);
    }));
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map