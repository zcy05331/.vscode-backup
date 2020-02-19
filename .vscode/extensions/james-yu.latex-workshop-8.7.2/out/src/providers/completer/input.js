"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs-extra");
const path = require("path");
const micromatch = require("micromatch");
const cp = require("child_process");
const utils = require("../../utils/utils");
const ignoreFiles = ['**/.vscode', '**/.vscodeignore', '**/.gitignore'];
class Input {
    constructor(extension) {
        this.graphicsPath = [];
        this.extension = extension;
    }
    filterIgnoredFiles(files, baseDir) {
        const excludeGlob = (Object.keys(vscode.workspace.getConfiguration('files', null).get('exclude') || {})).concat(vscode.workspace.getConfiguration('latex-workshop').get('intellisense.file.exclude') || []).concat(ignoreFiles);
        let gitIgnoredFiles = [];
        /* Check .gitignore if needed */
        if (vscode.workspace.getConfiguration('search', null).get('useIgnoreFiles')) {
            try {
                gitIgnoredFiles = (cp.execSync('git check-ignore ' + files.join(' '), { cwd: baseDir })).toString().split('\n');
            }
            catch (ex) { }
        }
        return files.filter(file => {
            const filePath = path.resolve(baseDir, file);
            /* Check if the file should be ignored */
            if ((gitIgnoredFiles.includes(file)) || micromatch.any(filePath, excludeGlob, { basename: true })) {
                return false;
            }
            else {
                return true;
            }
        });
    }
    getGraphicsPath(filePath) {
        const content = utils.stripComments(fs.readFileSync(filePath, 'utf-8'), '%');
        const regex = /\\graphicspath{[\s\n]*((?:{[^{}]*}[\s\n]*)*)}/g;
        let result;
        do {
            result = regex.exec(content);
            if (result) {
                for (const dir of result[1].split(/\{|\}/).filter(s => s.replace(/^\s*$/, ''))) {
                    if (this.graphicsPath.includes(dir)) {
                        continue;
                    }
                    this.graphicsPath.push(dir);
                }
            }
        } while (result);
    }
    reset() {
        this.graphicsPath = [];
    }
    /**
     * Provide file name intellissense
     *
     * @param payload an array of string
     *      payload[0]: the input command type  (input, import, subimport)
     *      payload[1]: the current file name
     *      payload[2]: When defined, the path from which completion is triggered
     *      payload[3]: The already typed path
     */
    provide(payload) {
        let provideDirOnly = false;
        let baseDir = [];
        const mode = payload[0];
        const currentFile = payload[1];
        const command = payload[2];
        const typedFolder = payload[3];
        const importfromDir = payload[4];
        switch (mode) {
            case 'import':
                if (importfromDir) {
                    baseDir = [importfromDir];
                }
                else {
                    baseDir = ['/'];
                    provideDirOnly = true;
                }
                break;
            case 'subimport':
                if (importfromDir) {
                    baseDir = [path.join(path.dirname(currentFile), importfromDir)];
                }
                else {
                    baseDir = [path.dirname(currentFile)];
                    provideDirOnly = true;
                }
                break;
            case 'input': {
                if (this.extension.manager.rootDir === undefined) {
                    this.extension.logger.addLogMessage(`No root dir can be found. The current root file should be undefined, is ${this.extension.manager.rootFile}. How did you get here?`);
                    break;
                }
                // If there is no root, 'root relative' and 'both' should fall back to 'file relative'
                const rootDir = this.extension.manager.rootDir;
                if (command === 'includegraphics' && this.graphicsPath.length > 0) {
                    baseDir = this.graphicsPath.map(dir => path.join(rootDir, dir));
                }
                else {
                    const baseConfig = vscode.workspace.getConfiguration('latex-workshop').get('intellisense.file.base');
                    switch (baseConfig) {
                        case 'root relative':
                            baseDir = [rootDir];
                            break;
                        case 'file relative':
                            baseDir = [path.dirname(currentFile)];
                            break;
                        case 'both':
                            baseDir = [path.dirname(currentFile), rootDir];
                            break;
                        default:
                    }
                }
                break;
            }
            default:
                return [];
        }
        const suggestions = [];
        baseDir.forEach(dir => {
            if (typedFolder !== '') {
                dir = path.resolve(dir, typedFolder);
            }
            try {
                let files = fs.readdirSync(dir);
                files = this.filterIgnoredFiles(files, dir);
                files.forEach(file => {
                    const filePath = path.resolve(dir, file);
                    if (dir === '/') {
                        // Keep the leading '/' to have an absolute path
                        file = '/' + file;
                    }
                    if (fs.lstatSync(filePath).isDirectory()) {
                        const item = new vscode.CompletionItem(`${file}/`, vscode.CompletionItemKind.Folder);
                        item.command = { title: 'Post-Action', command: 'editor.action.triggerSuggest' };
                        item.detail = dir;
                        suggestions.push(item);
                    }
                    else if (!provideDirOnly) {
                        const item = new vscode.CompletionItem(file, vscode.CompletionItemKind.File);
                        const preview = vscode.workspace.getConfiguration('latex-workshop').get('intellisense.includegraphics.preview.enabled');
                        if (preview && command === 'includegraphics') {
                            item.documentation = filePath;
                        }
                        item.detail = dir;
                        suggestions.push(item);
                    }
                });
            }
            catch (error) { }
        });
        return suggestions;
    }
}
exports.Input = Input;
//# sourceMappingURL=input.js.map