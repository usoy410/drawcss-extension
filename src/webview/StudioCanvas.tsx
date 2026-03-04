"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
    Pencil,
    Eraser,
    Type,
    Undo2,
    Redo2,
    RotateCcw,
    Monitor,
    Smartphone,
    X,
    CornerDownLeft,
    Send,
    Square,
    Circle as CircleIcon,
    Minus,
    Shapes,
    MousePointer2,
    Plus,
    Trash2,
    FileText,
    LayoutTemplate,
    MoveUpRight,
    X as XIcon,
    Edit2,
} from "lucide-react";
import { cn } from "./lib/utils.js";

import { ComponentDesign } from "./types/project.js";

interface StudioCanvasProps {
    onSubmit: (base64: string, instructions?: string) => void;
    loading?: boolean;
    components: ComponentDesign[];
    currentComponentIndex: number;
    onComponentChange: (index: number) => void;
    onAddComponent: (name: string) => void;
    onDeleteComponent: (id: string) => void;
    onRenameComponent: (id: string, name: string) => void;
    onSaveState: (shapes: Shape[], raster: string) => void;
}

type Tool = "pencil" | "eraser" | "text" | "shape" | "select";
type ShapeType = "rect" | "circle" | "line";

export interface Shape {
    id: string;
    type: ShapeType;
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    x2?: number; // for line
    y2?: number; // for line
}

interface HistoryStep {
    raster: string;
    shapes: Shape[];
}

