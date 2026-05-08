import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { extractDocument } from "../src/agents/document-extraction.js";
import type { DdtDocument } from "../src/types/ddt.js";
import type { LLMSettings } from "../src/types/llm-provider.js";

const defaultLLMSettings: LLMSettings = {
  provider: "openai",
  openaiTextModel: "gpt-4o",
  openaiVisionModel: "gpt-4o",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASET_PATH = path.resolve(__dirname, "..", "..", "dataset", "ddt");
const GROUND_TRUTH_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "groundtruth",
  "grountruth_ddt.json"
);

interface FieldComparison {
  field: string;
  expected: unknown;
  actual: unknown;
  match: boolean;
}

interface FileResult {
  fileName: string;
  accuracy: number;
  totalFields: number;
  matchedFields: number;
  mismatches: FieldComparison[];
  extractionTime: number;
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number(value.toFixed(2)).toString();
  }
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function compareObjects(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  prefix = ""
): FieldComparison[] {
  const results: FieldComparison[] = [];

  for (const key of Object.keys(expected)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const expectedValue = expected[key];
    const actualValue = actual?.[key];

    if (expectedValue === null || expectedValue === undefined) {
      continue;
    }

    if (typeof expectedValue === "object" && !Array.isArray(expectedValue)) {
      results.push(
        ...compareObjects(
          expectedValue as Record<string, unknown>,
          (actualValue as Record<string, unknown>) || {},
          fieldPath
        )
      );
      continue;
    }

    if (Array.isArray(expectedValue)) {
      const actualArray = actualValue as unknown[] | undefined;
      if (!actualArray || !Array.isArray(actualArray)) {
        results.push({
          field: fieldPath,
          expected: `array[${expectedValue.length}]`,
          actual: actualArray === undefined ? "missing" : "not an array",
          match: false,
        });
        continue;
      }

      if (actualArray.length !== expectedValue.length) {
        results.push({
          field: `${fieldPath}.length`,
          expected: expectedValue.length,
          actual: actualArray.length,
          match: false,
        });
      }

      const minLen = Math.min(expectedValue.length, actualArray.length);
      for (let i = 0; i < minLen; i++) {
        if (typeof expectedValue[i] === "object" && expectedValue[i] !== null) {
          results.push(
            ...compareObjects(
              expectedValue[i] as Record<string, unknown>,
              actualArray[i] as Record<string, unknown>,
              `${fieldPath}[${i}]`
            )
          );
        } else {
          const match = normalizeValue(expectedValue[i]) === normalizeValue(actualArray[i]);
          results.push({
            field: `${fieldPath}[${i}]`,
            expected: expectedValue[i],
            actual: actualArray[i],
            match,
          });
        }
      }
      continue;
    }

    const match = normalizeValue(expectedValue) === normalizeValue(actualValue);
    results.push({
      field: fieldPath,
      expected: expectedValue,
      actual: actualValue,
      match,
    });
  }

  return results;
}

function printReport(fileResults: FileResult[], overallAccuracy: number) {
  console.log("\nDDT EXTRACTION ACCURACY REPORT");
  console.log(`Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);

  for (const result of fileResults) {
    console.log(
      `${result.fileName}: ${(result.accuracy * 100).toFixed(1)}% ` +
        `(${result.matchedFields}/${result.totalFields}) in ${(result.extractionTime / 1000).toFixed(1)}s`
    );

    for (const mismatch of result.mismatches.slice(0, 10)) {
      console.log(
        `  ${mismatch.field}: expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)}`
      );
    }
  }
}

describe("DDT Extraction Accuracy", () => {
  let groundTruth: DdtDocument[];

  beforeAll(async () => {
    const content = await fs.readFile(GROUND_TRUTH_PATH, "utf-8");
    groundTruth = JSON.parse(content) as DdtDocument[];
  });

  it("classifies DDT documents and extracts expected fields", async () => {
    const fileResults: FileResult[] = [];

    for (const expected of groundTruth) {
      const pdfPath = path.join(DATASET_PATH, expected.file_name);
      const pdfBuffer = await fs.readFile(pdfPath);
      const start = Date.now();

      const result = await extractDocument(pdfBuffer, expected.file_name, defaultLLMSettings);
      const extractionTime = Date.now() - start;

      expect(result.documentKind).toBe("ddt");
      expect(result.ddt).toBeTruthy();

      const actual = result.ddt || ({} as DdtDocument);
      const comparisons = compareObjects(
        expected as unknown as Record<string, unknown>,
        actual as unknown as Record<string, unknown>
      );
      const matchedFields = comparisons.filter((comparison) => comparison.match).length;
      const totalFields = comparisons.length;
      const accuracy = totalFields > 0 ? matchedFields / totalFields : 0;

      fileResults.push({
        fileName: expected.file_name,
        accuracy,
        totalFields,
        matchedFields,
        mismatches: comparisons.filter((comparison) => !comparison.match),
        extractionTime,
      });
    }

    const totalMatched = fileResults.reduce((sum, result) => sum + result.matchedFields, 0);
    const totalFields = fileResults.reduce((sum, result) => sum + result.totalFields, 0);
    const overallAccuracy = totalFields > 0 ? totalMatched / totalFields : 0;

    printReport(fileResults, overallAccuracy);
    expect(overallAccuracy).toBeGreaterThanOrEqual(0.65);
  }, 300000);
});
