export type TestCase = {
    id: string;
    name: string;
    input?: string[];
    output?: string[];
    lastResult?: "success" | "fail" | null;
};
