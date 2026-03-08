import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VITE_GEMINI_API_KEY=(.*)/);
const apiKey = match[1].trim();

async function test() {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.list();
  const models = [];
  for await (const page of response) {
      for (const model of page.models) {
          models.push(model.name);
      }
  }
  console.log("Models:", models);
}

test();


