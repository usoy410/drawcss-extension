import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StudioCanvas } from './StudioCanvas.js';
import './globals.css';
// Communication bridge with the VS Code extension host
const vscode = window.vscode;
const WebviewApp = () => {
    React.useEffect(() => {
        const debug = document.getElementById('debug-status');
        if (debug)
            debug.innerText = 'Studio Active';
    }, []);
    const handleSubmit = (base64) => {
        vscode.postMessage({
            command: 'submit',
            data: base64
        });
    };
    return (_jsx("div", { style: { width: '100vw', height: '100vh', background: '#050505' }, children: _jsx(StudioCanvas, { onSubmit: handleSubmit, pages: [{ id: 'home', name: 'Home', shapes: [], raster: '' }], currentPageIndex: 0, wirings: [], onPageChange: () => { }, onAddPage: () => { }, onDeletePage: () => { }, onSaveState: () => { }, onAddWiring: () => { } }) }));
};
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(WebviewApp, {}) }));
//# sourceMappingURL=main.js.map