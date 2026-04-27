import dotenv from 'dotenv';
dotenv.config();

// Mock import.meta.env for Node execution
(globalThis as any).import = {
  meta: {
    env: {
      VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY
    }
  }
};

const { generateQuizFromNotes } = await import('./src/services/gemini.js');

async function test() {
  console.log("Starting test...");
  try {
    const res = await generateQuizFromNotes("The sky is blue and grass is green.", 2);
    console.log("Final Result Type:", typeof res);
    if (Array.isArray(res)) {
       console.log("Result content:", JSON.stringify(res[0], null, 2));
       if (res[0].question.includes("Fallback")) {
         console.error("DEBUG: Result is a FALLBACK, indicating all models failed.");
       } else {
         console.log("DEBUG: SUCCESS! AI generated quiz.");
       }
    }
  } catch (e) {
    console.error("Test Error (uncaught):", e);
  }
}
test();
