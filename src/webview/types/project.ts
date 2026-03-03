import { Shape } from "@/StudioCanvas.js";

export interface Page {
    id: string;
    name: string;
    shapes: Shape[];
    raster: string; // base64
}

export interface Wiring {
    sourcePageId: string;
    sourceElementId: string;
    targetPageId: string;
}

export interface Project {
    id: string;
    name: string;
    pages: Page[];
    wirings: Wiring[];
    settings: {
        framework: string;
        styling: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface ProjectFile {
    name: string;
    content: string;
    language: "html" | "css" | "javascript" | "typescript" | "json";
}
