import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post('/api/analyze-hotspot', async (req, res) => {
    try {
      const { title, description, projectContext, imageBase64 } = req.body;
      
      const parts = [];
      const prompt = `You are an advanced industrial engineering AI assistant. Analyze the information provided about a specific component or hotspot in a 3D/AR model.
Project Context: ${projectContext || 'Industrial Equipment'}
Current Title: ${title || 'None'}
Current Description: ${description || 'None'}

Please provide an enhanced, professional, and highly technical title and description for this component.
If an image is provided, analyze the image deeply to identify the component, its material, purpose, visible wear, or key inspection points.
Format your response as a JSON object with two fields: "title" and "description".`;

      parts.push({ text: prompt });
      
      if (imageBase64) {
         // Assuming imageBase64 comes as "data:image/jpeg;base64,......."
         const mimeType = imageBase64.split(';')[0].split(':')[1];
         const data = imageBase64.split(',')[1];
         parts.push({
            inlineData: {
               data,
               mimeType
            }
         });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
        config: {
           responseMimeType: 'application/json',
           thinkingConfig: { thinkingBudgetTokens: 1024 }, // Or just not specify for default high thinking
        }
      });

      res.json({ result: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/generate-thumbnail', async (req, res) => {
    try {
      const { prompt, aspectRatio = '16:9', imageSize = '1K' } = req.body;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview', // High quality model
        contents: {
          parts: [
            { text: `A high-quality, cinematic, highly detailed 3D render of an industrial machine component matching this description: ${prompt}. Dark background, studio lighting, photorealistic.` },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: imageSize
          }
        }
      });

      // Extract image data
      let base64Image = null;
      let mimeType = null;
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }

      if (!base64Image) {
        throw new Error('No image was generated');
      }

      res.json({ imageBase64: `data:${mimeType};base64,${base64Image}` });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
