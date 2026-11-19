import {Pagination} from "./pagination.ts";
import {FileType} from "../types/FileType.ts";

export type ComplianceEnum =
    'pending' |
    'failed' |
    'not-compliant' |
    'compliant'


export type CreateSnippet = {
  name: string;
  content: string;
  language: string;
  extension: string;
  // El contrato los acepta; si falta la versión se usa la última del lenguaje
  description?: string;
  version?: string;
}

export type CreateSnippetWithLang = CreateSnippet & { language: string }

// El contrato acepta cualquier subconjunto de los campos; la UI solo manda content
export type UpdateSnippet = Partial<CreateSnippet>

export type Diagnostic = {
  rule?: string | null;
  message: string;
  line: number;
  column: number;
}

export type Snippet = CreateSnippet & {
  id: string
} & SnippetStatus

type SnippetStatus = {
  compliance: ComplianceEnum;
  author: string;
  authorId?: string;
  relation?: 'owned' | 'shared';
  lintViolations?: Diagnostic[];
  createdAt?: string;
  updatedAt?: string;
}
export type PaginatedSnippets = Pagination & {
  snippets: Snippet[]
}

export const getFileLanguage = (fileTypes: FileType[], fileExt?: string) => {
  return fileExt && fileTypes?.find(x => x.extension == fileExt)
}

// Última versión del lenguaje según GET /languages
export const latestVersion = (fileTypes: FileType[] | undefined, language: string): string | undefined => {
  return fileTypes?.find(x => x.language === language)?.versions?.at(-1)
}
