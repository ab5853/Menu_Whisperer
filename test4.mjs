import { GoogleGenAI } from '@google/genai';

async function test() {
    const ai = new GoogleGenAI({ apiKey: 'fake' });
    try {
      const session = await ai.live.connect({ model: "gemini-2.0-flash-exp" });
      console.log('Session proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(session)));
    } catch(e) {
      console.log('Error', e.message);
    }
}
test();
