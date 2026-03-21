/**
 * Run with: npx tsx scripts/generate-fallbacks.ts
 * Generates pre-cached fingerprints for demo fallback authors.
 */
import * as fs from "fs";
import * as path from "path";
import { computeStatFingerprint, statFingerprintToRadar } from "../lib/fingerprint";
import type { VoiceReading } from "../lib/fingerprint";

const CORPUS_DIR = path.join(__dirname, "..", "corpus");
const OUTPUT_DIR = path.join(__dirname, "..", "data", "library");

// Pre-written voice readings (since we can't call LLM in a script without API key)
const voiceReadings: Record<string, VoiceReading> = {
  hemingway: {
    emotionalTemperature: "controlled surface tension",
    sensoryPalette: "visual-kinetic, light and motion",
    tonalRegister: "casual-declarative",
    imageryDensity: "high concrete, scene over thought",
  },
  poe: {
    emotionalTemperature: "feverish gothic dread",
    sensoryPalette: "visual-auditory, shadow and echo",
    tonalRegister: "formal-ornate",
    imageryDensity: "high atmospheric, sensation over object",
  },
  twain: {
    emotionalTemperature: "warm vernacular wit",
    sensoryPalette: "visual-tactile, river and earth",
    tonalRegister: "casual-ironic",
    imageryDensity: "high concrete, physical world dominant",
  },
  kafka: {
    emotionalTemperature: "suffocating bureaucratic anxiety",
    sensoryPalette: "interior-claustrophobic, body and enclosure",
    tonalRegister: "formal-detached",
    imageryDensity: "high surreal, ordinary made grotesque",
  },
  woolf: {
    emotionalTemperature: "luminous interior drift",
    sensoryPalette: "visual-temporal, light and memory",
    tonalRegister: "lyrical-interior",
    imageryDensity: "high impressionistic, thought over object",
  },
  fitzgerald: {
    emotionalTemperature: "gilded melancholy",
    sensoryPalette: "visual-chromatic, color and surfaces",
    tonalRegister: "elegant-wistful",
    imageryDensity: "high ornamental, beauty as decay",
  },
};

const AUTHORS = [
  {
    id: "hemingway",
    name: "Ernest Hemingway",
    file: "hemingway_sunalsorises.txt",
    work: "The Sun Also Rises",
  },
  {
    id: "poe",
    name: "Edgar Allan Poe",
    file: "poe_tales.txt",
    work: "The Fall of the House of Usher",
  },
  {
    id: "twain",
    name: "Mark Twain",
    file: "twain_huckfinn.txt",
    work: "Adventures of Huckleberry Finn",
  },
  {
    id: "kafka",
    name: "Franz Kafka",
    file: "kafka_metamorphosis.txt",
    work: "The Metamorphosis",
  },
  {
    id: "woolf",
    name: "Virginia Woolf",
    file: "woolf_voyageout.txt",
    work: "The Voyage Out",
  },
  {
    id: "fitzgerald",
    name: "F. Scott Fitzgerald",
    file: "fitzgerald_gatsby.txt",
    work: "The Great Gatsby",
  },
];

function stripGutenbergHeader(text: string): string {
  const startMarkers = ["*** START OF", "***START OF"];
  const endMarkers = ["*** END OF", "***END OF", "End of the Project Gutenberg"];

  let start = 0;
  for (const marker of startMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      start = text.indexOf("\n", idx) + 1;
      break;
    }
  }

  let end = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      end = idx;
      break;
    }
  }

  return text.slice(start, end).trim();
}

function extractSample(text: string, wordCount: number = 500): string {
  const midpoint = Math.floor(text.length / 2);
  const start = text.lastIndexOf(".", midpoint - 2000) + 1;
  const words = text.slice(start).split(/\s+/);
  return words.slice(0, wordCount).join(" ");
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const author of AUTHORS) {
  const filePath = path.join(CORPUS_DIR, author.file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${author.name}: corpus file not found`);
    continue;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const clean = stripGutenbergHeader(raw);

  const analysisText = clean.slice(0, 20000);
  const stats = computeStatFingerprint(analysisText);
  const radar = statFingerprintToRadar(stats);
  const sampleText = extractSample(clean);
  const voice = voiceReadings[author.id];

  const fallback = {
    id: author.id,
    name: author.name,
    work: author.work,
    stats,
    radar,
    voice,
    sampleText,
  };

  const outPath = path.join(OUTPUT_DIR, `${author.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(fallback, null, 2));
  console.log(`\n${author.name}:`);
  console.log(`  mono=${stats.monosyllableRatio.toFixed(3)}, sent=${stats.sentenceMean}, comma=${stats.commaRate}`);
  console.log(`  lexDiv=${stats.lexicalDiversity}, conj=${stats.conjunctionDensity}, para=${stats.paragraphMean}`);
  console.log(`  voice: ${voice.emotionalTemperature} / ${voice.tonalRegister}`);
}

console.log("\nDone. Fallbacks written to", OUTPUT_DIR);
