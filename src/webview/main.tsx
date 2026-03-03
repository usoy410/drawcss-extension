import React from 'react';
import ReactDOM from 'react-dom/client';
import { StudioCanvas } from './StudioCanvas.js';
import { Page, Wiring } from './types/project.js';
import { GenerationOverlay } from './GenerationOverlay.js';
import './globals.css';

// Communication bridge with the VS Code extension host
const vscode = (window as any).vscode;

const WebviewApp = () => {
    const [pages, setPages] = React.useState<Page[]>([
        { id: 'home', name: 'Home', shapes: [], raster: '' }
    ]);
    const [currentPageIndex, setCurrentPageIndex] = React.useState(0);
    const [wirings, setWirings] = React.useState<Wiring[]>([]);

    // Generation State
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [genStatus, setGenStatus] = React.useState("");
    const [genThoughts, setGenThoughts] = React.useState("");
    const [genError, setGenError] = React.useState<string | null>(null);
    const [isComplete, setIsComplete] = React.useState(false);

    React.useEffect(() => {
        const debug = document.getElementById('debug-status');
        if (debug) debug.innerText = 'Studio Active';
    }, []);

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'initialState':
                    if (message.data.pages) setPages(message.data.pages);
                    if (message.data.wirings) setWirings(message.data.wirings);
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

    const handleSubmit = (base64: string, instructions?: string) => {
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
            },
            additionalInstructions: instructions
        });
    };

    const handleAddPage = (name: string) => {
        const newPage: Page = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            shapes: [],
            raster: ''
        };

        const nextPages = [...pages, newPage];
        setPages(nextPages);
        setCurrentPageIndex(nextPages.length - 1);
    };

    const handleDeletePage = (id: string) => {
        if (pages.length <= 1) return;
        setPages(prev => {
            const newPages = prev.filter(p => p.id !== id);
            if (currentPageIndex >= newPages.length) {
                setCurrentPageIndex(Math.max(0, newPages.length - 1));
            }
            return newPages;
        });
    };

    const handleRenamePage = (id: string, newName: string) => {
        setPages(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const handleSaveState = (shapes: any[], raster: string) => {
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

    const handleAddWiring = (elementId: string, targetPageId: string) => {
        const newWiring: Wiring = {
            sourcePageId: pages[currentPageIndex].id,
            sourceElementId: elementId,
            targetPageId
        };
        setWirings(prev => [...prev, newWiring]);
    };

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
            <StudioCanvas
                onSubmit={handleSubmit}
                loading={isGenerating}
                pages={pages}
                currentPageIndex={currentPageIndex}
                wirings={wirings}
                onPageChange={setCurrentPageIndex}
                onAddPage={handleAddPage}
                onDeletePage={handleDeletePage}
                onRenamePage={handleRenamePage}
                onSaveState={handleSaveState}
                onAddWiring={handleAddWiring}
            />

            {isGenerating && (
                <GenerationOverlay
                    status={genStatus}
                    thoughts={genThoughts}
                    isComplete={isComplete}
                    error={genError}
                    onClose={() => setIsGenerating(false)}
                />
            )}
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WebviewApp />
    </React.StrictMode>
);
