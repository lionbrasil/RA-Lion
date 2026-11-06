import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// API Routes
app.post('/api/analyze-hotspot', async (req, res) => {
  try {
    const { title, description, projectContext, imageBase64 } = req.body;
    
    const parts: any[] = [];
    const prompt = `You are an advanced industrial engineering AI assistant. Analyze the information provided about a specific component or hotspot in a 3D/AR model.
Project Context: ${projectContext || 'Industrial Equipment'}
Current Title: ${title || 'None'}
Current Description: ${description || 'None'}

Please provide an enhanced, professional, and highly technical title and description for this component.
If an image is provided, analyze the image deeply to identify the component, its material, purpose, visible wear, or key inspection points.
Format your response as a JSON object with two fields: "title" and "description".`;

    parts.push({ text: prompt });
    
    if (imageBase64) {
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
         thinkingConfig: { thinkingBudget: 1024 },
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
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: `A high-quality, cinematic, highly detailed 3D render of an industrial machine component matching this description: ${prompt}. Dark background, studio lighting, photorealistic.` },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          // @ts-ignore
          imageSize: imageSize
        }
      }
    });

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

app.post('/api/generate-training', async (req, res) => {
  try {
    const { projectName, projectDescription, hotspots } = req.body;
    
    const prompt = `You are an expert technical trainer and industrial engineer.
Create a structured, step-by-step procedural training guide based on the following 3D model project data.

Project Name: ${projectName || 'Unknown'}
Project Description: ${projectDescription || 'None'}

Hotspots/Components available in this model:
${hotspots.map((h: any, i: number) => `${i + 1}. ${h.title}: ${h.description}`).join('\n')}

Based on the project name, description, and the available components, generate a logical sequence of steps for an inspection or operational procedure.
Each step should have a "title" and a "desc" (description).
Format the response strictly as a JSON object with a single field "steps", which is an array of objects.
Example output format:
{
  "steps": [
    { "title": "Step 1 Title", "desc": "Detailed instructions..." },
    { "title": "Step 2 Title", "desc": "Detailed instructions..." }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
         responseMimeType: 'application/json',
         thinkingConfig: { thinkingBudget: 1024 },
      }
    });

    res.json({ result: response.text });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// MATRIX HUB & CROSS-APP LINKING ENDPOINTS
// ==========================================
import fs from 'fs';
import path from 'path';

const MATRIX_DIR = path.resolve(process.cwd(), 'data', 'matrix');
const PROJECTS_DIR = path.join(MATRIX_DIR, 'projects');
const MODELS_DIR = path.join(MATRIX_DIR, 'models');
const THUMBNAILS_DIR = path.join(MATRIX_DIR, 'thumbnails');

[MATRIX_DIR, PROJECTS_DIR, MODELS_DIR, THUMBNAILS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper to enable CORS for matrix routes so other apps can bind
app.use('/api/matrix', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// GET all linked projects in matrix
app.get('/api/matrix/projects', async (req, res) => {
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(file => {
      try {
        const raw = fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }).filter(Boolean);

    list.sort((a, b) => new Date(b.matrixSyncedAt || 0).getTime() - new Date(a.matrixSyncedAt || 0).getTime());
    res.json({ success: true, count: list.length, projects: list });
  } catch (e: any) {
    console.error('Error listing matrix projects:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET a specific matrix project by ID (Used by mobile viewer, embedded iframe, or external app)
app.get('/api/matrix/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const projectFilePath = path.join(PROJECTS_DIR, `${id}.json`);
    
    if (!fs.existsSync(projectFilePath)) {
      return res.status(404).json({ error: 'Projeto não encontrado na Matriz.' });
    }

    const raw = fs.readFileSync(projectFilePath, 'utf-8');
    const data = JSON.parse(raw);
    
    res.json({
      success: true,
      project: data,
      hotspots: data.hotspots || [],
      modelUrl: data.modelUrl || `/api/matrix/models/${id}`,
      thumbnailUrl: data.thumbnailUrl || `/api/matrix/thumbnails/${id}`,
      matrixLinked: true,
      matrixVersion: data.matrixVersion || 1,
      matrixSyncedAt: data.matrixSyncedAt
    });
  } catch (e: any) {
    console.error('Error fetching matrix project:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/matrix/transfer - Execute transfer of project from Matrix into global hub with active binding
app.post('/api/matrix/transfer', async (req, res) => {
  try {
    const {
      project,
      hotspots,
      modelBase64,
      modelType,
      modelName,
      thumbnailBase64,
      thumbnailType
    } = req.body;

    if (!project || !project.id) {
      return res.status(400).json({ error: 'Dados do projeto ou ID ausentes.' });
    }

    const projectId = project.id;
    const projectFilePath = path.join(PROJECTS_DIR, `${projectId}.json`);

    let existingData: any = {};
    if (fs.existsSync(projectFilePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(projectFilePath, 'utf-8'));
      } catch (err) {
        // ignore parse error
      }
    }

    // Save model binary if provided
    let hasModel = existingData.hasModel || false;
    let finalModelFormat = project.modelFormat || existingData.modelFormat || 'glb';

    if (modelBase64) {
      const parts = modelBase64.split(';base64,');
      const b64 = parts.length > 1 ? parts[1] : parts[0];
      const buffer = Buffer.from(b64, 'base64');
      fs.writeFileSync(path.join(MODELS_DIR, `${projectId}.bin`), buffer);
      
      const detectedMime = modelType || (parts.length > 1 ? parts[0].replace('data:', '') : 'model/gltf-binary');
      fs.writeFileSync(path.join(MODELS_DIR, `${projectId}.meta.json`), JSON.stringify({
        mimeType: detectedMime,
        name: modelName || `${projectId}.${finalModelFormat}`
      }));
      hasModel = true;
    }

    // Save thumbnail binary if provided
    let hasThumbnail = existingData.hasThumbnail || false;
    if (thumbnailBase64) {
      const parts = thumbnailBase64.split(';base64,');
      const b64 = parts.length > 1 ? parts[1] : parts[0];
      const buffer = Buffer.from(b64, 'base64');
      fs.writeFileSync(path.join(THUMBNAILS_DIR, `${projectId}.bin`), buffer);
      
      const detectedMime = thumbnailType || (parts.length > 1 ? parts[0].replace('data:', '') : 'image/png');
      fs.writeFileSync(path.join(THUMBNAILS_DIR, `${projectId}.meta.json`), JSON.stringify({
        mimeType: detectedMime
      }));
      hasThumbnail = true;
    }

    const nextVersion = (existingData.matrixVersion || 0) + 1;
    const syncedAt = new Date().toISOString();

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const record = {
      ...project,
      id: projectId,
      hotspots: hotspots || [],
      modelFormat: finalModelFormat,
      hasModel,
      hasThumbnail,
      modelUrl: hasModel ? `/api/matrix/models/${projectId}` : (project.modelUrl || ''),
      thumbnailUrl: hasThumbnail ? `/api/matrix/thumbnails/${projectId}` : (project.thumbnailUrl || ''),
      matrixLinked: true,
      matrixVersion: nextVersion,
      matrixSyncedAt: syncedAt
    };

    fs.writeFileSync(projectFilePath, JSON.stringify(record, null, 2));

    const viewerUrl = `${baseUrl}/viewer/${projectId}`;
    const embedCode = `<iframe src="${viewerUrl}?embed=true" width="100%" height="600" frameborder="0" allow="camera; xr-spatial-tracking; display-capture; autoplay" style="border:1px solid #30363d; border-radius:12px; overflow:hidden;"></iframe>`;

    res.json({
      success: true,
      matrixId: projectId,
      matrixVersion: nextVersion,
      matrixSyncedAt: syncedAt,
      modelUrl: record.modelUrl,
      thumbnailUrl: record.thumbnailUrl,
      viewerUrl,
      embedCode,
      message: 'Projeto transferido para a Matriz com vínculo ativo!'
    });
  } catch (e: any) {
    console.error('Error transferring project to matrix:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/matrix/sync/:id - Live sync updates from Matrix or connected apps
app.post('/api/matrix/sync/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const projectFilePath = path.join(PROJECTS_DIR, `${id}.json`);

    if (!fs.existsSync(projectFilePath)) {
      return res.status(404).json({ error: 'Projeto não encontrado na Matriz para sincronização.' });
    }

    const current = JSON.parse(fs.readFileSync(projectFilePath, 'utf-8'));
    const updates = req.body;

    const nextVersion = (current.matrixVersion || 1) + 1;
    const syncedAt = new Date().toISOString();

    const updated = {
      ...current,
      ...updates,
      id,
      matrixLinked: true,
      matrixVersion: nextVersion,
      matrixSyncedAt: syncedAt
    };

    fs.writeFileSync(projectFilePath, JSON.stringify(updated, null, 2));

    res.json({
      success: true,
      matrixId: id,
      matrixVersion: nextVersion,
      matrixSyncedAt: syncedAt,
      project: updated,
      message: 'Vínculo da Matriz sincronizado com sucesso.'
    });
  } catch (e: any) {
    console.error('Error syncing matrix project:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/matrix/models/:id - Stream 3D model or image with direct WebAR mime support
app.get('/api/matrix/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const binPath = path.join(MODELS_DIR, `${id}.bin`);
    const metaPath = path.join(MODELS_DIR, `${id}.meta.json`);

    if (!fs.existsSync(binPath)) {
      return res.status(404).send('Modelo 3D não encontrado no servidor da Matriz.');
    }

    let mimeType = 'model/gltf-binary';
    let filename = `${id}.glb`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta.mimeType) mimeType = meta.mimeType;
        if (meta.name) filename = meta.name;
      } catch (err) {}
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const fileStream = fs.createReadStream(binPath);
    fileStream.pipe(res);
  } catch (e: any) {
    console.error('Error streaming matrix model:', e);
    res.status(500).send('Erro ao carregar modelo.');
  }
});

// GET /api/matrix/thumbnails/:id - Stream project preview thumbnail
app.get('/api/matrix/thumbnails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const binPath = path.join(THUMBNAILS_DIR, `${id}.bin`);
    const metaPath = path.join(THUMBNAILS_DIR, `${id}.meta.json`);

    if (!fs.existsSync(binPath)) {
      return res.status(404).send('Thumbnail não encontrado.');
    }

    let mimeType = 'image/png';
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta.mimeType) mimeType = meta.mimeType;
      } catch (err) {}
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const fileStream = fs.createReadStream(binPath);
    fileStream.pipe(res);
  } catch (e: any) {
    console.error('Error streaming thumbnail:', e);
    res.status(500).send('Erro ao carregar thumbnail.');
  }
});

export default app;

