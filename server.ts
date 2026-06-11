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

  app.use(express.json());

  // API Routes
  app.post('/api/generate-description', async (req, res) => {
    try {
      const { title, context } = req.body;
      const prompt = `Gere uma descrição técnica e detalhada para um componente de máquina industrial.
Título do Componente: ${title}
Contexto do Projeto: ${context || 'Equipamento pesado / Manutenção Industrial'}
      
Instruções:
- Seja direto, profissional e focado em engenharia/manutenção.
- Cite possíveis pontos de falha ou inspeção visual recomendada.
- Máximo de 3 parágrafos.
- Aja como um sistema avançado de IA da plataforma RA Lion.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      res.json({ text: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/generate-thumbnail', async (req, res) => {
    try {
      const { prompt } = req.body;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts: [
            { text: `A high-quality, cinematic, highly detailed 3D render of an industrial machine component matching this description: ${prompt}. Dark background, studio lighting, photorealistic.` },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
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
