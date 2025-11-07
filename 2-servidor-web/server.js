const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const basicAuth = require('express-basic-auth');

const app = express();
let config = {};
let users = {};

// Cargar configuración
async function loadConfig() {
    try {
        if (await fs.pathExists('config.json')) {
            config = await fs.readJson('config.json');
        } else {
            config = {
                port: 8080,
                documentRoot: './public',
                serverName: 'Mi Servidor Web',
                enableLogging: true,
                logFile: './logs/access.log',
                protectedDirs: {},
                allowedDirectories: ['public']
            };
            await fs.writeJson('config.json', config, { spaces: 2 });
        }
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

// Cargar usuarios
async function loadUsers() {
    try {
        if (await fs.pathExists('users.json')) {
            users = await fs.readJson('users.json');
        } else {
            users = {
                admin: 'admin123'
            };
            await fs.writeJson('users.json', users, { spaces: 2 });
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

// Middleware de seguridad
app.use(helmet({
    contentSecurityPolicy: false
}));

// Crear directorio de logs si no existe
fs.ensureDirSync('./logs');

// Logging personalizado
const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs/access.log'),
    { flags: 'a' }
);

app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // También log en consola

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware de seguridad de rutas
app.use((req, res, next) => {
    const requestedPath = path.normalize(req.path);
    
    // Bloquear acceso a directorios fuera del DocumentRoot
    if (requestedPath.includes('..')) {
        res.status(403).send('Acceso denegado: Intento de directory traversal');
        return;
    }

    // Bloquear acceso a archivos de configuración
    const dangerousFiles = ['config.json', 'users.json', 'package.json', 'server.js'];
    if (dangerousFiles.some(file => requestedPath.includes(file))) {
        res.status(403).send('Acceso denegado: Archivo protegido');
        return;
    }

    next();
});

// Protección con usuario y contraseña para directorios específicos
function protectDirectory(dir) {
    return basicAuth({
        users: users,
        challenge: true,
        realm: `Área Protegida: ${dir}`
    });
}

// API para obtener configuración
app.get('/api/config', (req, res) => {
    res.json(config);
});

// API para actualizar configuración
app.post('/api/config', async (req, res) => {
    try {
        config = { ...config, ...req.body };
        await fs.writeJson('config.json', config, { spaces: 2 });
        res.json({ success: true, message: 'Configuración actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API para obtener usuarios
app.get('/api/users', (req, res) => {
    res.json(Object.keys(users));
});

// API para agregar/modificar usuario
app.post('/api/users', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }
        users[username] = password;
        await fs.writeJson('users.json', users, { spaces: 2 });
        res.json({ success: true, message: 'Usuario guardado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API para eliminar usuario
app.delete('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (username === 'admin') {
            return res.status(400).json({ error: 'No se puede eliminar el usuario admin' });
        }
        delete users[username];
        await fs.writeJson('users.json', users, { spaces: 2 });
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API para agregar directorio protegido
app.post('/api/protect-dir', async (req, res) => {
    try {
        const { directory } = req.body;
        if (!directory) {
            return res.status(400).json({ error: 'Directorio requerido' });
        }
        config.protectedDirs[directory] = true;
        await fs.writeJson('config.json', config, { spaces: 2 });
        res.json({ success: true, message: 'Directorio protegido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API para obtener logs
app.get('/api/logs', async (req, res) => {
    try {
        const logFile = path.join(__dirname, 'logs/access.log');
        if (await fs.pathExists(logFile)) {
            const logs = await fs.readFile(logFile, 'utf8');
            const lines = logs.split('\n').slice(-100).reverse(); // Últimas 100 líneas
            res.json({ logs: lines });
        } else {
            res.json({ logs: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Panel de administración (protegido)
app.use('/admin', protectDirectory('admin'), express.static('public/admin'));

// Servir archivos estáticos del DocumentRoot
app.use(express.static(config.documentRoot || 'public'));

// Página de inicio por defecto
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${config.serverName || 'Servidor Web'}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                }
                h1 { font-size: 3em; margin-bottom: 20px; }
                p { font-size: 1.2em; }
                .links {
                    margin-top: 30px;
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                }
                a {
                    background: white;
                    color: #667eea;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    transition: all 0.3s;
                }
                a:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
            </style>
        </head>
        <body>
            <h1>🌐 ${config.serverName || 'Servidor Web'}</h1>
            <p>Servidor HTTP funcionando correctamente</p>
            <p>Puerto: ${config.port || 8080}</p>
            <div class="links">
                <a href="/admin">Panel de Administración</a>
            </div>
        </body>
        </html>
    `);
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>404 - No Encontrado</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: #f8f9fa;
                }
                h1 { color: #dc3545; font-size: 4em; }
                p { font-size: 1.2em; color: #666; }
            </style>
        </head>
        <body>
            <h1>404</h1>
            <p>Página no encontrada</p>
            <a href="/">Volver al inicio</a>
        </body>
        </html>
    `);
});

// Iniciar servidor
async function start() {
    await loadConfig();
    await loadUsers();
    
    app.listen(config.port, () => {
        console.log(`✅ Servidor Web HTTP corriendo en http://localhost:${config.port}`);
        console.log(`📁 DocumentRoot: ${config.documentRoot}`);
        console.log(`📝 Logging: ${config.enableLogging ? 'Activado' : 'Desactivado'}`);
        console.log(`🔐 Panel Admin: http://localhost:${config.port}/admin`);
        console.log(`   Usuario: admin | Contraseña: admin123`);
    });
}

start();