"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs-extra");
const glob = require("glob");
class Cleaner {
    constructor(extension) {
        this.extension = extension;
    }
    async clean(rootFile) {
        if (!rootFile) {
            if (this.extension.manager.rootFile !== undefined) {
                await this.extension.manager.findRoot();
            }
            rootFile = this.extension.manager.rootFile;
            if (!rootFile) {
                return;
            }
        }
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        let globs = configuration.get('latex.clean.fileTypes');
        const outdir = this.extension.manager.getOutDir(rootFile);
        if (configuration.get('latex.clean.subfolder.enabled')) {
            globs = globs.map(globType => './**/' + globType);
        }
        return Promise.all(
        // Get an array of arrays containing all the files found by the globs
        globs.map(g => this.globP(g, { cwd: outdir }))).then(files => files
            // Reduce the array of arrays to a single array containing all the files that should be deleted
            .reduce((all, curr) => all.concat(curr), [])
            // Resolve the absolute filepath for every file
            .map(file => path.resolve(outdir, file))).then(files => Promise.all(
        // Try to unlink the files, returning a Promise for every file
        files.map(file => fs.unlink(file).then(() => {
            this.extension.logger.addLogMessage(`File cleaned: ${file}`);
            // If unlinking fails, replace it with an rmdir Promise
        }, () => fs.rmdir(file).then(() => {
            this.extension.logger.addLogMessage(`Folder removed: ${file}`);
        }, () => {
            this.extension.logger.addLogMessage(`Error removing file: ${file}`);
        }))))).then(() => { } // Do not pass results to Promise returned by clean()
        ).catch(err => {
            this.extension.logger.addLogMessage(`Error during deletion of files: ${err}`);
            if (err instanceof Error) {
                this.extension.logger.logError(err);
            }
        });
    }
    // This function wraps the glob package into a promise.
    // It behaves like the original apart from returning a Promise instead of requiring a Callback.
    globP(pattern, options) {
        return new Promise((resolve, reject) => {
            glob(pattern, options, (err, files) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(files);
                }
            });
        });
    }
}
exports.Cleaner = Cleaner;
//# sourceMappingURL=cleaner.js.map