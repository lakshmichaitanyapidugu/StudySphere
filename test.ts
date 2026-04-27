import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

async function test() {
  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) throw new Error("No API key");
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("hello");
    console.log("2.0-flash result:", result.response.text());
  } catch (e: any) {
    console.error("2.0-flash error:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("hello");
    console.log("1.5-flash result:", result.response.text());
  } catch (e: any) {
    console.error("1.5-flash error:", e.message);
  }
}

test();
