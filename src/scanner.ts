import * as vscode from 'vscode';
import * as path from 'path';

export interface TechStack {
    framework: string;
    styling: string;
    language: 'typescript' | 'javascript';
    isNextJs: boolean;
    componentsDir?: string;
}

export async function scanProject(): Promise<TechStack> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return { framework: 'vanilla', styling: 'css', language: 'javascript', isNextJs: false };
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const techStack: TechStack = {
        framework: 'vanilla',
        styling: 'css',
        language: 'javascript',
        isNextJs: false
    };

    try {
        const packageJsonUri = vscode.Uri.file(path.join(rootPath, 'package.json'));
        const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
        const packageJson = JSON.parse(packageJsonContent.toString());

        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Framework Detection
        if (deps['next']) {
            techStack.framework = 'nextjs';
            techStack.isNextJs = true;
        } else if (deps['react']) {
            techStack.framework = 'react';
        } else if (deps['vue']) {
            techStack.framework = 'vue';
        }

        // Styling Detection
        if (deps['tailwindcss']) {
            techStack.styling = 'tailwind';
        } else if (deps['@emotion/react'] || deps['styled-components']) {
            techStack.styling = 'css-in-js';
        }

        // Language Detection
        // Detect Components Directory
        techStack.componentsDir = await findBestComponentDir(rootPath);

    } catch (e) {
        console.error('Error scanning project:', e);
    }

    return techStack;
}

async function findBestComponentDir(rootPath: string): Promise<string | undefined> {
    const candidates = [
        'src/components',
        'components',
        'app/components',
        'lib/components',
    ];

    for (const relPath of candidates) {
        const fullPath = path.join(rootPath, relPath);
        try {
            const stats = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
            if (stats.type === vscode.FileType.Directory) {
                return relPath;
            }
        } catch {
            // Path doesn't exist
        }
    }
    return undefined;
}
