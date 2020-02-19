"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const iconv = require("iconv-lite");
const path = require("path");
const zlib = require("zlib");
const synctexjs_1 = require("../lib/synctexjs");
const utils_1 = require("../utils/utils");
function parseSyncTexForPdf(pdfFile) {
    const filename = path.basename(pdfFile, path.extname(pdfFile));
    const dir = path.dirname(pdfFile);
    const synctexFile = path.resolve(dir, filename + '.synctex');
    const synctexFileGz = synctexFile + '.gz';
    if (fs.existsSync(synctexFile)) {
        const s = fs.readFileSync(synctexFile, { encoding: 'binary' });
        return synctexjs_1.parseSyncTex(s);
    }
    if (fs.existsSync(synctexFileGz)) {
        const data = fs.readFileSync(synctexFileGz);
        const b = zlib.gunzipSync(data);
        const s = b.toString('binary');
        return synctexjs_1.parseSyncTex(s);
    }
    throw new synctexjs_1.SyncTexJsError('synctex file, .synctex and .synctex.gz, not found in the file system.');
}
exports.parseSyncTexForPdf = parseSyncTexForPdf;
function findInputFilePathForward(filePath, pdfSyncObject) {
    for (const inputFilePath in pdfSyncObject.blockNumberLine) {
        if (path.resolve(inputFilePath) === filePath) {
            return inputFilePath;
        }
    }
    for (const inputFilePath in pdfSyncObject.blockNumberLine) {
        for (const enc of utils_1.iconvLiteSupportedEncodings) {
            try {
                const s = iconv.decode(Buffer.from(inputFilePath, 'binary'), enc);
                if (path.resolve(s) === filePath) {
                    return inputFilePath;
                }
            }
            catch (e) {
            }
        }
    }
    return undefined;
}
function syncTexJsForward(line, filePath, pdfFile) {
    const pdfSyncObject = parseSyncTexForPdf(pdfFile);
    const inputFilePath = findInputFilePathForward(filePath, pdfSyncObject);
    if (inputFilePath === undefined) {
        throw new synctexjs_1.SyncTexJsError('no relevant entry of tex file found in the synctex file.');
    }
    const linePageBlocks = pdfSyncObject.blockNumberLine[inputFilePath];
    const lineNums = Object.keys(linePageBlocks).map(x => Number(x)).sort((a, b) => { return (a - b); });
    const i = lineNums.findIndex(x => x >= line);
    if (i === 0 || lineNums[i] === line) {
        const l = lineNums[i];
        const blocks = getBlocks(linePageBlocks, l);
        const c = Rectangle.coveringRectangle(blocks);
        return { page: blocks[0].page, x: c.left + pdfSyncObject.offset.x, y: c.bottom + pdfSyncObject.offset.y };
    }
    const line0 = lineNums[i - 1];
    const blocks0 = getBlocks(linePageBlocks, line0);
    const c0 = Rectangle.coveringRectangle(blocks0);
    const line1 = lineNums[i];
    const blocks1 = getBlocks(linePageBlocks, line1);
    const c1 = Rectangle.coveringRectangle(blocks1);
    let bottom;
    if (c0.bottom < c1.bottom) {
        bottom = c0.bottom * (line1 - line) / (line1 - line0) + c1.bottom * (line - line0) / (line1 - line0);
    }
    else {
        bottom = c1.bottom;
    }
    return { page: blocks1[0].page, x: c1.left + pdfSyncObject.offset.x, y: bottom + pdfSyncObject.offset.y };
}
exports.syncTexJsForward = syncTexJsForward;
function getBlocks(linePageBlocks, lineNum) {
    const pageBlocks = linePageBlocks[lineNum];
    const pageNums = Object.keys(pageBlocks);
    if (pageNums.length === 0) {
        throw new synctexjs_1.SyncTexJsError('no page number found in the synctex file.');
    }
    const page = pageNums[0];
    return pageBlocks[Number(page)];
}
class Rectangle {
    constructor({ top, bottom, left, right }) {
        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }
    static coveringRectangle(blocks) {
        let cTop = 2e16;
        let cBottom = 0;
        let cLeft = 2e16;
        let cRight = 0;
        for (const b of blocks) {
            // Skip a block if they have boxes inside, or their type is kern or rule.
            // See also https://github.com/jlaurens/synctex/blob/2017/synctex_parser.c#L4655 for types.
            if (b.elements !== undefined || b.type === 'k' || b.type === 'r') {
                continue;
            }
            cBottom = Math.max(b.bottom, cBottom);
            const top = b.bottom - b.height;
            cTop = Math.min(top, cTop);
            cLeft = Math.min(b.left, cLeft);
            if (b.width !== undefined) {
                const right = b.left + b.width;
                cRight = Math.max(right, cRight);
            }
        }
        return new Rectangle({ top: cTop, bottom: cBottom, left: cLeft, right: cRight });
    }
    static fromBlock(block) {
        const top = block.bottom - block.height;
        const bottom = block.bottom;
        const left = block.left;
        const right = block.width ? block.left + block.width : block.left;
        return new Rectangle({ top, bottom, left, right });
    }
    include(rect) {
        return this.left <= rect.left && this.right >= rect.right && this.bottom >= rect.bottom && this.top <= rect.top;
    }
    distanceY(y) {
        return Math.min(Math.abs(this.bottom - y), Math.abs(this.top - y));
    }
    distanceXY(x, y) {
        return Math.sqrt(Math.pow(Math.min(Math.abs(this.bottom - y), Math.abs(this.top - y)), 2) + Math.pow(Math.min(Math.abs(this.left - x), Math.abs(this.right - x)), 2));
    }
    distanceFromCenter(x, y) {
        return Math.sqrt(Math.pow((this.left + this.right) / 2 - x, 2) + Math.pow((this.bottom + this.top) / 2 - y, 2));
    }
}
function syncTexJsBackward(page, x, y, pdfPath) {
    const pdfSyncObject = parseSyncTexForPdf(pdfPath);
    const y0 = y - pdfSyncObject.offset.y;
    const x0 = x - pdfSyncObject.offset.x;
    const fileNames = Object.keys(pdfSyncObject.blockNumberLine);
    if (fileNames.length === 0) {
        throw new synctexjs_1.SyncTexJsError('no entry of tex file found in the synctex file.');
    }
    const record = {
        input: '',
        line: 0,
        distanceXY: 2e16,
        distanceFromCenter: 2e16,
        rect: new Rectangle({ top: 0, bottom: 2e16, left: 0, right: 2e16 })
    };
    for (const fileName of fileNames) {
        const linePageBlocks = pdfSyncObject.blockNumberLine[fileName];
        for (const lineNum in linePageBlocks) {
            const pageBlocks = linePageBlocks[Number(lineNum)];
            for (const pageNum in pageBlocks) {
                if (page !== Number(pageNum)) {
                    continue;
                }
                const blocks = pageBlocks[Number(pageNum)];
                for (const block of blocks) {
                    // Skip a block if they have boxes inside, or their type is kern or rule.
                    // See also https://github.com/jlaurens/synctex/blob/2017/synctex_parser.c#L4655 for types.
                    if (block.elements !== undefined || block.type === 'k' || block.type === 'r') {
                        continue;
                    }
                    const rect = Rectangle.fromBlock(block);
                    const distFromCenter = rect.distanceFromCenter(x0, y0);
                    if (record.rect.include(rect) || (distFromCenter < record.distanceFromCenter && !rect.include(record.rect))) {
                        record.input = fileName;
                        record.line = Number(lineNum);
                        record.distanceFromCenter = distFromCenter;
                        record.rect = rect;
                    }
                }
            }
        }
    }
    if (record.input === '') {
        throw new synctexjs_1.SyncTexJsError('cannot find any line to jump to.');
    }
    return { input: convInputFilePath(record.input), line: record.line, column: 0 };
}
exports.syncTexJsBackward = syncTexJsBackward;
function convInputFilePath(inputFilePath) {
    if (fs.existsSync(inputFilePath)) {
        return inputFilePath;
    }
    for (const enc of utils_1.iconvLiteSupportedEncodings) {
        try {
            const s = iconv.decode(Buffer.from(inputFilePath, 'binary'), enc);
            if (fs.existsSync(s)) {
                return s;
            }
        }
        catch (e) {
        }
    }
    throw new synctexjs_1.SyncTexJsError('input file to jump to does not exist in the file system.');
}
//# sourceMappingURL=synctex.js.map