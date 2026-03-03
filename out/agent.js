import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";
import * as vscode from "vscode";
// Load environment variables from the workspace root if possible
function loadEnv() {
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            const rootPath = folder.uri.fsPath;
            dotenv.config({ path: path.join(rootPath, ".env") });
            dotenv.config({ path: path.join(rootPath, ".env.local") });
        }
    }
}
export async function generateAgenticCode(drawingData, techStack) {
    loadEnv();
    const config = vscode.workspace.getConfiguration('drawcss');
    const apiKey = process.env.GEMINI_API_KEY || config.get('apiKey') || config.get('geminiApiKey');
    if (!apiKey) {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "unknown";
        return {
            files: [{
                    fileName: "error.txt",
                    folder: "",
                    code: `// ERROR: Gemini API Key not found. \n` +
                        `// The extension looks for the key in your CURRENT PROJECT root: ${workspacePath}\n` +
                        `// (Your .env file in the extension folder itself isn't checked as it's separate from your active project.)\n\n` +
                        `// RECOMMENDED FIX:\n` +
                        `// Set the key globally in VS Code settings so it works for ALL projects:\n` +
                        `// 1. Open VS Code Settings (Cmd/Ctrl + ,)\n` +
                        `// 2. Search for "DrawCSS"\n` +
                        `// 3. Paste your Gemini API Key into the "Api Key" field.\n\n` +
                        `// ALTERNATIVE:\n` +
                        `// Add GEMINI_API_KEY=your_key to the .env file at: ${workspacePath}/.env`
                }]
        };
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        systemInstruction: getSystemInstruction(techStack)
    });
    try {
        const navigationContext = techStack.navigation ? `
Project Navigation Context:
- Current Page ID: ${techStack.navigation.currentPageId}
- All Project Pages:
${techStack.navigation.pages.map(p => `  * ${p.name} (ID: ${p.id})`).join('\n')}
- Wirings (Interactions):
${techStack.navigation.wirings.filter(w => w.sourcePageId === techStack.navigation?.currentPageId).map(w => `  * Element ${w.sourceElementId} links to Page ID ${w.targetPageId}`).join('\n')}
` : '';
        const prompt = `Please convert this UI drawing into code that integrates SEAMLESSLY into the existing project.

${navigationContext}

Current Project Context:
- Framework: ${techStack.framework} ${techStack.isNextJs ? '(Next.js App Router)' : ''}
- Language: ${techStack.language}
- Styling: ${techStack.styling}
- Source Root Directory: ${techStack.srcDir || 'Project Root (no src/)'}
- Recommended Components Directory: ${techStack.componentsDir || (techStack.srcDir ? techStack.srcDir + '/components' : 'components')}
- Existing Components: ${techStack.existingComponents?.join(', ') || 'None detected'}

Active File Context (The user is currently working here):
${techStack.activeFileContent ? "```\n" + techStack.activeFileContent + "\n```" : 'No active file content.'}

Existing Style Context & Design Tokens:
${techStack.styleContext || 'No global styles detected.'}

CORE OBJECTIVE:
Don't just produce a new project. You are performing **Visual Design System Inference**. Look at the CSS snippets above and deduce the user's design aesthetic (e.g., "The user uses a deep blue #0a192f background with Inter font and 2rem padding"). Replicate this EXACT aesthetic in your generated code.

INSTRUCTIONS:
1. Match the Color Palette: Use the background, text, and primary colors found in the style context.
2. Match Typography: Use the same font families and sizing scales.
3. Match Spacing & Radii: If the user uses specific padding patterns (e.g., p-8) or border-radius (e.g., 12px), replicate them.
4. Integrate, don't just generate: If the user has an active file open, match its coding style and imports.
5. Reuse existing CSS variables (e.g., --primary, --surface) for all new styles.
6. **Navigation & Linking**: If an element in the drawing has a wiring to another page:
   - For Next.js: Use the \`next/link\` component: \`<Link href="/target-slug">\`.
   - For React (generic): Use \`<a>\` or your router's link component.
   - For Vanilla HTML: Use \`<a href="target-slug.html">\`.
   - SLUG RULE: Convert page names to lowercase-kebab-case (e.g., "About Us" -> "about-us").
7. Break the UI down into granular, reusable components if it makes sense.
8. If Next.js, follow App Router conventions.`;
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
        try {
            const cleaned = cleanGeneratedCode(text);
            const parsed = JSON.parse(cleaned);
            let files = [];
            let thoughts = parsed.thoughts || "";
            if (Array.isArray(parsed)) {
                files = parsed;
            }
            else if (parsed.files) {
                files = parsed.files;
            }
            else {
                files = [parsed];
            }
            return { files, thoughts };
        }
        catch {
            console.error("Failed to parse Gemini JSON:", text);
            return {
                files: [{
                        fileName: "GeneratedComponent." + (techStack.language === 'typescript' ? 'tsx' : 'jsx'),
                        folder: techStack.componentsDir || "",
                        code: text
                    }]
            };
        }
    }
    catch (error) {
        console.error("Gemini Generation Error:", error);
        return {
            files: [{
                    fileName: "error.txt",
                    folder: "",
                    code: `// Error generating code: ${error.message}`
                }]
        };
    }
}
function getSystemInstruction(techStack) {
    return `You are "Antigravity," an elite Senior Frontend Architect focused on SEAMLESS INTEGRATION.
Your goal is to transform a UI sketch into code that fits perfectly into the user's existing codebase.

INTEGRATION RULES:
1. Multi-File JSON Output: Return a JSON object with "files" (array) and "thoughts" (string). This is MANDATORY.
   "thoughts" should be a 2-3 sentence summary of how you interpreted the design and matched the existing project's style.
   Structure:
   {
     "thoughts": "AI reasoning here",
     "files": [
       {
         "fileName": "The suggested filename",
         "folder": "The path relative to project root", 
         "code": "The full source code content"
       }
     ]
   }
2. Respect Existing Styles: Use the provided CSS variables or Tailwind patterns. DO NOT generate new global CSS files like "global1.css" if global styles already exist.
3. Modular Architecture: Break down the drawing into logical units that fit the user's ${techStack.framework} setup.
4. Reuse Patterns: If the user provided an active file's content, match its imports, component structure, and naming conventions.
5. Icons: Use Lucide icons (as SVGs or component imports).
6. Design Excellence: perfectly replicate spacing and aesthetics while staying consistent with the project's existing theme.
7. Output: Return ONLY the RAW JSON object. DO NOT include markdown code blocks.`;
}
function cleanGeneratedCode(text) {
    // Remove markdown code blocks if present
    return text.replace(/```[a-z]*\n/g, "").replace(/\n```/g, "").trim();
}
//# sourceMappingURL=agent.js.map