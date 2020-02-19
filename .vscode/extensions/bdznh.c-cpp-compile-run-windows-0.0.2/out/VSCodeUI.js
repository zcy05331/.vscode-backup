"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const vscode_1 = require("vscode");
var VSCodeUI;
(function (VSCodeUI) {
    const terminals = {};
    function runInTerminal(command, options) {
        const defaultOptions = { addNewLine: true, name: "Compile & Run" };
        const { addNewLine, name, cwd } = Object.assign(defaultOptions, options);
        if (terminals[name] === undefined) {
            terminals[name] = vscode_1.window.createTerminal({ name });
        }
        terminals[name].show();
        if (cwd) {
            terminals[name].sendText(getCDCommand(cwd), true);
        }
        terminals[name].sendText(getCommand(command), addNewLine);
    }
    VSCodeUI.runInTerminal = runInTerminal;
    function getCommand(cmd) {
        if (os.platform() === "win32") {
            const windowsShell = vscode_1.workspace.getConfiguration("terminal").get("integrated.shell.windows")
                .toLowerCase();
            if (windowsShell && windowsShell.indexOf("powershell.exe") > -1) {
                return `& ${cmd}`; // PowerShell
            }
            else {
                return cmd; // others, try using common one.
            }
        }
        else {
            return cmd;
        }
    }
    VSCodeUI.getCommand = getCommand;
    function getCDCommand(cwd) {
        if (os.platform() === "win32") {
            const windowsShell = vscode_1.workspace.getConfiguration("terminal").get("integrated.shell.windows")
                .toLowerCase();
            if (windowsShell && windowsShell.indexOf("bash.exe") > -1 && windowsShell.indexOf("git") > -1) {
                return `cd "${cwd.replace(/\\+$/, "")}"`; // Git Bash: remove trailing '\'
            }
            else if (windowsShell && windowsShell.indexOf("powershell.exe") > -1) {
                return `cd "${cwd}"`; // PowerShell
            }
            else if (windowsShell && windowsShell.indexOf("cmd.exe") > -1) {
                return `cd /d "${cwd}"`; // CMD
            }
            else {
                return `cd "${cwd}"`; // Unknown, try using common one.
            }
        }
        else {
            return `cd "${cwd}"`;
        }
    }
    VSCodeUI.getCDCommand = getCDCommand;
    function onDidCloseTerminal(closedTerminal) {
        delete terminals[closedTerminal.name];
    }
    VSCodeUI.onDidCloseTerminal = onDidCloseTerminal;
})(VSCodeUI = exports.VSCodeUI || (exports.VSCodeUI = {}));
//# sourceMappingURL=VSCodeUI.js.map