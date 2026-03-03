import * as vscode from 'vscode';
import * as path from 'path';
import { scanProject } from './scanner.js';
import { generateAgenticCode } from './agent.js';
export function activate(context) {
    console.log('DrawCSS Studio is active');
    const disposable = vscode.commands.registerCommand('drawcss.openStudio', async () => {
        const techStack = await scanProject();
        const panel = vscode.window.createWebviewPanel('drawcssStudio', 'DrawCSS Studio', vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
        });
        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'submit': {
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
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
function getWebviewContent(webview, extensionUri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'drawcss-extension.css'));
    const cspSource = webview.cspSource;
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource};">
            <title>DrawCSS Studio</title>
            <link rel="stylesheet" href="${styleUri}">
            <style>
                body { margin: 0; padding: 0; overflow: hidden; background: #050505; color: white; }
                #root { width: 100vw; height: 100vh; }
                #debug-status { position: absolute; top: 10px; right: 10px; font-size: 10px; color: rgba(255,255,255,0.2); z-index: 1000; }
            </style>
        </head>
        <body>
            <div id="debug-status">Initializing...</div>
            <div id="root"></div>
            <script>
                const vscode = acquireVsCodeApi();
                window.vscode = vscode;
                document.getElementById('debug-status').innerText = 'Bridge Ready. Loading Scripts...';
                
                window.onerror = function(msg, url, line, col, error) {
                   document.getElementById('debug-status').innerText = 'Error: ' + msg;
                   document.getElementById('debug-status').style.color = 'red';
                };
            </script>
            <script src="${scriptUri}"></script>
        </body>
        </html>
    `;
}
export function deactivate() { }
//# sourceMappingURL=extension.js.map