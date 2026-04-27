import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { QuizQuestion } from "../types";

const API_KEY = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_GEMINI_API_KEY : process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing Gemini API key in .env file");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Configurable model with fallbacks
const PRIMARY_MODEL = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_GEMINI_MODEL : process.env.VITE_GEMINI_MODEL;
const MODELS = [
  PRIMARY_MODEL,
  "models/gemini-2.1-pro", // High quality, worth trying if available
  "models/gemini-2.5-flash",
  "models/gemini-2.5-pro",
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-lite",
  "models/gemini-2.0-flash-001",
  "models/gemini-2.0-flash-lite-001",
  "models/gemini-2.5-flash-lite",
  "models/gemini-flash-latest",
  "models/gemini-flash-lite-latest",
  "models/gemini-pro-latest"
].filter(Boolean) as string[];

async function runWithFallback(
  fn: (modelName: string) => Promise<any>,
  errorContext: string
): Promise<any> {
  let lastError: any = null;

  for (const modelName of MODELS) {
    try {
      console.log(`Attempting Gemini call with model: ${modelName} for ${errorContext}`);
      return await fn(modelName);
    } catch (error: any) {
      lastError = error;
      const errorMessage = error.message || String(error);
      const isLocationError = errorMessage.toLowerCase().includes("location") || errorMessage.toLowerCase().includes("supported region");
      const isQuotaError = error.status === 429 || errorMessage.toLowerCase().includes("quota");

      // Log to a file to ensure we see it
      try {
        const fs = await import('fs');
        fs.appendFileSync('ai-debug.log', `[${new Date().toISOString()}] Model: ${modelName} | Error: ${errorMessage}\n`);
      } catch (e) {}

      console.warn(`Gemini model ${modelName} failed for ${errorContext}:`, errorMessage);

      if (isQuotaError || isLocationError) {
        if (isQuotaError) {
          // Wait briefly to avoid hitting shared bucket limits too fast
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue; // Try next model
      }

      // For other errors, we still try next model as a general fallback unless it's a code error
      if (error instanceof TypeError || error instanceof SyntaxError) {
        throw error;
      }
      continue;
    }
  }

  // If we reach here, all models failed
  if (lastError?.status === 429 || lastError?.message?.toLowerCase().includes("quota")) {
    throw new Error("QUOTA_EXCEEDED");
  }
  
  if (lastError?.message?.toLowerCase().includes("location") || lastError?.message?.toLowerCase().includes("supported region")) {
    throw new Error("LOCATION_NOT_SUPPORTED");
  }

  throw lastError;
}

export async function getDoubtCleared(query: string, context?: string, history: { role: 'user' | 'ai', content: string }[] = []) {
  const systemInstruction = "You are StudySphere AI, a helpful tutor. Explain clearly using simple language and bullet points.";
  
  try {
    return await runWithFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
      });
      
      // Transform history to Gemini format (excluding the very first welcome message if it's there)
      const geminiHistory = history
        .filter(h => !h.content.includes("I'm your **StudySphere AI Tutor**")) // Skip the welcome message
        .map(h => ({
          role: h.role === 'ai' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }));
      
      // Prepare the current query with context if available
      const actualQuery = context 
        ? `System Instruction: ${systemInstruction}\n\nContext from student notes: ${context}\n\nQuestion: ${query}`
        : `System Instruction: ${systemInstruction}\n\nQuestion: ${query}`;

      const chat = model.startChat({
        history: geminiHistory,
      });

      const result = await chat.sendMessage(actualQuery);
      const response = await result.response;
      return response.text() || "I couldn't process that question.";
    }, "getDoubtCleared");
  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED") {
      return "⚠️ **API Limit Reached:** I'm currently experiencing high traffic. Please try again in a few minutes.";
    }
    if (error.message === "LOCATION_NOT_SUPPORTED") {
      return "⚠️ **Region Not Supported:** This AI model is not available in your region. Please check your Google AI Studio settings.";
    }
    throw error;
  }
}

