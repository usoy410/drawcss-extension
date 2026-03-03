import * as vscode from 'vscode';
import * as path from 'path';
import { scanProject } from './scanner.js';
import { generateAgenticCode } from './agent.js';

export function activate(context: vscode.ExtensionContext) {
    console.log('DrawCSS Studio is active');

    const disposable = vscode.commands.registerCommand('drawcss.openStudio', async () => {
        // Check for API Key first to guide the user
        const config = vscode.workspace.getConfiguration('drawcss');
        const apiKey = process.env.GEMINI_API_KEY || config.get<string>('apiKey');

        if (!apiKey) {
            const choice = await vscode.window.showWarningMessage(
                "Gemini API Key is missing. DrawCSS requires a key to generate code.",
                "Open Settings",
                "Get API Key (Google)"
            );

            if (choice === "Open Settings") {
                vscode.commands.executeCommand('workbench.action.openSettings', 'drawcss.apiKey');
                return;
            } else if (choice === "Get API Key (Google)") {
                vscode.env.openExternal(vscode.Uri.parse("https://aistudio.google.com/app/apikey"));
                return;
            }
        }

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

        // Load and send initial state
        const initialState = await loadDesignState();
        if (initialState) {
            panel.webview.postMessage({ command: 'initialState', data: initialState });
        }

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'saveState': {
                        await saveDesignState(message.data);
                        break;
                    }
                    case 'submit': {
                        panel.webview.postMessage({ command: 'status', text: 'Scanning project context...' });
                        // const techStack = await scanProject(); // This line is moved up in the original code, but the instruction implies it's here. Let's assume the original code had it here and the instruction is adding the status message before it.

                        panel.webview.postMessage({ command: 'status', text: 'Analyzing UI drawing with Gemini...' });

                        const displayFramework = techStack.framework === 'nextjs' ? 'Next.js' : techStack.framework.charAt(0).toUpperCase() + techStack.framework.slice(1);
                        const displayStyling = techStack.styling.charAt(0).toUpperCase() + techStack.styling.slice(1);

                        vscode.window.showInformationMessage(`Drawing received! Tech stack: ${displayFramework} + ${displayStyling}`);

                        // 1. Generate Agentic Code
                        const techStackWithNav = {
                            ...techStack,
                            navigation: message.navigation,
                            additionalInstructions: message.additionalInstructions
                        };
                        const result = await generateAgenticCode(message.data, techStackWithNav);

                        if (result.thoughts) {
                            panel.webview.postMessage({ command: 'thoughts', text: result.thoughts });
                        }

                        // 2. Multi-File Creation
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (workspaceFolders && result.files && result.files.length > 0) {
                            const rootPath = workspaceFolders[0].uri.fsPath;
                            let mainFileUri: vscode.Uri | undefined;
                            const createdFilesInfo: { path: string, name: string }[] = [];

                            panel.webview.postMessage({ command: 'status', text: 'Integrating files into your project...' });

                            for (const fileItem of result.files) {
                                const targetSubDir = fileItem.folder || "";
                                const extension = (techStack.framework === 'react' || techStack.framework === 'nextjs') ? (techStack.language === 'typescript' ? '.tsx' : '.jsx') : '.html';

                                let fileName = fileItem.fileName || ('Component' + extension);
                                if (!fileName.includes('.') && !fileName.endsWith(extension)) fileName += extension;

                                let filePath = path.join(rootPath, targetSubDir, fileName);

                                // Ensure target directory exists
                                const dirPath = path.dirname(filePath);
                                try {
                                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
                                } catch (e) {
                                    console.error(`Error creating directory ${dirPath}:`, e);
                                }

                                // Overwrite Protection for root files
                                const isRootFile = fileName === 'page.tsx' || fileName === 'layout.tsx' || fileName === 'index.html' || fileName === 'App.tsx';
                                if (isRootFile) {
                                    try {
                                        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                                        if (stat.size > 100) { // If it exists and is not just a skeleton
                                            const originalName = fileName;
                                            fileName = `Generated-${Date.now()}-${fileName}`;
                                            filePath = path.join(rootPath, targetSubDir, fileName);
                                            vscode.window.showWarningMessage(`File conflict: ${originalName} already exists. Created ${fileName} instead.`);
                                        }
                                    } catch {
                                        // File doesn't exist, safe to overwrite/create
                                    }
                                } else {
                                    // Logic for other files (prevent duplicates with counters)
                                    let counter = 1;
                                    const ext = path.extname(fileName);
                                    const base = path.basename(fileName, ext);
                                    let exists = true;
                                    while (exists) {
                                        try {
                                            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                                            fileName = `${base}${counter}${ext}`;
                                            filePath = path.join(rootPath, targetSubDir, fileName);
                                            counter++;
                                        } catch {
                                            exists = false;
                                        }
                                    }
                                }

                                const fileUri = vscode.Uri.file(filePath);
                                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(fileItem.code));
                                createdFilesInfo.push({ path: path.join(targetSubDir, fileName), name: fileName });

                                // Prioritize opening page.tsx, index.html, or the first file
                                if (!mainFileUri || fileName.includes('page') || fileName.includes('index') || fileName.includes('Main')) {
                                    mainFileUri = fileUri;
                                }
                            }

                            // Create Generation Report
                            const reportContent = `# DrawCSS Generation Report\n\n` +
                                `## AI Thoughts\n${result.thoughts || "No thoughts provided."}\n\n` +
                                `## Created Files\n` +
                                createdFilesInfo.map(f => `- **${f.name}**: \`${f.path}\``).join('\n') +
                                `\n\n## Project Context Applied\n` +
                                `- Framework: ${displayFramework}\n` +
                                `- Styling: ${displayStyling}\n` +
                                `- Architecture: Modular Components\n`;

                            await vscode.workspace.fs.writeFile(
                                vscode.Uri.file(path.join(rootPath, 'GENERATION_REPORT.md')),
                                Buffer.from(reportContent)
                            );

                            panel.webview.postMessage({ command: 'complete', summary: result.thoughts });

                            // 3. Open the "main" file
                            if (mainFileUri) {
                                const document = await vscode.workspace.openTextDocument(mainFileUri);
                                await vscode.window.showTextDocument(document);
                                vscode.window.showInformationMessage(`Agentic generation complete: ${result.files.length} files created. Check GENERATION_REPORT.md for details.`);
                            }
                        }
                        return;
                    }
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
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

async function saveDesignState(data: any) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const dotDrawCssPath = path.join(rootPath, '.drawcss');
    const stateFilePath = path.join(dotDrawCssPath, 'design_state.json');

    try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dotDrawCssPath));
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(stateFilePath),
            Buffer.from(JSON.stringify(data, null, 2))
        );
    } catch (e) {
        console.error('Error saving design state:', e);
    }
}

async function loadDesignState(): Promise<any> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const stateFilePath = path.join(rootPath, '.drawcss', 'design_state.json');

    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(stateFilePath));
        return JSON.parse(content.toString());
    } catch {
        return null;
    }
}
