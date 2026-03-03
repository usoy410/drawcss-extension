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
exports.scanProject = scanProject;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
async function scanProject() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return { framework: 'vanilla', styling: 'css', language: 'javascript', isNextJs: false };
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const techStack = {
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
        }
        else if (deps['react']) {
            techStack.framework = 'react';
        }
        else if (deps['vue']) {
            techStack.framework = 'vue';
        }
        // Styling Detection
        if (deps['tailwindcss']) {
            techStack.styling = 'tailwind';
        }
        else if (deps['@emotion/react'] || deps['styled-components']) {
            techStack.styling = 'css-in-js';
        }
        // Language Detection
        // Detect Components Directory
        techStack.componentsDir = await findBestComponentDir(rootPath);
    }
    catch (e) {
        console.error('Error scanning project:', e);
    }
    return techStack;
}
async function findBestComponentDir(rootPath) {
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
        }
        catch {
            // Path doesn't exist
        }
    }
    return undefined;
}
//# sourceMappingURL=scanner.js.map