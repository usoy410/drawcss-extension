import { Shape } from "@/StudioCanvas.js";

export interface ComponentDesign {
    id: string;
    name: string;
    shapes: Shape[];
    raster: string; // base64
}


export interface Project {
    id: string;
    name: string;
    components: ComponentDesign[];
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
