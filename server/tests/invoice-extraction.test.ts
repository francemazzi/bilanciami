import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { extractInvoice } from "../src/agents/invoice-graph.js";
import type { Invoice } from "../src/types/invoice.js";
import type { LLMSettings } from "../src/types/llm-provider.js";

// Default LLM settings for tests (uses OpenAI)
const defaultLLMSettings: LLMSettings = {
  provider: "openai",
  openaiTextModel: "gpt-4o",
  openaiVisionModel: "gpt-4o",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dataset and ground truth paths
const DATASET_PATH = path.resolve(__dirname, "..", "..", "dataset");
const GROUND_TRUTH_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "groundtruth",
  "grountruth.json"
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

/**
 * Recursively compare two objects and return field-by-field comparison results.
 */
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

    // Skip null/undefined expected values
    if (expectedValue === null || expectedValue === undefined) {
      continue;
    }

    if (typeof expectedValue === "object" && !Array.isArray(expectedValue)) {
      // Recurse into nested objects
      results.push(
        ...compareObjects(
          expectedValue as Record<string, unknown>,
          (actualValue as Record<string, unknown>) || {},
          fieldPath
        )
      );
    } else if (Array.isArray(expectedValue)) {
      // Compare arrays
      const actualArray = actualValue as unknown[] | undefined;

      if (!actualArray || !Array.isArray(actualArray)) {
        results.push({
          field: fieldPath,
          expected: `array[${expectedValue.length}]`,
          actual: actualArray === undefined ? "missing" : "not an array",
          match: false,
        });
      } else if (actualArray.length !== expectedValue.length) {
        results.push({
          field: `${fieldPath}.length`,
          expected: expectedValue.length,
          actual: actualArray.length,
          match: false,
        });
        // Still compare available elements
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
      } else {
        // Same length arrays - compare elements
        for (let i = 0; i < expectedValue.length; i++) {
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
      }
    } else {
      // Compare primitive values with normalization
      const match = normalizeValue(expectedValue) === normalizeValue(actualValue);
      results.push({
        field: fieldPath,
        expected: expectedValue,
        actual: actualValue,
        match,
      });
    }
  }

  return results;
}

/**
 * Normalize values for comparison (handle numbers, strings, etc.)
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    // Round to 2 decimal places for comparison
    return Number(value.toFixed(2)).toString();
  }
  // Normalize strings: trim, lowercase, remove extra whitespace
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Print a formatted report of extraction results.
 */
