import React from 'react';
import ReactDOM from 'react-dom/client';
import { StudioCanvas } from './StudioCanvas.js';
import { ComponentDesign } from './types/project.js';
import { GenerationOverlay } from './GenerationOverlay.js';
import './globals.css';

// Communication bridge with the VS Code extension host
const vscode = (window as any).vscode;

const WebviewApp = () => {
    const [components, setComponents] = React.useState<ComponentDesign[]>([
        { id: 'component-1', name: 'New Component', shapes: [], raster: '' }
    ]);
    const [currentComponentIndex, setCurrentComponentIndex] = React.useState(0);

    // Generation State
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [genStatus, setGenStatus] = React.useState("");
    const [genThoughts, setGenThoughts] = React.useState("");
    const [genError, setGenError] = React.useState<string | null>(null);
    const [isComplete, setIsComplete] = React.useState(false);
    const [canRollback, setCanRollback] = React.useState(false);

    React.useEffect(() => {
        const debug = document.getElementById('debug-status');
        if (debug) debug.innerText = 'Studio Active';
    }, []);

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'initialState':
                    if (message.data.components) setComponents(message.data.components);
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
                    if (message.canRollback) setCanRollback(true);
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
                data: { components }
            });
        }, 1000);
        return () => clearTimeout(timeout);
    }, [components]);

    const handleSubmit = (base64: string, instructions?: string) => {
        setIsGenerating(true);
        setIsComplete(false);
        setGenStatus("Initializing...");
        setGenThoughts("");
        setGenError(null);

        vscode.postMessage({
            command: 'submit',
            data: base64,
            additionalInstructions: instructions
        });
    };

    const handleRevert = () => {
        setGenStatus("Reverting changes...");
        vscode.postMessage({ command: 'revert' });
        setCanRollback(false);
    };

    const handleAddComponent = (name: string) => {
        const newComponent: ComponentDesign = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            shapes: [],
            raster: ''
        };

        const nextComponents = [...components, newComponent];
        setComponents(nextComponents);
        setCurrentComponentIndex(nextComponents.length - 1);
    };

    const handleDeleteComponent = (id: string) => {
        if (components.length <= 1) return;
        setComponents(prev => {
            const newComponents = prev.filter(c => c.id !== id);
            if (currentComponentIndex >= newComponents.length) {
                setCurrentComponentIndex(Math.max(0, newComponents.length - 1));
            }
            return newComponents;
        });
    };

    const handleRenameComponent = (id: string, newName: string) => {
        setComponents(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
    };

    const handleSaveState = (shapes: any[], raster: string) => {
        setComponents(prev => {
            const next = [...prev];
            if (next[currentComponentIndex]) {
                next[currentComponentIndex] = {
                    ...next[currentComponentIndex],
                    shapes,
                    raster
                };
            }
            return next;
        });
    };

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
            <StudioCanvas
                onSubmit={handleSubmit}
                loading={isGenerating}
                components={components}
                currentComponentIndex={currentComponentIndex}
                onComponentChange={setCurrentComponentIndex}
                onAddComponent={handleAddComponent}
                onDeleteComponent={handleDeleteComponent}
                onRenameComponent={handleRenameComponent}
                onSaveState={handleSaveState}
            />

            {isGenerating && (
                <GenerationOverlay
                    status={genStatus}
                    thoughts={genThoughts}
                    isComplete={isComplete}
                    error={genError}
                    onClose={() => setIsGenerating(false)}
                    canRollback={canRollback}
                    onRevert={handleRevert}
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
