const express = require('express');
const { Client: FTPClient } = require('basic-ftp');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configurar Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Asegurar directorio de uploads
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Almacenar conexiones FTP
const ftpConnections = new Map();

// Conectar al servidor FTP
app.post('/api/connect', async (req, res) => {
    const { sessionId, host, port, user, password } = req.body;
    
    try {
        const client = new FTPClient();
        client.ftp.verbose = true;
        
        await client.access({
            host,
            port: port || 21,
            user,
            password,
            secure: false
        });
        
        ftpConnections.set(sessionId, client);
        
        res.json({ 
            success: true, 
            message: 'Conectado al servidor FTP',
            currentDir: await client.pwd()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Listar archivos y directorios
app.post('/api/list', async (req, res) => {
    const { sessionId, path } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        if (path) {
            await client.cd(path);
        }
        
        const list = await client.list();
        const currentDir = await client.pwd();
        
        res.json({ 
            success: true, 
            files: list.map(item => ({
                name: item.name,
                size: item.size,
                type: item.type === 1 ? 'file' : 'directory',
                date: item.modifiedAt,
                permissions: item.permissions
            })),
            currentDir
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cambiar directorio
app.post('/api/cd', async (req, res) => {
    const { sessionId, path } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        await client.cd(path);
        const currentDir = await client.pwd();
        res.json({ success: true, currentDir });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Subir archivo
app.post('/api/upload', upload.single('file'), async (req, res) => {
    const { sessionId, remotePath } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        const localPath = req.file.path;
        const remoteFile = remotePath || req.file.originalname;
        
        await client.uploadFrom(localPath, remoteFile);
        
        // Eliminar archivo local después de subir
        fs.unlinkSync(localPath);
        
        res.json({ success: true, message: 'Archivo subido exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Descargar archivo
app.post('/api/download', async (req, res) => {
    const { sessionId, remotePath, filename } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        const localPath = path.join('./uploads', filename);
        await client.downloadTo(localPath, remotePath);
        
        res.json({ 
            success: true, 
            message: 'Archivo descargado',
            downloadUrl: `/uploads/${filename}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar archivo
app.post('/api/delete', async (req, res) => {
    const { sessionId, path, type } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        if (type === 'directory') {
            await client.removeDir(path);
        } else {
            await client.remove(path);
        }
        
        res.json({ success: true, message: 'Eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Renombrar archivo
app.post('/api/rename', async (req, res) => {
    const { sessionId, oldPath, newPath } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        await client.rename(oldPath, newPath);
        res.json({ success: true, message: 'Renombrado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear directorio
app.post('/api/mkdir', async (req, res) => {
    const { sessionId, path } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        await client.send(`MKD ${path}`);
        res.json({ success: true, message: 'Directorio creado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener tamaño de archivo
app.post('/api/size', async (req, res) => {
    const { sessionId, path } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (!client) {
        return res.status(400).json({ error: 'No conectado' });
    }
    
    try {
        const size = await client.size(path);
        res.json({ success: true, size });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Desconectar
app.post('/api/disconnect', async (req, res) => {
    const { sessionId } = req.body;
    const client = ftpConnections.get(sessionId);
    
    if (client) {
        client.close();
        ftpConnections.delete(sessionId);
    }
    
    res.json({ success: true, message: 'Desconectado' });
});

// Servir archivos descargados
app.use('/uploads', express.static('./uploads'));

app.listen(PORT, () => {
    console.log(`✅ Cliente FTP corriendo en http://localhost:${PORT}`);
    console.log(`📁 Archivos temporales en ./uploads/`);
});