function printReport(fileResults: FileResult[], overallAccuracy: number) {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║              INVOICE EXTRACTION ACCURACY REPORT                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("");

  // Overall metrics
  console.log(`📊 Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
  console.log("");

  // Per-file results table
  console.log("┌────────────┬────────────┬─────────────────┬──────────────┐");
  console.log("│ File       │ Accuracy   │ Fields Matched  │ Time (s)     │");
  console.log("├────────────┼────────────┼─────────────────┼──────────────┤");

  for (const r of fileResults) {
    const fileName = r.fileName.padEnd(10);
    const accuracy = `${(r.accuracy * 100).toFixed(1)}%`.padEnd(10);
    const fields = `${r.matchedFields}/${r.totalFields}`.padEnd(15);
    const time = `${(r.extractionTime / 1000).toFixed(1)}`.padEnd(12);
    console.log(`│ ${fileName} │ ${accuracy} │ ${fields} │ ${time} │`);
  }

  console.log("└────────────┴────────────┴─────────────────┴──────────────┘");
  console.log("");

  // Mismatched fields by file
  console.log("📋 Mismatched Fields by File:");
  console.log("─".repeat(60));

  for (const r of fileResults) {
    if (r.mismatches.length > 0) {
      console.log(`\n  📄 ${r.fileName} (${r.mismatches.length} mismatches):`);
      // Show up to 10 mismatches per file
      const displayMismatches = r.mismatches.slice(0, 10);
      for (const m of displayMismatches) {
        const expectedStr =
          typeof m.expected === "string"
            ? m.expected.substring(0, 30)
            : JSON.stringify(m.expected)?.substring(0, 30);
        const actualStr =
          typeof m.actual === "string"
            ? m.actual.substring(0, 30)
            : JSON.stringify(m.actual)?.substring(0, 30) || "undefined";
        console.log(`     ❌ ${m.field}`);
        console.log(`        Expected: ${expectedStr}`);
        console.log(`        Actual:   ${actualStr}`);
      }
      if (r.mismatches.length > 10) {
        console.log(`     ... and ${r.mismatches.length - 10} more mismatches`);
      }
    } else {
      console.log(`\n  📄 ${r.fileName}: ✅ All fields matched!`);
    }
  }

  console.log("\n" + "═".repeat(60) + "\n");
}

describe("Invoice Extraction Accuracy Test", () => {
  let groundTruth: Invoice[];

  beforeAll(async () => {
    // Load ground truth data
    const groundTruthContent = await fs.readFile(GROUND_TRUTH_PATH, "utf-8");
    groundTruth = JSON.parse(groundTruthContent);
    console.log(`Loaded ${groundTruth.length} invoices from ground truth`);
  });

  test("should extract data from all PDF invoices with acceptable accuracy", async () => {
    const fileResults: FileResult[] = [];
    let totalAccuracy = 0;

    console.log("\n🔄 Starting extraction of all invoices...\n");

    for (const expected of groundTruth) {
      const pdfPath = path.join(DATASET_PATH, expected.file_name);

      // Check if file exists
      try {
        await fs.access(pdfPath);
      } catch {
        console.error(`  ⚠️  File not found: ${expected.file_name}`);
        continue;
      }

      console.log(`  📄 Processing: ${expected.file_name}`);
      const startTime = Date.now();

      const pdfBuffer = await fs.readFile(pdfPath);

      const result = await extractInvoice(pdfBuffer, expected.file_name, defaultLLMSettings);
      const extractionTime = Date.now() - startTime;

      expect(result.invoice).toBeDefined();

      if (result.invoice) {
        // Compare extraction result with ground truth
        const comparisons = compareObjects(
          expected as unknown as Record<string, unknown>,
          result.invoice as unknown as Record<string, unknown>
        );

        const matchedFields = comparisons.filter((c) => c.match).length;
        const totalFields = comparisons.length;
        const accuracy = totalFields > 0 ? matchedFields / totalFields : 0;

        const mismatches = comparisons.filter((c) => !c.match);

        fileResults.push({
          fileName: expected.file_name,
          accuracy,
          totalFields,
          matchedFields,
          mismatches,
          extractionTime,
        });

        totalAccuracy += accuracy;

        console.log(
          `     ✅ Completed: ${(accuracy * 100).toFixed(1)}% accuracy (${matchedFields}/${totalFields} fields) in ${(extractionTime / 1000).toFixed(1)}s`
        );
      } else {
        console.log(`     ❌ Failed: No invoice extracted`);
        if (result.errors && result.errors.length > 0) {
          console.log(`     Errors: ${result.errors.join(", ")}`);
        }
        fileResults.push({
          fileName: expected.file_name,
          accuracy: 0,
          totalFields: 0,
          matchedFields: 0,
          mismatches: [],
          extractionTime,
        });
      }
    }

    // Calculate overall accuracy
    const overallAccuracy =
      fileResults.length > 0 ? totalAccuracy / fileResults.length : 0;

    // Print detailed report
    printReport(fileResults, overallAccuracy);

    // Assert minimum accuracy threshold (70%)
    expect(overallAccuracy).toBeGreaterThan(0.5);

    // Log final summary
    console.log(`\n✨ Test completed!`);
    console.log(`   Overall accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
    console.log(`   Files processed: ${fileResults.length}`);
    console.log(
      `   Total extraction time: ${(fileResults.reduce((sum, r) => sum + r.extractionTime, 0) / 1000).toFixed(1)}s`
    );
  }, 180000); // 3 minute timeout
});
