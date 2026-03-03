"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState, useEffect, useCallback } from "react";
import { Pencil, Eraser, Type, Undo2, Redo2, RotateCcw, ChevronLeft, X, CornerDownLeft, Send, Square, Circle as CircleIcon, Minus, Shapes, MousePointer2, Plus, FileText, Link as LinkIcon, X as XIcon, } from "lucide-react";
import { cn } from "./lib/utils.js";
export function StudioCanvas({ onSubmit, loading, pages, currentPageIndex, wirings, onPageChange, onAddPage, onDeletePage, onSaveState, onAddWiring }) {
    const canvasRef = useRef(null);
    const offscreenCanvasRef = useRef(null);
    const [activeTool, setActiveTool] = useState("pencil");
    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
    const [isResizing, setIsResizing] = useState(false);
    const [linkSourceId, setLinkSourceId] = useState(null);
    const [linkTargetPos, setLinkTargetPos] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [brushSize, setBrushSize] = useState(3);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [showSettings, setShowSettings] = useState(false);
    const [textInput, setTextInput] = useState(null);
    const [selectedShape, setSelectedShape] = useState("rect");
    const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
    const [shapeStartPos, setShapeStartPos] = useState(null);
    const [previewImageData, setPreviewImageData] = useState(null);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [showAddPageModal, setShowAddPageModal] = useState(false);
    const [newPageName, setNewPageName] = useState("");
    const [shapes, setShapes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [dragOffset, setDragOffset] = useState(null);
    const gridSize = 20;
    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyStep, setHistoryStep] = useState(-1);
    const snap = (val) => Math.round(val / gridSize) * gridSize;
    const renderCanvas = useCallback((currentShapes) => {
        const canvas = canvasRef.current;
        const offscreen = offscreenCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas || !offscreen)
            return;
        // Clear and draw offscreen (raster)
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreen, 0, 0);
        const targetShapes = currentShapes || shapes;
        // Draw shapes
        targetShapes.forEach(shape => {
            ctx.strokeStyle = selectedId === shape.id ? "#3b82f6" : "white";
            ctx.lineWidth = selectedId === shape.id ? brushSize + 2 : brushSize;
            ctx.fillStyle = selectedId === shape.id ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.1)";
            if (shape.type === "rect") {
                if (shape.width !== undefined && shape.height !== undefined) {
                    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                }
            }
            else if (shape.type === "circle") {
                if (shape.radius !== undefined) {
                    ctx.beginPath();
                    ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fill();
                }
            }
            else if (shape.type === "line") {
                if (shape.x2 !== undefined && shape.y2 !== undefined) {
                    ctx.beginPath();
                    ctx.moveTo(shape.x, shape.y);
                    ctx.lineTo(shape.x2, shape.y2);
                    ctx.stroke();
                }
            }
        });
    }, [shapes, selectedId, brushSize]);
    const saveToHistory = useCallback((currentShapes) => {
        const canvas = canvasRef.current;
        const offscreen = offscreenCanvasRef.current;
        if (!canvas || !offscreen)
            return;
        const newStep = {
            raster: offscreen.toDataURL(),
            shapes: [...(currentShapes || shapes)]
        };
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newStep);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    }, [history, historyStep, shapes]);
    const deleteSelected = useCallback(() => {
        if (!selectedId)
            return;
        const newShapes = shapes.filter(s => s.id !== selectedId);
        setShapes(newShapes);
        setSelectedId(null);
        saveToHistory(newShapes);
        renderCanvas(newShapes);
    }, [selectedId, shapes, saveToHistory, renderCanvas]);
    // Handle keyboard for panning and deletion
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === "Space")
                setIsSpacePressed(true);
            if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
                if (!textInput?.open) {
                    deleteSelected();
                }
            }
        };
        const handleKeyUp = (e) => {
            if (e.code === "Space")
                setIsSpacePressed(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [selectedId, textInput, deleteSelected]);
    // Initialize and handle resize
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;
        const setupCanvas = () => {
            if (!offscreenCanvasRef.current) {
                offscreenCanvasRef.current = document.createElement("canvas");
            }
            const offscreen = offscreenCanvasRef.current;
            offscreen.width = canvasSize.width;
            offscreen.height = canvasSize.height;
            const offCtx = offscreen.getContext("2d");
            if (offCtx) {
                offCtx.fillStyle = "#0a0a0a";
                offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            }
            canvas.width = canvasSize.width;
            canvas.height = canvasSize.height;
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (historyStep >= 0) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    if (offCtx)
                        offCtx.drawImage(img, 0, 0);
                };
                img.src = history[historyStep].raster;
            }
            ctx.strokeStyle = "white";
            ctx.lineWidth = brushSize;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.font = "20px Inter, sans-serif";
        };
        setupCanvas();
    }, [canvasSize.width, canvasSize.height]);
    const handleCommitText = useCallback(() => {
        if (!textInput?.value.trim()) {
            setTextInput(null);
            return;
        }
        const canvas = canvasRef.current;
        const offscreen = offscreenCanvasRef.current;
        if (!canvas || !offscreen)
            return;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) {
            offCtx.fillStyle = "white";
            offCtx.font = "20px Inter, sans-serif";
            offCtx.fillText(textInput.value, textInput.x, textInput.y);
            saveToHistory();
            renderCanvas();
        }
        setTextInput(null);
    }, [textInput, saveToHistory, renderCanvas]);
    // Redraw when selection or tool changes
    useEffect(() => {
        renderCanvas();
        // Auto-commit text if tool changed away from text
        if (activeTool !== "text" && textInput?.open) {
            handleCommitText();
        }
    }, [selectedId, activeTool, renderCanvas, textInput, handleCommitText]);
    const undo = () => {
        if (historyStep <= 0)
            return;
        const prevStep = history[historyStep - 1];
        setShapes(prevStep.shapes);
        setHistoryStep(historyStep - 1);
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (offCtx && offscreen) {
            const img = new Image();
            img.onload = () => {
                offCtx.fillStyle = "#0a0a0a";
                offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
                offCtx.drawImage(img, 0, 0);
                renderCanvas(prevStep.shapes);
            };
            img.src = prevStep.raster;
        }
    };
    const redo = () => {
        if (historyStep >= history.length - 1)
            return;
        const nextStep = history[historyStep + 1];
        setShapes(nextStep.shapes);
        setHistoryStep(historyStep + 1);
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (offCtx && offscreen) {
            const img = new Image();
            img.onload = () => {
                offCtx.fillStyle = "#0a0a0a";
                offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
                offCtx.drawImage(img, 0, 0);
                renderCanvas(nextStep.shapes);
            };
            img.src = nextStep.raster;
        }
    };
    const discardAllChanges = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (ctx && canvas && offCtx && offscreen) {
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            offCtx.fillStyle = "#0a0a0a";
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            setHistory([]);
            setHistoryStep(-1);
            setShapes([]);
            setSelectedId(null);
            setShowDiscardModal(false);
        }
    };
    const getCoordinates = (e, shouldSnap = false) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
        const x = (clientX - rect.left) / zoom;
        const y = (clientY - rect.top) / zoom;
        return {
            x: shouldSnap ? snap(x) : x,
            y: shouldSnap ? snap(y) : y
        };
    };
    const startAction = (e) => {
        if (isSpacePressed || e.button === 1) {
            setIsPanning(true);
            return;
        }
        const { x, y } = getCoordinates(e);
        const snapped = getCoordinates(e, true);
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx)
            return;
        if (activeTool === "select") {
            const hit = [...shapes].reverse().find(s => {
                if (s.type === "rect") {
                    return x >= s.x && x <= s.x + (s.width || 0) && y >= s.y && y <= s.y + (s.height || 0);
                }
                else if (s.type === "circle") {
                    const dist = Math.sqrt((x - s.x) ** 2 + (y - s.y) ** 2);
                    return dist <= (s.radius || 0);
                }
                return false;
            });
            if (hit) {
                setSelectedId(hit.id);
                setDragOffset({ x: x - hit.x, y: y - hit.y });
                setIsDrawing(true);
            }
            else {
                setSelectedId(null);
            }
            return;
        }
        if (activeTool === "text" || textInput?.open) {
            if (textInput?.open) {
                handleCommitText();
            }
            else {
                setTextInput({ open: true, x, y, value: "" });
            }
            return;
        }
        if (activeTool === "shape") {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    setPreviewImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
                }
            }
            setShapeStartPos(snapped);
            setIsDrawing(true);
            return;
        }
        ctx.beginPath();
        const startPos = (activeTool === "pencil" || activeTool === "eraser") ? { x, y } : snapped;
        ctx.moveTo(startPos.x, startPos.y);
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (offCtx && (activeTool === "pencil" || activeTool === "eraser")) {
            offCtx.beginPath();
            offCtx.moveTo(startPos.x, startPos.y);
            offCtx.strokeStyle = activeTool === "eraser" ? "#0a0a0a" : "white";
            offCtx.lineWidth = activeTool === "eraser" ? brushSize * 5 : brushSize;
            offCtx.lineCap = "round";
            offCtx.lineJoin = "round";
        }
        if (activeTool === "link") {
            const hit = [...shapes].reverse().find(s => {
                if (s.type === "rect") {
                    return x >= s.x && x <= s.x + (s.width || 0) && y >= s.y && y <= s.y + (s.height || 0);
                }
                else if (s.type === "circle") {
                    const dist = Math.sqrt((x - s.x) ** 2 + (y - s.y) ** 2);
                    return dist <= (s.radius || 0);
                }
                return false;
            });
            if (hit) {
                setLinkSourceId(hit.id);
                setLinkTargetPos(snapped);
                setIsDrawing(true);
            }
            return;
        }
        ctx.strokeStyle = activeTool === "eraser" ? "#0a0a0a" : "white";
        ctx.lineWidth = activeTool === "eraser" ? brushSize * 5 : brushSize;
        setIsDrawing(true);
    };
    const moveAction = (e) => {
        if (isPanning) {
            const mouseEvent = e;
            setPan(prev => ({
                x: prev.x + mouseEvent.movementX,
                y: prev.y + mouseEvent.movementY
            }));
            return;
        }
        if (!isDrawing)
            return;
        const coords = getCoordinates(e);
        const snapped = getCoordinates(e, true);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas)
            return;
        if (activeTool === "link" && linkSourceId) {
            setLinkTargetPos(snapped);
            return;
        }
        if (activeTool === "select" && selectedId && dragOffset) {
            const newShapes = shapes.map(s => {
                if (s.id === selectedId) {
                    return { ...s, x: snap(coords.x - dragOffset.x), y: snap(coords.y - dragOffset.y) };
                }
                return s;
            });
            setShapes(newShapes);
            renderCanvas(newShapes);
            return;
        }
        if (activeTool === "shape" && shapeStartPos && previewImageData) {
            ctx.putImageData(previewImageData, 0, 0);
            ctx.strokeStyle = "white";
            ctx.lineWidth = brushSize;
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            const width = snapped.x - shapeStartPos.x;
            const height = snapped.y - shapeStartPos.y;
            if (selectedShape === "rect") {
                ctx.strokeRect(shapeStartPos.x, shapeStartPos.y, width, height);
                ctx.fillRect(shapeStartPos.x, shapeStartPos.y, width, height);
            }
            else if (selectedShape === "circle") {
                const radius = snap(Math.sqrt(width * width + height * height));
                ctx.beginPath();
                ctx.arc(shapeStartPos.x, shapeStartPos.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fill();
            }
            else if (selectedShape === "line") {
                ctx.beginPath();
                ctx.moveTo(shapeStartPos.x, shapeStartPos.y);
                ctx.lineTo(snapped.x, snapped.y);
                ctx.stroke();
            }
            return;
        }
        if (activeTool === "shape")
            return;
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (offCtx && (activeTool === "pencil" || activeTool === "eraser")) {
            offCtx.lineTo(coords.x, coords.y);
            offCtx.stroke();
        }
    };
    const endAction = (e) => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }
        if (isDrawing) {
            setIsDrawing(false);
            if (activeTool === "shape" && shapeStartPos) {
                const snapped = getCoordinates(e, true);
                const width = snapped.x - shapeStartPos.x;
                const height = snapped.y - shapeStartPos.y;
                const newShape = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: selectedShape,
                    x: shapeStartPos.x,
                    y: shapeStartPos.y,
                    width: selectedShape === "rect" ? width : undefined,
                    height: selectedShape === "rect" ? height : undefined,
                    radius: selectedShape === "circle" ? snap(Math.sqrt(width * width + height * height)) : undefined,
                    x2: selectedShape === "line" ? snapped.x : undefined,
                    y2: selectedShape === "line" ? snapped.y : undefined,
                };
                const updatedShapes = [...shapes, newShape];
                setShapes(updatedShapes);
                saveToHistory(updatedShapes);
                renderCanvas(updatedShapes);
            }
            else {
                saveToHistory();
                renderCanvas();
            }
            if (activeTool === "link" && linkSourceId) {
                // Find if we ended over a page in the sidebar? 
                // For simplicity, we'll open a "Select Target Page" popover if not handled.
                // But let's check hit testing for the sidebar via DOM if possible, or just a modal.
                setPreviewImageData(null); // Clear any remains
            }
            if (activeTool === "link" && linkSourceId) {
                // Wiring logic is handled by the popover that appears when linkSourceId is set but isDrawing is false
                setPreviewImageData(null);
            }
            setShapeStartPos(null);
            setPreviewImageData(null);
            setDragOffset(null);
        }
    };
    const handleWheel = (e) => {
        if (textInput?.open)
            return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.1 : 0.9;
            setZoom(prev => Math.min(Math.max(prev * factor, 0.5), 5));
        }
        else {
            setPan(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-screen bg-[#050505] overflow-hidden", children: [_jsxs("header", { className: "flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md z-20", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "p-2 hover:bg-white/5 rounded-full transition-colors group", children: _jsx(ChevronLeft, { className: "w-5 h-5 text-white/40 group-hover:text-white" }) }), _jsx("div", { className: "h-6 w-px bg-white/10" }), _jsxs("h1", { className: "text-sm font-medium tracking-tight text-white/80", children: ["Drawing Studio ", _jsx("span", { className: "text-white/20 font-mono text-xs", children: "v1.2" })] })] }), _jsxs("div", { className: "flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-[400px] px-2", children: [pages.map((page, i) => (_jsxs("button", { onClick: () => onPageChange(i), className: cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap", currentPageIndex === i
                                    ? "bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                    : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"), children: [_jsx("div", { className: cn("w-1 h-1 rounded-full", currentPageIndex === i ? "bg-blue-400" : "bg-white/20") }), page.name] }, page.id))), _jsx("button", { onClick: () => setShowAddPageModal(true), className: "p-1.5 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5 rounded-lg transition-all", title: "Add New Page", children: _jsx(Plus, { className: "w-3.5 h-3.5" }) })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2 glass px-3 py-1.5 rounded-xl border border-white/5 bg-white/5", children: [_jsx("input", { type: "number", value: canvasSize.width, onChange: (e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setCanvasSize(prev => ({ ...prev, width: Math.max(200, val) }));
                                        }, className: "w-12 bg-transparent text-[10px] font-mono text-white/60 focus:text-white focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", title: "Canvas Width" }), _jsx("span", { className: "text-[10px] text-white/20 font-mono", children: "x" }), _jsx("input", { type: "number", value: canvasSize.height, onChange: (e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setCanvasSize(prev => ({ ...prev, height: Math.max(200, val) }));
                                        }, className: "w-12 bg-transparent text-[10px] font-mono text-white/60 focus:text-white focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", title: "Canvas Height" })] }), _jsx("button", { onClick: () => canvasRef.current && onSubmit(canvasRef.current.toDataURL("image/png")), disabled: loading || historyStep < 0, className: cn("flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all", historyStep >= 0 && !loading ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"), children: loading ? "Processing..." : _jsxs(_Fragment, { children: [_jsx(Send, { className: "w-3.5 h-3.5" }), " Generate Code"] }) })] })] }), _jsxs("div", { className: "flex flex-1 relative overflow-hidden", children: [_jsxs("aside", { className: "absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 p-2 glass rounded-2xl border border-white/10 z-20", children: [[
                                { id: "select", icon: MousePointer2, label: "Select", slider: false },
                                { id: "pencil", icon: Pencil, label: "Pencil", slider: true },
                                { id: "eraser", icon: Eraser, label: "Eraser", slider: true },
                                { id: "shape", icon: Shapes, label: "Shapes", slider: false },
                                { id: "text", icon: Type, label: "Text", slider: false },
                                { id: "link", icon: LinkIcon, label: "Link", slider: false },
                            ].map((tool) => (_jsxs("div", { className: "relative group", children: [_jsxs("button", { onClick: () => {
                                            if (tool.id === "shape") {
                                                setActiveTool("shape");
                                                setIsShapeModalOpen(true);
                                                return;
                                            }
                                            if (tool.id === "link") {
                                                setActiveTool("link");
                                                return;
                                            }
                                            if (activeTool === tool.id && tool.slider) {
                                                setShowSettings(!showSettings);
                                            }
                                            else {
                                                setActiveTool(tool.id);
                                                setShowSettings(false);
                                                if (tool.id !== "select")
                                                    setSelectedId(null);
                                            }
                                        }, className: cn("p-3 rounded-xl transition-all relative", activeTool === tool.id ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "text-white/40 hover:bg-white/5 hover:text-white/60"), title: tool.label, children: [_jsx(tool.icon, { className: "w-5 h-5" }), tool.slider && activeTool === tool.id && (_jsx("div", { className: "absolute -bottom-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full border border-black" }))] }), tool.id === "shape" && isShapeModalOpen && (_jsx("div", { className: "absolute left-full ml-4 top-0 p-4 glass rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-left-2 z-50 min-w-[200px]", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-widest text-white/40", children: "Select Shape" }), _jsx("button", { onClick: () => setIsShapeModalOpen(false), className: "text-white/20 hover:text-white/60", children: _jsx(X, { className: "w-3.5 h-3.5" }) })] }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                                                        { id: "rect", icon: Square, label: "Rectangle" },
                                                        { id: "circle", icon: CircleIcon, label: "Circle" },
                                                        { id: "line", icon: Minus, label: "Line" },
                                                    ].map((shape) => (_jsxs("button", { onClick: () => {
                                                            setSelectedShape(shape.id);
                                                            setIsShapeModalOpen(false);
                                                        }, className: cn("flex flex-col items-center gap-2 p-3 rounded-xl border transition-all", selectedShape === shape.id && activeTool === "shape"
                                                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                                            : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white"), children: [_jsx(shape.icon, { className: "w-5 h-5" }), _jsx("span", { className: "text-[9px] font-medium uppercase tracking-wider", children: shape.label })] }, shape.id))) })] }) })), activeTool === tool.id && tool.slider && showSettings && (_jsx("div", { className: "absolute left-full ml-4 top-0 p-4 glass rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-left-2 z-30 min-w-[120px]", children: _jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-widest text-white/40", children: "Tool Size" }), _jsx("input", { type: "range", min: "1", max: "100", step: "1", value: brushSize, onChange: (e) => setBrushSize(parseInt(e.target.value)), className: "w-full h-1.5 appearance-none bg-white/5 rounded-full border border-white/5 cursor-pointer" }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("span", { className: "text-[10px] font-mono text-white/30", children: [brushSize, "px"] }), _jsx("button", { onClick: () => setShowSettings(false), className: "text-[10px] text-blue-400 hover:text-blue-300 uppercase tracking-wider", children: "Done" })] })] }) }))] }, tool.id))), _jsx("div", { className: "h-px bg-white/10 mx-2" })] }), _jsx("main", { onWheel: handleWheel, className: "flex-1 flex items-center justify-center p-12 overflow-hidden bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:20px_20px]", children: _jsxs("div", { style: { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }, className: "shadow-[0_0_100px_rgba(255,255,255,0.05)] border border-white/10 rounded-lg shrink-0 origin-center relative", children: [_jsx("canvas", { ref: canvasRef, onMouseDown: startAction, onMouseMove: moveAction, onMouseUp: endAction, onMouseLeave: endAction, onTouchStart: startAction, onTouchMove: moveAction, onTouchEnd: endAction, className: "bg-[#0a0a0a] touch-none cursor-crosshair block" }), selectedId && shapes.find(s => s.id === selectedId) && (() => {
                                    const s = shapes.find(shape => shape.id === selectedId);
                                    let bx = s.x, by = s.y, bw = s.width || 0, bh = s.height || 0;
                                    if (s.type === "circle" && s.radius) {
                                        bx = s.x - s.radius;
                                        by = s.y - s.radius;
                                        bw = s.radius * 2;
                                        bh = s.radius * 2;
                                    }
                                    else if (s.type === "line" && s.x2 !== undefined && s.y2 !== undefined) {
                                        bx = Math.min(s.x, s.x2);
                                        by = Math.min(s.y, s.y2);
                                        bw = Math.abs(s.x2 - s.x);
                                        bh = Math.abs(s.y2 - s.y);
                                    }
                                    return (_jsx("button", { onClick: (e) => {
                                            e.stopPropagation();
                                            deleteSelected();
                                        }, className: "absolute z-[120] p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110 active:scale-95 animate-in zoom-in-50 fade-in duration-200", style: {
                                            left: bx + bw + 8,
                                            top: by - 8,
                                            transform: 'translate(-50%, -50%)'
                                        }, title: "Delete Shape", children: _jsx(X, { className: "w-3.5 h-3.5" }) }));
                                })(), _jsx("div", { className: "absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-center justify-center group/resize", onMouseDown: (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsResizing(true);
                                        const startX = e.clientX;
                                        const startY = e.clientY;
                                        const startWidth = canvasSize.width;
                                        const startHeight = canvasSize.height;
                                        const handleMouseMove = (me) => {
                                            setCanvasSize({
                                                width: Math.max(200, Math.round(startWidth + (me.clientX - startX) / zoom)),
                                                height: Math.max(200, Math.round(startHeight + (me.clientY - startY) / zoom))
                                            });
                                        };
                                        const handleMouseUp = () => {
                                            setIsResizing(false);
                                            window.removeEventListener("mousemove", handleMouseMove);
                                            window.removeEventListener("mouseup", handleMouseUp);
                                        };
                                        window.addEventListener("mousemove", handleMouseMove);
                                        window.addEventListener("mouseup", handleMouseUp);
                                    }, children: _jsx("div", { className: "w-2 h-2 border-r-2 border-b-2 border-white/20 group-hover/resize:border-blue-400 transition-colors" }) }), textInput?.open && (_jsxs("div", { className: "absolute z-[110] flex items-center gap-2 group", style: { left: textInput.x, top: textInput.y, transform: 'translate(-2px, -50%)' }, children: [_jsx("input", { autoFocus: true, type: "text", value: textInput.value, onChange: (e) => setTextInput({ ...textInput, value: e.target.value }), onKeyDown: (e) => {
                                                if (e.key === "Enter") {
                                                    handleCommitText();
                                                }
                                                if (e.key === "Escape")
                                                    setTextInput(null);
                                            }, className: "bg-transparent border border-white/40 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white min-w-[120px]", placeholder: "Type element name..." }), _jsx("button", { onClick: handleCommitText, className: "p-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-white", children: _jsx(CornerDownLeft, { className: "w-3 h-3" }) })] })), _jsxs("svg", { className: "absolute inset-0 w-full h-full pointer-events-none z-[100]", children: [pages[currentPageIndex] && wirings.filter(w => w.sourcePageId === pages[currentPageIndex].id).map((wiring, i) => {
                                            const source = shapes.find(s => s.id === wiring.sourceElementId);
                                            if (!source)
                                                return null;
                                            const targetPageIndex = pages.findIndex(p => p.id === wiring.targetPageId);
                                            if (targetPageIndex === -1)
                                                return null;
                                            return (_jsxs("g", { children: [_jsx("path", { d: `M ${source.x + (source.width || 0) / 2} ${source.y + (source.height || 0) / 2} L ${canvasSize.width} ${canvasSize.height / 2}`, fill: "none", stroke: "rgba(16, 185, 129, 0.4)", strokeWidth: "2", strokeDasharray: "4 4" }), _jsxs("text", { x: canvasSize.width - 10, y: canvasSize.height / 2, fill: "#10b981", fontSize: "10", textAnchor: "end", className: "font-mono", children: ["\u2794 ", pages[targetPageIndex].name] })] }, i));
                                        }), activeTool === "link" && linkSourceId && linkTargetPos && (_jsx("line", { x1: (shapes.find(s => s.id === linkSourceId)?.x ?? 0) + (shapes.find(s => s.id === linkSourceId)?.width || 0) / 2, y1: (shapes.find(s => s.id === linkSourceId)?.y ?? 0) + (shapes.find(s => s.id === linkSourceId)?.height || 0) / 2, x2: linkTargetPos.x, y2: linkTargetPos.y, stroke: "#10b981", strokeWidth: "2", strokeDasharray: "4 4" }))] })] }) }), _jsxs("aside", { className: "absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 p-2 glass rounded-2xl border border-white/10 z-20", children: [_jsx("button", { onClick: undo, disabled: historyStep <= 0, className: cn("p-3 rounded-xl transition-all", historyStep <= 0 ? "opacity-20 cursor-not-allowed" : "text-white/40 hover:bg-white/5 hover:text-white/60"), title: "Undo (Ctrl+Z)", children: _jsx(Undo2, { className: "w-5 h-5" }) }), _jsx("button", { onClick: redo, disabled: historyStep >= history.length - 1, className: cn("p-3 rounded-xl transition-all", historyStep >= history.length - 1 ? "opacity-20 cursor-not-allowed" : "text-white/40 hover:bg-white/5 hover:text-white/60"), title: "Redo (Ctrl+Y)", children: _jsx(Redo2, { className: "w-5 h-5" }) }), _jsx("div", { className: "h-px bg-white/10 mx-2" }), _jsx("button", { onClick: () => setShowDiscardModal(true), className: "p-3 rounded-xl text-red-400/40 hover:bg-red-400/5 hover:text-red-400 transition-all", title: "Discard All Changes", children: _jsx(RotateCcw, { className: "w-5 h-5" }) }), _jsx("div", { className: "h-px bg-white/10 mx-2" }), _jsxs("div", { className: "flex flex-col items-center gap-4 py-2", children: [_jsxs("button", { onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }); }, className: "text-[10px] font-bold text-white/40 hover:text-white transition-all py-1 px-2 rounded-md hover:bg-white/5", title: "Reset View", children: [Math.round(zoom * 100), "%"] }), _jsx("div", { className: "relative group/slider flex flex-col items-center h-32 w-10", children: _jsx("div", { className: "absolute inset-0 flex items-center justify-center py-2", children: _jsx("input", { type: "range", min: "0.5", max: "5", step: "0.1", value: zoom, onChange: (e) => setZoom(parseFloat(e.target.value)), className: "h-full w-1.5 appearance-none bg-blue-500/10 rounded-full border border-white/5 cursor-pointer accent-blue-500 [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]", style: {}, title: "Zoom" }) }) }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("button", { onClick: () => setZoom(prev => Math.min(prev + 0.5, 5)), className: "p-1.5 text-white/20 hover:text-white transition-all", title: "Zoom In", children: _jsx(Plus, { className: "w-3.5 h-3.5" }) }), _jsx("button", { onClick: () => setZoom(prev => Math.max(prev - 0.5, 0.5)), className: "p-1.5 text-white/20 hover:text-white transition-all", title: "Zoom Out", children: _jsx(Minus, { className: "w-3.5 h-3.5" }) })] })] })] })] }), activeTool === "link" && linkSourceId && !isDrawing && linkTargetPos && (_jsx("div", { className: "absolute z-[300] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95", style: {
                    left: Math.min(window.innerWidth - 200, linkTargetPos.x * zoom + pan.x + 250),
                    top: linkTargetPos.y * zoom + pan.y + 100
                }, children: _jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 mb-2", children: [_jsx("span", { className: "text-[10px] font-bold uppercase tracking-widest text-emerald-400", children: "Link to Page" }), _jsx("button", { onClick: () => { setLinkSourceId(null); setLinkTargetPos(null); }, className: "text-white/20 hover:text-white/60", children: _jsx(XIcon, { className: "w-3.5 h-3.5" }) })] }), pages.map((page) => (_jsxs("button", { onClick: () => {
                                if (linkSourceId) {
                                    onAddWiring(linkSourceId, page.id);
                                }
                                setLinkSourceId(null);
                                setLinkTargetPos(null);
                            }, className: "flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-left transition-all group", children: [_jsx(FileText, { className: "w-4 h-4 text-white/20 group-hover:text-blue-400" }), _jsx("span", { className: "text-xs text-white/60 group-hover:text-white", children: page.name })] }, page.id)))] }) })), showDiscardModal && (_jsxs("div", { className: "absolute inset-0 z-[200] flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-md", onClick: () => setShowDiscardModal(false) }), _jsx("div", { className: "relative w-full max-w-sm glass-card p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200", children: _jsxs("div", { className: "flex flex-col items-center text-center gap-6", children: [_jsx("div", { className: "w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center", children: _jsx(RotateCcw, { className: "w-8 h-8 text-red-400" }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-xl font-bold text-white tracking-tight", children: "Discard All Changes?" }), _jsx("p", { className: "text-xs text-white/40 leading-relaxed", children: "All your progress in this session will be permanently erased. This action cannot be undone." })] }), _jsxs("div", { className: "flex gap-3 w-full", children: [_jsx("button", { onClick: () => setShowDiscardModal(false), className: "flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", children: "Cancel" }), _jsx("button", { onClick: discardAllChanges, className: "flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all", children: "Discard" })] })] }) })] })), showAddPageModal && (_jsxs("div", { className: "absolute inset-0 z-[400] flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-md", onClick: () => setShowAddPageModal(false) }), _jsx("div", { className: "relative w-full max-w-sm glass-card p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200", children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20", children: _jsx(Plus, { className: "w-6 h-6 text-blue-400" }) }), _jsxs("div", { className: "space-y-1", children: [_jsx("h2", { className: "text-xl font-bold text-white tracking-tight", children: "Add New Page" }), _jsx("p", { className: "text-xs text-white/40", children: "Give your page a descriptive name" })] })] }), _jsx("input", { autoFocus: true, type: "text", value: newPageName, onChange: (e) => setNewPageName(e.target.value), onKeyDown: (e) => {
                                        if (e.key === "Enter" && newPageName.trim()) {
                                            onAddPage(newPageName.trim());
                                            setNewPageName("");
                                            setShowAddPageModal(false);
                                        }
                                        if (e.key === "Escape")
                                            setShowAddPageModal(false);
                                    }, placeholder: "e.g., About Us, Contact, Dashboard", className: "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/20" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => setShowAddPageModal(false), className: "flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", children: "Cancel" }), _jsx("button", { disabled: !newPageName.trim(), onClick: () => {
                                                onAddPage(newPageName.trim());
                                                setNewPageName("");
                                                setShowAddPageModal(false);
                                            }, className: "flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all font-mono", children: "Create Page" })] })] }) })] }))] }));
}
//# sourceMappingURL=StudioCanvas.js.map