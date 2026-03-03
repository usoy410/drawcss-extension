import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";
import * as vscode from "vscode";
// Load environment variables from the workspace root if possible
function loadEnv() {
    if (vscode.workspace.workspaceFolders) {
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        dotenv.config({ path: path.join(rootPath, ".env") });
        dotenv.config({ path: path.join(rootPath, ".env.local") });
    }
}
export async function generateAgenticCode(drawingData, techStack) {
    loadEnv();
    // Check for API Key in extension settings OR .env
    const apiKey = process.env.GEMINI_API_KEY || vscode.workspace.getConfiguration('drawcss').get('apiKey');
    if (!apiKey) {
        return `// ERROR: Gemini API Key not found. 
// Please add GEMINI_API_KEY=your_key to your .env file in the project root.
// Or set it in VS Code Settings: DrawCSS > Api Key.

export const GeneratedComponent = () => {
    return <div>Please configure your Gemini API Key.</div>
};`;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: getSystemInstruction(techStack.framework, techStack.styling)
    });
    try {
        // Prepare the prompt with the drawing (base64)
        const prompt = "Please convert this UI drawing into code. Replicate the layout, components, and general aesthetic exactly. If there are multiple pages or links, implement them logically.";
        // Remove data:image/png;base64, prefix if present
        const base64Data = drawingData.split(",")[1] || drawingData;
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/png"
                }
            }
        ]);
        const response = await result.response;
        const text = response.text();
        // Clean up markdown if Gemini returned it
        return cleanGeneratedCode(text);
    }
    catch (error) {
        console.error("Gemini Generation Error:", error);
        return `// Error generating code: ${error.message}\n\n// Drawing Data received: ${drawingData.substring(0, 50)}...`;
    }
}
function getSystemInstruction(framework, styling) {
    const isTailwind = styling === "tailwind";
    return `You are "Antigravity," an elite Senior Frontend Architect.
Your goal is to transform a UI sketch into a production-ready, interactive ${framework} project using ${isTailwind ? "Tailwind CSS" : "Vanilla CSS"}.

PROJECT RULES:
1. JSON Output: Return only the RAW CODE for the main component. No markdown wrappers.
2. Structure: Use ${framework} best practices.
3. Design: Perfectly replicate spatial relationships. Use Dark Mode with Glassmorphism if unspecified.
4. Icons: Use Lucide icons (embedded SVG).
5. Output: Just the code for a single file. No explanations.`;
}
function cleanGeneratedCode(text) {
    // Remove markdown code blocks if present
    return text.replace(/```[a-z]*\n/g, "").replace(/\n```/g, "").trim();
}
//# sourceMappingURL=agent.js.map