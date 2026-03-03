"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const scanner_1 = require("./scanner");
const agent_1 = require("./agent");
function activate(context) {
    console.log('DrawCSS Studio is active');
    let disposable = vscode.commands.registerCommand('drawcss.openStudio', async () => {
        const techStack = await (0, scanner_1.scanProject)();
        const panel = vscode.window.createWebviewPanel('drawcssStudio', 'DrawCSS Studio', vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
        });
        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'submit':
                    const displayFramework = techStack.framework === 'nextjs' ? 'Next.js' : techStack.framework.charAt(0).toUpperCase() + techStack.framework.slice(1);
                    const displayStyling = techStack.styling.charAt(0).toUpperCase() + techStack.styling.slice(1);
                    vscode.window.showInformationMessage(`Drawing received! Tech stack: ${displayFramework} + ${displayStyling}`);
                    // 1. Generate Agentic Code
                    const generatedCode = await (0, agent_1.generateAgenticCode)(message.data, techStack);
                    // 2. Propose File Creation
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (workspaceFolders) {
                        const rootPath = workspaceFolders[0].uri.fsPath;
                        const targetSubDir = techStack.componentsDir || "";
                        const extension = (techStack.framework === 'react' || techStack.framework === 'nextjs') ? '.tsx' : '.html';
                        let fileName = 'GeneratedComponent' + extension;
                        let filePath = path.join(rootPath, targetSubDir, fileName);
                        // Simple duplicate check
                        let counter = 1;
                        while (true) {
                            try {
                                await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                                fileName = `GeneratedComponent${counter}${extension}`;
                                filePath = path.join(rootPath, targetSubDir, fileName);
                                counter++;
                            }
                            catch {
                                break;
                            }
                        }
                        const fileUri = vscode.Uri.file(filePath);
                        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(generatedCode));
                        // 3. Open the file
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        await vscode.window.showTextDocument(document);
                        vscode.window.showInformationMessage(`Agentic code saved to ${path.join(targetSubDir, fileName)}`);
                    }
                    return;
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
function getWebviewContent(webview, extensionUri) {
    // Basic HTML content for testing the bridge
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { background: #0a0a0a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; }
                button:hover { background: #2563eb; }
                .status { margin-top: 20px; font-size: 12px; opacity: 0.5; font-mono; }
            </style>
        </head>
        <body>
            <h1>DrawCSS Studio</h1>
            <p>Ready to generate agentic code.</p>
            <button onclick="submit()">Test Draw Submission</button>
            <div class="status">Scanner: Connected</div>
            <script>
                const vscode = acquireVsCodeApi();
                function submit() {
                    vscode.postMessage({ command: 'submit', data: 'placeholder_base64' });
                }
            </script>
        </body>
        </html>
    `;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map