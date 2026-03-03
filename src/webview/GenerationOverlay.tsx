import React from 'react';
import { Loader2, Brain, CheckCircle2, FileText, ChevronRight, X } from 'lucide-react';

interface GenerationOverlayProps {
    status: string;
    thoughts: string;
    isComplete: boolean;
    error: string | null;
    onClose: () => void;
}

export const GenerationOverlay = ({ status, thoughts, isComplete, error, onClose }: GenerationOverlayProps) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505]/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-2xl p-8 rounded-3xl border border-white/10 bg-black/40 shadow-2xl relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px]" />

                <div className="relative z-10 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                                <Brain className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-semibold tracking-tight text-white">AI Generation Process</h2>
                        </div>
                        {isComplete && (
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Status Step */}
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                            {!isComplete && !error ? (
                                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            )}
                            <span className="text-sm font-medium text-white/80">{status}</span>
                        </div>

                        {/* AI Thoughts */}
                        {thoughts && (
                            <div className="p-6 rounded-2xl bg-blue-600/10 border border-blue-500/20 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-2 mb-3">
                                    <Brain className="w-4 h-4 text-blue-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400/80">AI Insights</span>
                                </div>
                                <p className="text-sm leading-relaxed text-blue-100/80 italic">
                                    "{thoughts}"
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Success Message */}
                        {isComplete && (
                            <div className="space-y-4 animate-in fade-in duration-700 delay-300">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-sm font-semibold">Generation Successful!</span>
                                </div>
                                <p className="text-xs text-white/40 leading-relaxed">
                                    The components have been integrated into your project. I've also created a <span className="text-white/60 font-mono">GENERATION_REPORT.md</span> in your root directory with full details.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                                >
                                    Return to Studio <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
