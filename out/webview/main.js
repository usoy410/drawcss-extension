import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { StudioCanvas } from './StudioCanvas.js';
import { GenerationOverlay } from './GenerationOverlay.js';
import './globals.css';
// Communication bridge with the VS Code extension host
const vscode = window.vscode;
const WebviewApp = () => {
    const [pages, setPages] = React.useState([
        { id: 'home', name: 'Home', shapes: [], raster: '' }
    ]);
    const [currentPageIndex, setCurrentPageIndex] = React.useState(0);
    const [wirings, setWirings] = React.useState([]);
    // Generation State
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [genStatus, setGenStatus] = React.useState("");
    const [genThoughts, setGenThoughts] = React.useState("");
    const [genError, setGenError] = React.useState(null);
    const [isComplete, setIsComplete] = React.useState(false);
    React.useEffect(() => {
        const debug = document.getElementById('debug-status');
        if (debug)
            debug.innerText = 'Studio Active';
    }, []);
    React.useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case 'initialState':
                    if (message.data.pages)
                        setPages(message.data.pages);
                    if (message.data.wirings)
                        setWirings(message.data.wirings);
                    break;
                case 'status':
                    setGenStatus(message.text);
                    break;
                case 'thoughts':
                    setGenThoughts(message.text);
                    break;
                case 'complete':
                    setIsComplete(true);
                    setGenStatus("Generation complete!");
                    break;
                case 'error':
                    setGenError(message.text);
                    setIsGenerating(false);
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    // Auto-sync state to extension
    React.useEffect(() => {
        // Debounce save to avoid spamming the extension host
        const timeout = setTimeout(() => {
            vscode.postMessage({
                command: 'saveState',
                data: { pages, wirings }
            });
        }, 1000);
        return () => clearTimeout(timeout);
    }, [pages, wirings]);
    const handleSubmit = (base64) => {
        setIsGenerating(true);
        setIsComplete(false);
        setGenStatus("Initializing...");
        setGenThoughts("");
        setGenError(null);
        vscode.postMessage({
            command: 'submit',
            data: base64,
            navigation: {
                pages: pages.map(p => ({ id: p.id, name: p.name })),
                wirings: wirings,
                currentPageId: pages[currentPageIndex].id
            }
        });
    };
    const handleAddPage = (name) => {
        const newPage = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            shapes: [],
            raster: ''
        };
        const nextPages = [...pages, newPage];
        setPages(nextPages);
        setCurrentPageIndex(nextPages.length - 1);
    };
    const handleDeletePage = (id) => {
        if (pages.length <= 1)
            return;
        setPages(prev => {
            const newPages = prev.filter(p => p.id !== id);
            if (currentPageIndex >= newPages.length) {
                setCurrentPageIndex(Math.max(0, newPages.length - 1));
            }
            return newPages;
        });
    };
    const handleRenamePage = (id, newName) => {
        setPages(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    };
    const handleSaveState = (shapes, raster) => {
        setPages(prev => {
            const next = [...prev];
            if (next[currentPageIndex]) {
                next[currentPageIndex] = {
                    ...next[currentPageIndex],
                    shapes,
                    raster
                };
            }
            return next;
        });
    };
    const handleAddWiring = (elementId, targetPageId) => {
        const newWiring = {
            sourcePageId: pages[currentPageIndex].id,
            sourceElementId: elementId,
            targetPageId
        };
        setWirings(prev => [...prev, newWiring]);
    };
    return (_jsxs("div", { style: { width: '100vw', height: '100vh', background: '#050505' }, children: [_jsx(StudioCanvas, { onSubmit: handleSubmit, loading: isGenerating, pages: pages, currentPageIndex: currentPageIndex, wirings: wirings, onPageChange: setCurrentPageIndex, onAddPage: handleAddPage, onDeletePage: handleDeletePage, onRenamePage: handleRenamePage, onSaveState: handleSaveState, onAddWiring: handleAddWiring }), isGenerating && (_jsx(GenerationOverlay, { status: genStatus, thoughts: genThoughts, isComplete: isComplete, error: genError, onClose: () => setIsGenerating(false) }))] }));
};
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(WebviewApp, {}) }));
//# sourceMappingURL=main.js.map