export function StudioCanvas({
    onSubmit,
    loading,
    components,
    currentComponentIndex,
    onComponentChange,
    onAddComponent,
    onDeleteComponent,
    onRenameComponent,
    onSaveState
}: StudioCanvasProps) {
    const isFirstRender = useRef(true);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [activeTool, setActiveTool] = useState<Tool>("pencil");
    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
    const [isResizing, setIsResizing] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [brushSize, setBrushSize] = useState(3);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [showSettings, setShowSettings] = useState(false);
    const [textInput, setTextInput] = useState<{ open: boolean, x: number, y: number, value: string } | null>(null);
    const [selectedShape, setSelectedShape] = useState<ShapeType>("rect");
    const [isShapeModalOpen, setIsShapeModalOpen] = useState(false);
    const [shapeStartPos, setShapeStartPos] = useState<{ x: number, y: number } | null>(null);
    const [previewImageData, setPreviewImageData] = useState<ImageData | null>(null);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [showAddComponentModal, setShowAddComponentModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [additionalInstructions, setAdditionalInstructions] = useState("");
    const [newComponentName, setNewComponentName] = useState("");

    const [shapes, setShapes] = useState<Shape[]>([]);
    const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
    const [editingComponentName, setEditingComponentName] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number, y: number } | null>(null);
    const gridSize = 20;

    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [history, setHistory] = useState<HistoryStep[]>([]);
    const [historyStep, setHistoryStep] = useState(-1);

    const snap = (val: number) => Math.round(val / gridSize) * gridSize;

    const renderCanvas = useCallback((currentShapes?: Shape[]) => {
        const canvas = canvasRef.current;
        const offscreen = offscreenCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas || !offscreen) return;

        // Clear and draw offscreen (raster)
        ctx.fillStyle = "#121212";
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
            } else if (shape.type === "circle") {
                if (shape.radius !== undefined) {
                    ctx.beginPath();
                    ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fill();
                }
            } else if (shape.type === "line") {
                if (shape.x2 !== undefined && shape.y2 !== undefined) {
                    ctx.beginPath();
                    ctx.moveTo(shape.x, shape.y);
                    ctx.lineTo(shape.x2, shape.y2);
                    ctx.stroke();
                }
            }
        });
    }, [shapes, selectedId, brushSize]);

    const saveToHistory = useCallback((currentShapes?: Shape[]) => {
        const canvas = canvasRef.current;
        const offscreen = offscreenCanvasRef.current;
        if (!canvas || !offscreen) return;

        const newStep: HistoryStep = {
            raster: offscreen.toDataURL(),
            shapes: [...(currentShapes || shapes)]
        };
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newStep);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);

        onSaveState(newStep.shapes, newStep.raster);
    }, [history, historyStep, shapes, onSaveState]);

    const deleteSelected = useCallback(() => {
        if (!selectedId) return;
        const newShapes = shapes.filter(s => s.id !== selectedId);
        setShapes(newShapes);
        setSelectedId(null);
        saveToHistory(newShapes);
        renderCanvas(newShapes);
    }, [selectedId, shapes, saveToHistory, renderCanvas]);

    // Handle component switching
    useEffect(() => {
        const component = components[currentComponentIndex];
        if (!component) return;

        setShapes(component.shapes || []);
        setHistory([]);
        setHistoryStep(-1);

        const canvas = canvasRef.current;
        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        const ctx = canvas?.getContext("2d");

        if (offCtx && offscreen && ctx && canvas) {
            offCtx.fillStyle = "#121212";
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            ctx.fillStyle = "#121212";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (component.raster) {
                const img = new Image();
                img.onload = () => {
                    offCtx.drawImage(img, 0, 0);
                    ctx.drawImage(img, 0, 0);
                    renderCanvas(component.shapes || []);
                };
                img.src = component.raster;
            } else {
                renderCanvas(component.shapes || []);
            }
        }
    }, [currentComponentIndex, components[currentComponentIndex]?.id]);

    // Handle keyboard for panning and deletion
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") setIsSpacePressed(true);
            if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
                if (!textInput?.open) {
                    deleteSelected();
                }
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === "Space") setIsSpacePressed(false);
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
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const setupCanvas = () => {
            if (!offscreenCanvasRef.current) {
                offscreenCanvasRef.current = document.createElement("canvas");
            }
            const offscreen = offscreenCanvasRef.current;
            offscreen.width = canvasSize.width;
            offscreen.height = canvasSize.height;

            const offCtx = offscreen.getContext("2d");
            if (offCtx) {
                offCtx.fillStyle = "#121212";
                offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            }

            canvas.width = canvasSize.width;
            canvas.height = canvasSize.height;

            ctx.fillStyle = "#121212";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (historyStep >= 0) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    if (offCtx) offCtx.drawImage(img, 0, 0);
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
        if (!canvas || !offscreen) return;

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
        if (historyStep <= 0) return;
        const prevStep = history[historyStep - 1];
        setShapes(prevStep.shapes);
        setHistoryStep(historyStep - 1);

        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (offCtx && offscreen) {
            const img = new Image();
            img.onload = () => {
                offCtx.fillStyle = "#121212";
                offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
                offCtx.drawImage(img, 0, 0);
                renderCanvas(prevStep.shapes);
            };
            img.src = prevStep.raster;
        }
    };

    const redo = () => {
        if (historyStep >= history.length - 1) return;
        const nextStep = history[historyStep + 1];
        setShapes(nextStep.shapes);
        setHistoryStep(historyStep + 1);

        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (offCtx && offscreen) {
            const img = new Image();
            img.onload = () => {
                offCtx.fillStyle = "#121212";
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
            ctx.fillStyle = "#121212";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            offCtx.fillStyle = "#121212";
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            setHistory([]);
            setHistoryStep(-1);
            setShapes([]);
            setSelectedId(null);
            setShowDiscardModal(false);
            onSaveState([], "#121212");
        }
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, shouldSnap = false) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const x = (clientX - rect.left) / zoom;
        const y = (clientY - rect.top) / zoom;

        return {
            x: shouldSnap ? snap(x) : x,
            y: shouldSnap ? snap(y) : y
        };
    };

    const startAction = (e: React.MouseEvent | React.TouchEvent) => {
        if (isSpacePressed || (e as React.MouseEvent).button === 1) {
            setIsPanning(true);
            return;
        }

        const { x, y } = getCoordinates(e);
        const snapped = getCoordinates(e, true);
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        if (activeTool === "select") {
            const hit = [...shapes].reverse().find(s => {
                if (s.type === "rect") {
                    return x >= s.x && x <= s.x + (s.width || 0) && y >= s.y && y <= s.y + (s.height || 0);
                } else if (s.type === "circle") {
                    const dist = Math.sqrt((x - s.x) ** 2 + (y - s.y) ** 2);
                    return dist <= (s.radius || 0);
                }
                return false;
            });

            if (hit) {
                setSelectedId(hit.id);
                setDragOffset({ x: x - hit.x, y: y - hit.y });
                setIsDrawing(true);
            } else {
                setSelectedId(null);
            }
            return;
        }

        if (activeTool === "text" || textInput?.open) {
            if (textInput?.open) {
                handleCommitText();
            } else {
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
            offCtx.strokeStyle = activeTool === "eraser" ? "#121212" : "white";
            offCtx.lineWidth = activeTool === "eraser" ? brushSize * 5 : brushSize;
            offCtx.lineCap = "round";
            offCtx.lineJoin = "round";
        }

        ctx.strokeStyle = activeTool === "eraser" ? "#121212" : "white";
        ctx.lineWidth = activeTool === "eraser" ? brushSize * 5 : brushSize;
        setIsDrawing(true);
    };

    const moveAction = (e: React.MouseEvent | React.TouchEvent) => {
        if (isPanning) {
            const mouseEvent = e as React.MouseEvent;
            setPan(prev => ({
                x: prev.x + mouseEvent.movementX,
                y: prev.y + mouseEvent.movementY
            }));
            return;
        }

        if (!isDrawing) return;
        const coords = getCoordinates(e);
        const snapped = getCoordinates(e, true);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;


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
            } else if (selectedShape === "circle") {
                const radius = snap(Math.sqrt(width * width + height * height));
                ctx.beginPath();
                ctx.arc(shapeStartPos.x, shapeStartPos.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fill();
            } else if (selectedShape === "line") {
                ctx.beginPath();
                ctx.moveTo(shapeStartPos.x, shapeStartPos.y);
                ctx.lineTo(snapped.x, snapped.y);
                ctx.stroke();
            }
            return;
        }

        if (activeTool === "shape") return;

        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        const offscreen = offscreenCanvasRef.current;
        const offCtx = offscreen?.getContext("2d");
        if (offCtx && (activeTool === "pencil" || activeTool === "eraser")) {
            offCtx.lineTo(coords.x, coords.y);
            offCtx.stroke();
        }
    };

    const endAction = (e: React.MouseEvent | React.TouchEvent) => {
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
                const newShape: Shape = {
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
            } else {
                saveToHistory();
                renderCanvas();
            }

            setShapeStartPos(null);
            setPreviewImageData(null);
            setDragOffset(null);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (textInput?.open) return;
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.1 : 0.9;
            setZoom(prev => Math.min(Math.max(prev * factor, 0.5), 5));
        } else {
            setPan(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#050505] overflow-hidden relative">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md z-20">
                <div className="flex items-center gap-4">
                    <h1 className="text-sm font-medium tracking-tight text-white/80">Component Studio <span className="text-white/20 font-mono text-xs">v1.2</span></h1>
                </div>

                {/* Pages List in Top Left (relative to canvas or fixed in header) - Moving to absolute overlay for better positioning */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-[400px] px-2">
                    {components.map((comp, i) => (
                        <div key={comp.id} className="relative group/page">
                            {editingComponentId === comp.id ? (
                                <input
                                    autoFocus
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 border border-blue-500/50 text-blue-400 outline-none w-[100px]"
                                    value={editingComponentName}
                                    onChange={(e) => setEditingComponentName(e.target.value)}
                                    onBlur={() => {
                                        if (editingComponentName.trim() && editingComponentName !== comp.name) {
                                            onRenameComponent(comp.id, editingComponentName.trim());
                                        }
                                        setEditingComponentId(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            if (editingComponentName.trim()) {
                                                onRenameComponent(comp.id, editingComponentName.trim());
                                            }
                                            setEditingComponentId(null);
                                        }
                                        if (e.key === "Escape") setEditingComponentId(null);
                                    }}
                                />
                            ) : (
                                <button
                                    onClick={() => onComponentChange(i)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap group/tab",
                                        currentComponentIndex === i
                                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                            : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                                    )}
                                >
                                    <div className={cn(
                                        "w-1 h-1 rounded-full",
                                        currentComponentIndex === i ? "bg-blue-400" : "bg-white/20"
                                    )} />
                                    <span>{comp.name}</span>
                                    <Edit2
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingComponentId(comp.id);
                                            setEditingComponentName(comp.name);
                                        }}
                                        className="w-3 h-3 opacity-0 group-hover/tab:opacity-100 transition-opacity hover:text-white"
                                    />
                                </button>
                            )}
                            {components.length > 1 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteComponent(comp.id);
                                    }}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/page:opacity-100 transition-opacity z-30"
                                >
                                    <X className="w-2 h-2" />
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={() => setShowAddComponentModal(true)}
                        className="p-1.5 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5 rounded-lg transition-all"
                        title="Add New Component"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-xl border border-white/5 bg-white/5">
                        <input
                            type="number"
                            value={canvasSize.width}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setCanvasSize(prev => ({ ...prev, width: Math.max(200, val) }));
                            }}
                            className="w-12 bg-transparent text-[10px] font-mono text-white/60 focus:text-white focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Canvas Width"
                        />
                        <span className="text-[10px] text-white/20 font-mono">x</span>
                        <input
                            type="number"
                            value={canvasSize.height}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setCanvasSize(prev => ({ ...prev, height: Math.max(200, val) }));
                            }}
                            className="w-12 bg-transparent text-[10px] font-mono text-white/60 focus:text-white focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Canvas Height"
                        />
                    </div>

                    <button
                        onClick={() => setShowGenerateModal(true)}
                        disabled={loading || historyStep < 0}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                            historyStep >= 0 && !loading ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
                        )}
                    >
                        {loading ? "Processing..." : <><Send className="w-3.5 h-3.5" /> Generate Code</>}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 relative overflow-hidden">
                <aside className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 p-2 glass rounded-2xl border border-white/10 z-20">
                    {[
                        { id: "select", icon: MousePointer2, label: "Select", slider: false },
                        { id: "pencil", icon: Pencil, label: "Pencil", slider: true },
                        { id: "eraser", icon: Eraser, label: "Eraser", slider: true },
                        { id: "shape", icon: Shapes, label: "Shapes", slider: false },
                        { id: "text", icon: Type, label: "Text", slider: false },
                    ].map((tool) => (
                        <div key={tool.id} className="relative group">
                            <button
                                onClick={() => {
                                    if (tool.id === "shape") {
                                        setActiveTool("shape");
                                        setIsShapeModalOpen(true);
                                        return;
                                    }
                                    if (activeTool === tool.id && tool.slider) {
                                        setShowSettings(!showSettings);
                                    } else {
                                        setActiveTool(tool.id as Tool);
                                        setShowSettings(false);
                                        if (tool.id !== "select") setSelectedId(null);
                                    }
                                }}
                                className={cn(
                                    "p-3 rounded-xl transition-all relative",
                                    activeTool === tool.id ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "text-white/40 hover:bg-white/5 hover:text-white/60"
                                )}
                                title={tool.label}
                            >
                                <tool.icon className="w-5 h-5" />
                                {tool.slider && activeTool === tool.id && (
                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full border border-black" />
                                )}
                            </button>

                            {tool.id === "shape" && isShapeModalOpen && (
                                <div className="absolute left-full ml-4 top-0 p-4 glass rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-left-2 z-50 min-w-[200px]">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Select Shape</span>
                                            <button onClick={() => setIsShapeModalOpen(false)} className="text-white/20 hover:text-white/60">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: "rect", icon: Square, label: "Rectangle" },
                                                { id: "circle", icon: CircleIcon, label: "Circle" },
                                                { id: "line", icon: Minus, label: "Line" },
                                            ].map((shape) => (
                                                <button
                                                    key={shape.id}
                                                    onClick={() => {
                                                        setSelectedShape(shape.id as ShapeType);
                                                        setIsShapeModalOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                                                        selectedShape === shape.id && activeTool === "shape"
                                                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                                                            : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                                                    )}
                                                >
                                                    <shape.icon className="w-5 h-5" />
                                                    <span className="text-[9px] font-medium uppercase tracking-wider">{shape.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTool === tool.id && tool.slider && showSettings && (
                                <div className="absolute left-full ml-4 top-0 p-4 glass rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-left-2 z-30 min-w-[120px]">
                                    <div className="flex flex-col gap-3">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tool Size</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={brushSize}
                                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                            className="w-full h-1.5 appearance-none bg-white/5 rounded-full border border-white/5 cursor-pointer"
                                        />
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-mono text-white/30">{brushSize}px</span>
                                            <button onClick={() => setShowSettings(false)} className="text-[10px] text-blue-400 hover:text-blue-300 uppercase tracking-wider">Done</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="h-px bg-white/10 mx-2" />
                </aside>

                <main onWheel={handleWheel} className="flex-1 flex items-center justify-center p-12 overflow-hidden bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:20px_20px]">
                    <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} className="shadow-[0_0_100px_rgba(255,255,255,0.1)] border-2 border-white/25 rounded-lg shrink-0 origin-center relative">
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startAction}
                            onMouseMove={moveAction}
                            onMouseUp={endAction}
                            onMouseLeave={endAction}
                            onTouchStart={startAction}
                            onTouchMove={moveAction}
                            onTouchEnd={endAction}
                            className="bg-[#121212] touch-none cursor-crosshair block"
                        />

                        {/* Contextual Delete Button */}
                        {selectedId && shapes.find(s => s.id === selectedId) && (() => {
                            const s = shapes.find(shape => shape.id === selectedId)!;
                            let bx = s.x, by = s.y, bw = s.width || 0, bh = s.height || 0;

                            if (s.type === "circle" && s.radius) {
                                bx = s.x - s.radius;
                                by = s.y - s.radius;
                                bw = s.radius * 2;
                                bh = s.radius * 2;
                            } else if (s.type === "line" && s.x2 !== undefined && s.y2 !== undefined) {
                                bx = Math.min(s.x, s.x2);
                                by = Math.min(s.y, s.y2);
                                bw = Math.abs(s.x2 - s.x);
                                bh = Math.abs(s.y2 - s.y);
                            }

                            return (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteSelected();
                                    }}
                                    className="absolute z-[120] p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110 active:scale-95 animate-in zoom-in-50 fade-in duration-200"
                                    style={{
                                        left: bx + bw + 8,
                                        top: by - 8,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    title="Delete Shape"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            );
                        })()}
                        <div
                            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-center justify-center group/resize"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsResizing(true);
                                const startX = e.clientX;
                                const startY = e.clientY;
                                const startWidth = canvasSize.width;
                                const startHeight = canvasSize.height;
                                const handleMouseMove = (me: MouseEvent) => {
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
                            }}
                        >
                            <div className="w-2 h-2 border-r-2 border-b-2 border-white/20 group-hover/resize:border-blue-400 transition-colors" />
                        </div>
                        {textInput?.open && (
                            <div className="absolute z-[110] flex items-center gap-2 group" style={{ left: textInput.x, top: textInput.y, transform: 'translate(-2px, -50%)' }}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={textInput.value}
                                    onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleCommitText();
                                        }
                                        if (e.key === "Escape") setTextInput(null);
                                    }}
                                    className="bg-transparent border border-white/40 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white min-w-[120px]"
                                    placeholder="Type element name..."
                                />
                                <button onClick={handleCommitText} className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-white"><CornerDownLeft className="w-3 h-3" /></button>
                            </div>
                        )}

                    </div>
                </main>

                {/* Right Actions Sidebar - Redesigned to match left toolbar */}
                <aside className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 p-2 glass rounded-2xl border border-white/10 z-20">
                    <button
                        onClick={undo}
                        disabled={historyStep <= 0}
                        className={cn(
                            "p-3 rounded-xl transition-all",
                            historyStep <= 0 ? "opacity-20 cursor-not-allowed" : "text-white/40 hover:bg-white/5 hover:text-white/60"
                        )}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyStep >= history.length - 1}
                        className={cn(
                            "p-3 rounded-xl transition-all",
                            historyStep >= history.length - 1 ? "opacity-20 cursor-not-allowed" : "text-white/40 hover:bg-white/5 hover:text-white/60"
                        )}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="w-5 h-5" />
                    </button>
                    <div className="h-px bg-white/10 mx-2" />
                    <button
                        onClick={() => setShowDiscardModal(true)}
                        className="p-3 rounded-xl text-red-400/40 hover:bg-red-400/5 hover:text-red-400 transition-all"
                        title="Discard All Changes"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                    <div className="h-px bg-white/10 mx-2" />
                    <div className="flex flex-col items-center gap-4 py-2">
                        <button
                            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                            className="text-[10px] font-bold text-white/40 hover:text-white transition-all py-1 px-2 rounded-md hover:bg-white/5"
                            title="Reset View"
                        >
                            {Math.round(zoom * 100)}%
                        </button>

                        <div className="relative group/slider flex flex-col items-center h-32 w-10">
                            <div className="absolute inset-0 flex items-center justify-center py-2">
                                <input
                                    type="range"
                                    min="0.5"
                                    max="5"
                                    step="0.1"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="h-full w-1.5 appearance-none bg-blue-500/10 rounded-full border border-white/5 cursor-pointer accent-blue-500 [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
                                    style={{}}
                                    title="Zoom"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <button
                                onClick={() => setZoom(prev => Math.min(prev + 0.5, 5))}
                                className="p-1.5 text-white/20 hover:text-white transition-all"
                                title="Zoom In"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))}
                                className="p-1.5 text-white/20 hover:text-white transition-all"
                                title="Zoom Out"
                            >
                                <Minus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </aside>
            </div>


            {/* Discard Confirmation Modal */}
            {
                showDiscardModal && (
                    <div className="absolute inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowDiscardModal(false)} />
                        <div className="relative w-full max-w-sm glass-card p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <RotateCcw className="w-8 h-8 text-red-400" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-white tracking-tight">Discard All Changes?</h2>
                                    <p className="text-xs text-white/40 leading-relaxed">
                                        All your progress in this session will be permanently erased. This action cannot be undone.
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={() => setShowDiscardModal(false)}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={discardAllChanges}
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all"
                                    >
                                        Discard
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Component Modal */}
            {
                showAddComponentModal && (
                    <div className="absolute inset-0 z-[400] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAddComponentModal(false)} />
                        <div className="relative w-full max-w-sm glass-card p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                        <Plus className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-xl font-bold text-white tracking-tight">Add New Component</h2>
                                        <p className="text-xs text-white/40">Give your component a descriptive name</p>
                                    </div>
                                </div>

                                <input
                                    autoFocus
                                    type="text"
                                    value={newComponentName}
                                    onChange={(e) => setNewComponentName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newComponentName.trim()) {
                                            onAddComponent(newComponentName.trim());
                                            setNewComponentName("");
                                            setShowAddComponentModal(false);
                                        }
                                        if (e.key === "Escape") setShowAddComponentModal(false);
                                    }}
                                    placeholder="e.g., Header, Card, HeroSection"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/20"
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowAddComponentModal(false)}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        disabled={!newComponentName.trim()}
                                        onClick={() => {
                                            onAddComponent(newComponentName.trim());
                                            setNewComponentName("");
                                            setShowAddComponentModal(false);
                                        }}
                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all font-mono"
                                    >
                                        Create Component
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {showGenerateModal && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md glass border border-white/10 rounded-2xl p-6 shadow-2xl scale-in-center overflow-hidden text-left">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Send className="w-5 h-5 text-blue-400" />
                                Custom Instructions
                            </h3>
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-white/40" />
                            </button>
                        </div>

                        <p className="text-sm text-white/60 mb-4">
                            Tell the AI any specific requirements for this generation (e.g., "Use deep purple colors", "Add a contact form", "Make it mobile-responsive").
                        </p>

                        <textarea
                            autoFocus
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                            placeholder="Add instructions (optional)..."
                            className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all resize-none mb-6"
                        />

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (canvasRef.current) {
                                        onSubmit(canvasRef.current.toDataURL("image/png"), additionalInstructions);
                                        setShowGenerateModal(false);
                                    }
                                }}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
