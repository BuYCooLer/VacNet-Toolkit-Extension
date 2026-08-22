export type JsonParseResult =
  | { success: true; data: unknown }
  | { success: false; error: SyntaxError };

export const parseJson = (value: string): JsonParseResult => {
  try {
    const data: unknown = JSON.parse(value);
    return { success: true, data };
  } catch (error) {
    if (error instanceof SyntaxError) return { success: false, error };
    throw error;
  }
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
