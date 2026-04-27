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

const API_KEY = process.env.VITE_GEMINI_API_KEY;
if (!API_KEY) {
  console.error("No API KEY");
  process.exit(1);
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.models) {
      const modelNames = data.models.map((m: any) => m.name).join("\n");
      const fs = await import('fs');
      fs.writeFileSync('available-models.txt', modelNames);
      console.log("Wrote models to available-models.txt");
      const flash = data.models.find((m: any) => m.name.toLowerCase().includes('gemini-1.5-flash'));
      if (flash) {
        console.log("FOUND:", JSON.stringify(flash, null, 2));
      } else {
        console.log("NOT FOUND IN LIST. Full list names:", data.models.map((m:any)=>m.name));
      }
    } else {
      console.log("No models property in response:", data);
    }
  } catch (e) {
    console.error(e);
  }
}

listModels();
