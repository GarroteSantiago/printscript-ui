export type FileType = {
    language: string;
    extension: string;
    // Versiones del lenguaje (GET /languages); la última es la que se usa por defecto
    versions?: string[];
}
