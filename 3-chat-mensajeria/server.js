const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = 4000;

// Crear directorios necesarios
fs.ensureDirSync('./uploads');
fs.ensureDirSync('./logs');
fs.ensureDirSync('./conversations');

// Logging
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs/chat.log'),
    { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configurar Multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Base de datos en memoria
const users = new Map();
const channels = new Map();
const privateMessages = new Map();
const onlineUsers = new Map();

// Canales por defecto
channels.set('general', { name: 'General', messages: [] });
channels.set('random', { name: 'Random', messages: [] });
channels.set('tech', { name: 'Tecnología', messages: [] });

// Registro de usuario
app.post('/api/register', (req, res) => {
    const { username, password, name, bio } = req.body;
    
    if (users.has(username)) {
        return res.status(400).json({ error: 'Usuario ya existe' });
    }
    
    users.set(username, {
        username,
        password,
        name,
        bio: bio || '',
        avatar: '/uploads/default-avatar.png',
        createdAt: new Date()
    });
    
    res.json({ success: true, message: 'Usuario creado' });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.get(username);
    
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    res.json({ 
        success: true,
        user: {
            username: user.username,
            name: user.name,
            bio: user.bio,
            avatar: user.avatar
        }
    });
});

// Obtener perfil de usuario
app.get('/api/users/:username', (req, res) => {
    const user = users.get(req.params.username);
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({
        username: user.username,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        online: onlineUsers.has(user.username)
    });
});

// Actualizar perfil
app.post('/api/users/:username', (req, res) => {
    const user = users.get(req.params.username);
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const { name, bio } = req.body;
    user.name = name || user.name;
    user.bio = bio || user.bio;
    
    res.json({ success: true, user });
});

// Subir avatar
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    const { username } = req.body;
    const user = users.get(username);
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    user.avatar = '/uploads/' + req.file.filename;
    res.json({ success: true, avatar: user.avatar });
});

// Obtener canales
app.get('/api/channels', (req, res) => {
    const channelList = Array.from(channels.entries()).map(([id, channel]) => ({
        id,
        name: channel.name,
        messageCount: channel.messages.length
    }));
    res.json(channelList);
});

// Crear canal
app.post('/api/channels', (req, res) => {
    const { id, name } = req.body;
    
    if (channels.has(id)) {
        return res.status(400).json({ error: 'Canal ya existe' });
    }
    
    channels.set(id, { name, messages: [] });
    io.emit('channel-created', { id, name });
    res.json({ success: true });
});

// Subir archivo
app.post('/api/upload', upload.single('file'), (req, res) => {
    res.json({
        success: true,
        filename: req.file.filename,
        path: '/uploads/' + req.file.filename,
        size: req.file.size
    });
});

// Guardar conversación
app.post('/api/save-conversation', async (req, res) => {
    try {
        const { channel, messages } = req.body;
        const filename = `${channel}-${Date.now()}.json`;
        await fs.writeJson(path.join('./conversations', filename), messages, { spaces: 2 });
        res.json({ success: true, filename });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener usuarios online
app.get('/api/online-users', (req, res) => {
    res.json(Array.from(onlineUsers.values()));
});

// Socket.IO para tiempo real
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    socket.on('user-login', (userData) => {
        socket.username = userData.username;
        onlineUsers.set(userData.username, {
            username: userData.username,
            name: userData.name,
            socketId: socket.id
        });
        io.emit('user-online', Array.from(onlineUsers.values()));
    });
    
    socket.on('join-channel', (channelId) => {
        socket.join(channelId);
        const channel = channels.get(channelId);
        if (channel) {
            socket.emit('channel-history', channel.messages);
        }
    });
    
    socket.on('channel-message', (data) => {
        const channel = channels.get(data.channel);
        if (channel) {
            const message = {
                id: Date.now(),
                username: data.username,
                name: data.name,
                text: data.text,
                timestamp: new Date(),
                file: data.file
            };
            channel.messages.push(message);
            io.to(data.channel).emit('new-message', message);
            
            // Log
            logMessage('CHANNEL', data.channel, data.username, data.text);
        }
    });
    
    socket.on('private-message', (data) => {
        const messageId = [data.from, data.to].sort().join('-');
        if (!privateMessages.has(messageId)) {
            privateMessages.set(messageId, []);
        }
        
        const message = {
            id: Date.now(),
            from: data.from,
            to: data.to,
            text: data.text,
            timestamp: new Date(),
            file: data.file
        };
        
        privateMessages.get(messageId).push(message);
        
        const recipientSocket = onlineUsers.get(data.to);
        if (recipientSocket) {
            io.to(recipientSocket.socketId).emit('private-message', message);
        }
        socket.emit('private-message', message);
        
        // Log
        logMessage('PRIVATE', data.from + '->' + data.to, data.from, data.text);
    });
    
    socket.on('typing', (data) => {
        socket.to(data.channel).emit('user-typing', {
            username: data.username,
            channel: data.channel
        });
    });
    
    socket.on('disconnect', () => {
        if (socket.username) {
            onlineUsers.delete(socket.username);
            io.emit('user-offline', socket.username);
            io.emit('user-online', Array.from(onlineUsers.values()));
        }
        console.log('Usuario desconectado:', socket.id);
    });
});

function logMessage(type, channel, username, message) {
    const logEntry = `[${new Date().toISOString()}] [${type}] [${channel}] ${username}: ${message}\n`;
    fs.appendFile('./logs/messages.log', logEntry, (err) => {
        if (err) console.error('Error logging message:', err);
    });
}

server.listen(PORT, () => {
    console.log(`✅ Servidor de Chat corriendo en http://localhost:${PORT}`);
    console.log(`📝 Logs guardándose en ./logs/`);
    console.log(`📁 Archivos subidos en ./uploads/`);
});