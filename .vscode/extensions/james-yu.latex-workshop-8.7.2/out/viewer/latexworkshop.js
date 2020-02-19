import { SyncTex } from './components/synctex.js';
import { PageTrimmer } from './components/pagetrimmer.js';
import * as utils from './components/utils.js';
import { ViewerHistory } from './components/viewerhistory.js';
class LateXWorkshopPdfViewer {
    constructor() {
        this.documentTitle = '';
        this.embedded = window.parent !== window;
        const pack = this.decodeQuery();
        this.encodedPdfFilePath = pack.encodedPdfFilePath;
        this.documentTitle = pack.documentTitle;
        document.title = this.documentTitle;
        this.pdfFilePath = pack.pdfFilePath;
        this.viewerHistory = new ViewerHistory(this);
        const server = `ws://${window.location.hostname}:${window.location.port}`;
        this.server = server;
        this.socket = new WebSocket(server);
        this.synctex = new SyncTex(this);
        this.pageTrimmer = new PageTrimmer(this);
        this.setupWebSocket();
        this.onWillStartPdfViewer(() => {
            // PDFViewerApplication detects whether it's embedded in an iframe (window.parent !== window)
            // and if so it behaves more "discretely", eg it disables its history mechanism.
            // We dont want that, so we unset the flag here (to keep viewer.js as vanilla as possible)
            // https://github.com/James-Yu/LaTeX-Workshop/pull/447
            PDFViewerApplication.isViewerEmbedded = false;
        });
        this.onDidStartPdfViewer(() => {
            utils.callCbOnDidOpenWebSocket(this.socket, () => {
                this.send({ type: 'request_params', path: this.pdfFilePath });
            });
        });
        this.onDidRenderPdfFile(() => {
            utils.callCbOnDidOpenWebSocket(this.socket, () => {
                this.send({ type: 'loaded', path: this.pdfFilePath });
            });
        }, { once: true });
        this.hidePrintButton();
        this.registerKeybinding();
        this.startConnectionKeeper();
    }
    onWillStartPdfViewer(cb) {
        document.addEventListener('webviewerloaded', cb, { once: true });
        return { dispose: () => document.removeEventListener('webviewerloaded', cb) };
    }
    onDidStartPdfViewer(cb) {
        document.addEventListener('documentloaded', cb, { once: true });
        return { dispose: () => document.removeEventListener('documentloaded', cb) };
    }
    onDidLoadPdfFile(cb, option) {
        document.addEventListener('pagesinit', cb, option);
        return { dispose: () => document.removeEventListener('pagesinit', cb) };
    }
    onDidRenderPdfFile(cb, option) {
        document.addEventListener('pagerendered', cb, option);
        return { dispose: () => document.removeEventListener('pagerendered', cb) };
    }
    send(message) {
        this.socket.send(JSON.stringify(message));
    }
    setupWebSocket() {
        utils.callCbOnDidOpenWebSocket(this.socket, () => {
            const pack = {
                type: 'open',
                path: this.pdfFilePath,
                viewer: (this.embedded ? 'tab' : 'browser')
            };
            this.send(pack);
        });
        this.socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'synctex': {
                    // use the offsetTop of the actual page, much more accurate than multiplying the offsetHeight of the first page
                    const container = document.getElementById('viewerContainer');
                    const pos = PDFViewerApplication.pdfViewer._pages[data.data.page - 1].viewport.convertToViewportPoint(data.data.x, data.data.y);
                    const page = document.getElementsByClassName('page')[data.data.page - 1];
                    const scrollX = page.offsetLeft + pos[0];
                    const scrollY = page.offsetTop + page.offsetHeight - pos[1];
                    // set positions before and after SyncTeX to viewerHistory
                    this.viewerHistory.set(container.scrollTop);
                    container.scrollTop = scrollY - document.body.offsetHeight * 0.4;
                    this.viewerHistory.set(container.scrollTop);
                    const indicator = document.getElementById('synctex-indicator');
                    indicator.className = 'show';
                    indicator.style.left = `${scrollX}px`;
                    indicator.style.top = `${scrollY}px`;
                    setTimeout(() => indicator.className = 'hide', 10);
                    break;
                }
                case 'refresh': {
                    const pack = {
                        scale: PDFViewerApplication.pdfViewer.currentScaleValue,
                        scrollMode: PDFViewerApplication.pdfViewer.scrollMode,
                        spreadMode: PDFViewerApplication.pdfViewer.spreadMode,
                        scrollTop: document.getElementById('viewerContainer').scrollTop,
                        scrollLeft: document.getElementById('viewerContainer').scrollLeft
                    };
                    // Note: without showPreviousViewOnLoad = false restoring the position after the refresh will fail if
                    // the user has clicked on any link in the past (pdf.js will automatically navigate to that link).
                    PDFViewerApplicationOptions.set('showPreviousViewOnLoad', false);
                    // Override the spread mode specified in PDF documents with the current one.
                    // https://github.com/James-Yu/LaTeX-Workshop/issues/1871
                    PDFViewerApplicationOptions.set('spreadModeOnLoad', pack.spreadMode);
                    PDFViewerApplication.open(`${utils.pdfFilePrefix}${this.encodedPdfFilePath}`).then(() => {
                        // reset the document title to the original value to avoid duplication
                        document.title = this.documentTitle;
                        // ensure that trimming is invoked if needed.
                        setTimeout(() => {
                            window.dispatchEvent(new Event('pagerendered'));
                        }, 2000);
                    });
                    this.onDidLoadPdfFile(() => {
                        PDFViewerApplication.pdfViewer.currentScaleValue = pack.scale;
                        PDFViewerApplication.pdfViewer.scrollMode = pack.scrollMode;
                        PDFViewerApplication.pdfViewer.spreadMode = pack.spreadMode;
                        document.getElementById('viewerContainer').scrollTop = pack.scrollTop;
                        document.getElementById('viewerContainer').scrollLeft = pack.scrollLeft;
                    }, { once: true });
                    this.onDidRenderPdfFile(() => {
                        this.send({ type: 'loaded', path: this.pdfFilePath });
                    }, { once: true });
                    break;
                }
                case 'params': {
                    if (data.scale) {
                        PDFViewerApplication.pdfViewer.currentScaleValue = data.scale;
                    }
                    if (data.scrollMode) {
                        PDFViewerApplication.pdfViewer.scrollMode = data.scrollMode;
                    }
                    if (data.spreadMode) {
                        PDFViewerApplication.pdfViewer.spreadMode = data.spreadMode;
                    }
                    if (data.hand) {
                        PDFViewerApplication.pdfCursorTools.handTool.activate();
                    }
                    else {
                        PDFViewerApplication.pdfCursorTools.handTool.deactivate();
                    }
                    if (data.trim) {
                        const trimSelect = document.getElementById('trimSelect');
                        const e = new Event('change');
                        // We have to wait for currentScaleValue set above to be effected.
                        // https://github.com/James-Yu/LaTeX-Workshop/issues/1870
                        this.onDidRenderPdfFile(() => {
                            trimSelect.selectedIndex = data.trim;
                            trimSelect.dispatchEvent(e);
                        }, { once: true });
                    }
                    if (data.invert > 0) {
                        document.querySelector('html').style.filter = `invert(${data.invert * 100}%)`;
                        document.querySelector('html').style.background = 'white';
                    }
                    document.querySelector('#viewerContainer').style.background = data.bgColor;
                    if (data.keybindings) {
                        this.synctex.reverseSynctexKeybinding = data.keybindings['synctex'];
                        this.synctex.registerListenerOnEachPage();
                    }
                    break;
                }
                default: {
                    break;
                }
            }
        });
        this.socket.onclose = () => {
            document.title = `[Disconnected] ${this.documentTitle}`;
            console.log('Closed: WebScocket to LaTeX Workshop.');
            // Since WebSockets are disconnected when PC resumes from sleep,
            // we have to reconnect. https://github.com/James-Yu/LaTeX-Workshop/pull/1812
            setTimeout(() => {
                console.log('Try to reconnect to LaTeX Workshop.');
                const sock = new WebSocket(this.server);
                this.socket = sock;
                utils.callCbOnDidOpenWebSocket(sock, () => {
                    document.title = this.documentTitle;
                    this.setupWebSocket();
                    console.log('Reconnected: WebScocket to LaTeX Workshop.');
                });
            }, 3000);
        };
    }
    showToolbar(animate) {
        if (this.hideToolbarInterval) {
            clearInterval(this.hideToolbarInterval);
        }
        const d = document.getElementsByClassName('toolbar')[0];
        d.className = d.className.replace(' hide', '') + (animate ? '' : ' notransition');
        this.hideToolbarInterval = setInterval(() => {
            if (!PDFViewerApplication.findBar.opened && !PDFViewerApplication.pdfSidebar.isOpen && !PDFViewerApplication.secondaryToolbar.isOpen) {
                d.className = d.className.replace(' notransition', '') + ' hide';
                clearInterval(this.hideToolbarInterval);
            }
        }, 3000);
    }
    decodeQuery() {
        const query = document.location.search.substring(1);
        const parts = query.split('&');
        for (let i = 0, ii = parts.length; i < ii; ++i) {
            const param = parts[i].split('=');
            if (param[0].toLowerCase() === 'file') {
                const encodedPdfFilePath = param[1].replace(utils.pdfFilePrefix, '');
                const pdfFilePath = utils.decodePath(encodedPdfFilePath);
                const documentTitle = pdfFilePath.split(/[\\/]/).pop();
                return { encodedPdfFilePath, pdfFilePath, documentTitle };
            }
        }
        throw new Error('file not given in the query.');
    }
    hidePrintButton() {
        const query = document.location.search.substring(1);
        const parts = query.split('&');
        for (let i = 0, ii = parts.length; i < ii; ++i) {
            const param = parts[i].split('=');
            if (param[0].toLowerCase() === 'incode' && param[1] === '1') {
                const dom = document.getElementsByClassName('print');
                for (let j = 0; j < dom.length; ++j) {
                    dom.item(j).style.display = 'none';
                }
            }
        }
    }
    registerKeybinding() {
        // if we're embedded we cannot open external links here. So we intercept clicks and forward them to the extension
        if (this.embedded) {
            document.addEventListener('click', (e) => {
                const target = e.target;
                if (target.nodeName === 'A' && !target.href.startsWith(window.location.href)) { // is external link
                    this.send({ type: 'external_link', url: target.href });
                    e.preventDefault();
                }
            });
        }
        // keyboard bindings
        window.addEventListener('keydown', (evt) => {
            // F opens find bar, cause Ctrl-F is handled by vscode
            const target = evt.target;
            if (evt.keyCode === 70 && target.nodeName !== 'INPUT') { // ignore F typed in the search box
                this.showToolbar(false);
                PDFViewerApplication.findBar.open();
                evt.preventDefault();
            }
            // Chrome's usual Alt-Left/Right (Command-Left/Right on OSX) for history
            // Back/Forward don't work in the embedded viewer, so we simulate them.
            if (this.embedded && (evt.altKey || evt.metaKey)) {
                if (evt.keyCode === 37) {
                    this.viewerHistory.back();
                }
                else if (evt.keyCode === 39) {
                    this.viewerHistory.forward();
                }
            }
        });
        document.getElementById('outerContainer').onmousemove = (e) => {
            if (e.clientY <= 64) {
                this.showToolbar(true);
            }
        };
    }
    startConnectionKeeper() {
        // Send packets every 30 sec to prevent the connection closed by timeout.
        setInterval(() => {
            if (this.socket.readyState === 1) {
                this.send({ type: 'ping' });
            }
        }, 30000);
    }
}
new LateXWorkshopPdfViewer();
//# sourceMappingURL=latexworkshop.js.map