export async function generateQuizFromNotes(
  notesContent: string,
  numQuestions: number = 5
): Promise<QuizQuestion[]> {
  const prompt = `
You are an expert educational AI. 
Create exactly ${numQuestions} multiple-choice questions based STRICTLY and EXCLUSIVELY on the provided notes below.

CRITICAL RULES:
1. Do NOT use outside knowledge. If the answer is not extractable directly from the notes, do not create the question.
2. Ensure every correct answer is unambiguous and explicitly supported by the text.
3. Keep the explanations concise and directly reference the concept from the notes.

Return ONLY a JSON array, nothing else.

Notes:
${notesContent}
`;

  try {
    return await runWithFallback(async (modelName) => {
      const config: any = { model: modelName };
      
      // JSON mode and schema only supported in 1.5+
      // JSON mode and schema support in modern Gemini models
      if (modelName.includes("1.5") || modelName.includes("2.0") || modelName.includes("2.5") || modelName.includes("3.0") || modelName.includes("3.1") || modelName.includes("flash") || modelName.includes("pro")) {
        config.generationConfig = {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                question: { type: SchemaType.STRING },
                options: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                correctAnswer: { type: SchemaType.INTEGER },
                explanation: { type: SchemaType.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        };
      }

      const model = genAI.getGenerativeModel(config);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = (response.text() || "[]").trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) text = jsonMatch[0];
      return JSON.parse(text);
    }, "generateQuizFromNotes");
  } catch (e: any) {
    console.error("Quiz generation failed:", e);
    return Array.from({ length: numQuestions }).map((_, i) => ({
      question: `Fallback Question ${i + 1} (Service Unavailable)`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: 0,
      explanation: "This is a fallback generated because the AI service encountered an error (Quota or Regional restriction)."
    }));
  }
}

export async function getQuizInsights(
  wrongAnswers: {
    question: string,
    answer: string,
    correct: string,
    explanation: string
  }[]
): Promise<string> {
  if (wrongAnswers.length === 0) return "Excellent! You answered everything correctly.";

  const prompt = `
The student missed these questions:
${wrongAnswers.map((w,i)=>`
${i+1}. ${w.question}
Student Answer: ${w.answer}
Correct Answer: ${w.correct}
Explanation: ${w.explanation}`).join("\n")}

Write a Weak Point Analysis based purely on the missed concepts.
Your response MUST match the following markdown structure:

Weak Areas:
* [Topic 1]
* [Topic 2]

Recommendations:
* [Actionable tip 1]
* [Actionable tip 2]
`;

  try {
    return await runWithFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || "Review the topics you missed.";
    }, "getQuizInsights");
  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED") {
      return "⚠️ **API Limit Reached:** Focused review of your incorrect answers is recommended while the AI resets.";
    }
    return "Review the topics you missed. (AI insights currently unavailable)";
  }
}

export async function getSummary(
  text: string,
  format: 'bullet' | 'paragraph' | 'key-points',
  fileContent?: { data: string, mimeType: string }
): Promise<string> {
  const formatInstruction = {
    bullet: "Return bullet points.",
    paragraph: "Return one paragraph summary.",
    "key-points": "Return key concepts with explanations."
  };

  const prompt = `
You are StudySphere AI summarizer.
Summarize the following content.
Format: ${formatInstruction[format]}
Content: ${text}`;

  try {
    return await runWithFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({ model: modelName });
      
      let promptConfig: any[] = [prompt];
      if (fileContent) {
        promptConfig = [
          {
            inlineData: {
              data: fileContent.data,
              mimeType: fileContent.mimeType,
            },
          },
          prompt,
        ];
      }

      const result = await model.generateContent(promptConfig);
      const response = await result.response;
      return response.text() || "Could not generate summary.";
    }, "getSummary");
  } catch (error: any) {
    if (error.message === "QUOTA_EXCEEDED") {
      return "⚠️ **API Limit Reached:** Quota exceeded. Please try again later.";
    }
    if (error.message === "LOCATION_NOT_SUPPORTED") {
      return "⚠️ **Region Not Supported:** This AI model is not available in your region. Please check your Google AI Studio settings.";
    }
    return `Summary unavailable: ${error.message || "service error"}.`;
  }
}