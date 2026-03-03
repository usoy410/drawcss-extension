import * as vscode from 'vscode';
import * as path from 'path';
import { TechStack } from './agent.js';

export async function scanProject(): Promise<TechStack> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return { framework: 'vanilla', styling: 'css', language: 'javascript', isNextJs: false, srcDir: '' };
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const techStack: TechStack = {
        framework: 'vanilla',
        styling: 'css',
        language: 'javascript',
        isNextJs: false,
        existingComponents: [],
        srcDir: ''
    };

    try {
        const packageJsonUri = vscode.Uri.file(path.join(rootPath, 'package.json'));
        const packageJsonExists = await fileExists(packageJsonUri.fsPath);

        let deps: any = {};
        if (packageJsonExists) {
            const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
            const packageJson = JSON.parse(packageJsonContent.toString());
            deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        }

        // Framework Detection
        if (deps['next']) {
            techStack.framework = 'nextjs';
            techStack.isNextJs = true;
        } else if (deps['react']) {
            techStack.framework = 'react';
        } else if (deps['vue']) {
            techStack.framework = 'vue';
        }

        // Language Detection
        const tsConfigExists = await fileExists(path.join(rootPath, 'tsconfig.json'));
        techStack.language = tsConfigExists ? 'typescript' : 'javascript';

        // Styling Detection
        if (deps['tailwindcss']) {
            techStack.styling = 'tailwind';
        } else if (deps['@emotion/react'] || deps['styled-components']) {
            techStack.styling = 'css-in-js';
        }

        // Detect Src Directory
        techStack.srcDir = await fileExists(path.join(rootPath, 'src')) ? 'src' : '';

        // Detect Components Directory
        techStack.componentsDir = await findBestComponentDir(rootPath, techStack);
        if (techStack.componentsDir) {
            techStack.existingComponents = await listComponents(path.join(rootPath, techStack.componentsDir));
        }

        // Style Context
        techStack.styleContext = await gatherStyleContext(rootPath, techStack);

        // Active File Context (if any)
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            techStack.activeFileContent = activeEditor.document.getText();
        }

    } catch (e) {
        console.error('Error scanning project:', e);
    }

    return techStack;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
    } catch {
        return false;
    }
}

async function listComponents(dirPath: string): Promise<string[]> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
        return entries
            .filter(([, type]) => type === vscode.FileType.File || type === vscode.FileType.Directory)
            .map(([name]) => name.split('.')[0])
            .filter((name, index, self) => self.indexOf(name) === index);
    } catch {
        return [];
    }
}

async function gatherStyleContext(rootPath: string, techStack: TechStack): Promise<string> {
    const styleFiles = [
        'src/app/globals.css',
        'src/globals.css',
        'app/globals.css',
        'src/index.css',
        'src/App.css',
        'styles.css',
        'style.css'
    ];

    let context = '';
    for (const relPath of styleFiles) {
        const fullPath = path.join(rootPath, relPath);
        if (await fileExists(fullPath)) {
            try {
                const content = await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath));
                const text = content.toString();

                context += `\n--- Style Insights from ${relPath} ---\n`;

                // 1. Extract CSS Variables (:root)
                const variables = text.match(/:root\s*{[^}]+}/g) || text.match(/--[\w-]+:\s*[^;]+;/g);
                if (variables) {
                    context += `[Design Tokens]:\n${variables.slice(0, 20).join('\n')}\n`;
                }

                // 2. Extract Body Styles (Colors, Fonts)
                const bodyStyles = text.match(/body\s*{[^}]+}/g);
                if (bodyStyles) {
                    context += `[Base Styles]:\n${bodyStyles[0]}\n`;
                }

                // 3. Extract Font Face or Common Class Patterns (Padding/Margins)
                const commonPatterns = text.match(/\.(container|card|btn|button|section)\s*{[^}]+}/g);
                if (commonPatterns) {
                    context += `[Common Patterns]:\n${commonPatterns.slice(0, 5).join('\n')}\n`;
                }

                // 4. Fallback: Snippet of first 500 chars if context is still thin
                if (context.length < 200) {
                    context += `[Snippet]:\n${text.substring(0, 500)}...\n`;
                }

            } catch (e) {
                console.error(`Error reading style file ${relPath}:`, e);
            }
        }
    }

    if (techStack.styling === 'tailwind') {
        const twConfigPaths = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs'];
        for (const twPath of twConfigPaths) {
            const fullPath = path.join(rootPath, twPath);
            if (await fileExists(fullPath)) {
                try {
                    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath));
                    context += `\n--- Tailwind Config Context (${twPath}) ---\n${content.toString()}\n`;
                    break;
                } catch (e) {
                    console.error(`Error reading Tailwind config ${twPath}:`, e);
                }
            }
        }
    }

    return context;
}

async function findBestComponentDir(rootPath: string, techStack: TechStack): Promise<string | undefined> {
    const src = techStack.srcDir;
    const candidates = [
        path.join(src, 'components'),
        'components',
        path.join(src, 'app', 'components'),
        path.join(src, 'app', '_components'),
        'lib/components',
    ];

    for (const relPath of candidates) {
        if (!relPath) continue;
        const fullPath = path.join(rootPath, relPath);
        if (await fileExists(fullPath)) {
            return relPath;
        }
    }

    // Default recommendation if none exist
    if (techStack.framework === 'nextjs' || techStack.framework === 'react') {
        return path.join(src, 'components');
    }

    return src || undefined;
}
