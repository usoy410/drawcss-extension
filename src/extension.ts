import * as vscode from 'vscode';
import * as path from 'path';
import { scanProject } from './scanner';

import { generateAgenticCode } from './agent';

export function activate(context: vscode.ExtensionContext) {
    console.log('DrawCSS Studio is active');

    let disposable = vscode.commands.registerCommand('drawcss.openStudio', async () => {
        const techStack = await scanProject();

        const panel = vscode.window.createWebviewPanel(
            'drawcssStudio',
            'DrawCSS Studio',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
        );

        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'submit':
                        const displayFramework = techStack.framework === 'nextjs' ? 'Next.js' : techStack.framework.charAt(0).toUpperCase() + techStack.framework.slice(1);
                        const displayStyling = techStack.styling.charAt(0).toUpperCase() + techStack.styling.slice(1);

                        vscode.window.showInformationMessage(`Drawing received! Tech stack: ${displayFramework} + ${displayStyling}`);

                        // 1. Generate Agentic Code
                        const generatedCode = await generateAgenticCode(message.data, techStack);

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
                                } catch {
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
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
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

export function deactivate() { }
