import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
export const getSystemInstruction = (framework = "vanilla", styling = "tailwind") => {
    const isTailwind = styling === "tailwind";
    const frameworkInstructions = {
        vanilla: isTailwind
            ? "Return a JSON object containing at least 'index.html', 'styles.css' (even if using Tailwind), and 'script.js'. Use standard HTML/JS. No markdown wrappers."
            : "Return a JSON object with 'index.html', 'styles.css', and 'script.js'. Separate files clearly in JSON format.",
        react: isTailwind
            ? "Return a JSON object with 'App.tsx' and other components. Use React + Tailwind."
            : "Return a JSON object with 'App.tsx', 'styles.css', and other components.",
        nextjs: isTailwind
            ? "Return a JSON object representing a Next.js App Router structure (e.g., 'app/page.tsx', 'app/layout.tsx')."
            : "Return a JSON object with a Next.js App Router structure and CSS modules.",
        vue: "Return a JSON object with 'App.vue' and other components.",
    };
    const instruction = frameworkInstructions[framework] || frameworkInstructions.vanilla;
    return `You are the "Visionary Developer," an elite Senior Frontend Architect.
Your goal is to transform a UI sketch into a production-ready, interactive ${framework} project using ${isTailwind ? "Tailwind CSS" : "Vanilla CSS"}.

PROJECT RULES:
1. JSON Output: Return a single JSON object where keys are filenames and values are code strings. No markdown wrappers.
2. Navigation: If "PROJECT CONTEXT" contains "wirings", implement navigation. For Vanilla, use link tags or window.location. For React/Next, use Link components.
3. Structure: ${instruction}
4. Design: Perfectly replicate spatial relationships. Use Dark Mode with Glassmorphism if unspecified.
5. Icons: Use Lucide icons (embedded SVG).

RESPONSE FORMAT:
{"index.html": "...", "styles.css": "...", "script.js": "..."}`;
};
export const getGeminiModel = (framework = "vanilla", styling = "tailwind") => {
    return genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        systemInstruction: getSystemInstruction(framework, styling),
    });
};
//# sourceMappingURL=gemini.js.map