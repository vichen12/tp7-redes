📦 Proyecto de Redes y Comunicaciones
Materia: Redes y Comunicaciones
Fecha: Noviembre 2024

📋 ¿Qué es este proyecto?
Este proyecto contiene 4 aplicaciones de red:

📧 Cliente de Correo - Enviar y recibir emails
🌐 Servidor Web HTTP - Servidor web con panel admin
💬 Sistema de Chat - Mensajes instantáneos
📁 Cliente FTP - Subir y descargar archivos


💻 Instalación Rápida
1. Instalar Node.js

Ir a: https://nodejs.org/
Descargar versión LTS
Instalar y listo

2. Instalar dependencias (solo primera vez)
bashcd 1-cliente-correo
npm install

cd ../2-servidor-web
npm install

cd ../3-chat-mensajeria
npm install

cd ../4-cliente-ftp
npm install
3. Ejecutar aplicaciones
Abrir 4 terminales y en cada una:
bash# Terminal 1
cd 1-cliente-correo
npm start

# Terminal 2
cd 2-servidor-web
npm start

# Terminal 3
cd 3-chat-mensajeria
npm start

# Terminal 4
cd 4-cliente-ftp
npm start
```

---

## 📱 Acceso Rápido

| Aplicación | URL | Credenciales |
|------------|-----|--------------|
| 📧 Correo | http://localhost:3000 | - |
| 🌐 Servidor Web | http://localhost:8080 | - |
| 🔐 Panel Admin | http://localhost:8080/admin | admin / admin123 |
| 💬 Chat | http://localhost:4000 | - |
| 📁 FTP | http://localhost:5000 | - |

---

## 📚 Descripción de Aplicaciones

### 1. 📧 Cliente de Correo

**Protocolos:** SMTP, IMAP, POP3

**Funciones:**
- ✉️ Enviar correos
- 📥 Recibir correos
- ↩️ Responder y ➡️ Reenviar
- 🗑️ Eliminar
- 🔍 Buscar por: remitente, destinatario, asunto, contenido


```
**Resultado:**

✅ Correo enviado exitosamente
📧 Bandeja: 15 mensajes recibidos
🔍 Búsqueda: 3 correos encontrados
```

---

### 2. 🌐 Servidor Web HTTP

**Protocolo:** HTTP

**Funciones:**
- 📝 Logging de accesos
- 🔒 Seguridad (bloqueo directory traversal)
- ⚙️ Panel de configuración web
- 👥 Protección con usuarios


```
**Resultado del log:**
::1 - - [06/Nov/2024:14:23:45] "GET /index.html" 200
::1 - admin [06/Nov/2024:14:24:05] "GET /admin" 200
::1 - - [06/Nov/2024:14:25:33] "GET /../config.json" 403
```

**Panel Admin permite:**
- Configurar puerto y carpeta raíz
- Crear/eliminar usuarios
- Proteger directorios
- Ver logs en tiempo real

---

### 3. 💬 Sistema de Chat

**Protocolo:** WebSockets (basado en XMPP)

**Funciones:**
- 💬 Múltiples canales (#general, #random, #tech)
- 👤 Mensajes privados
- 📎 Envío de archivos (máx 10MB)
- 👥 Perfiles con foto
- 💾 Guardar conversaciones
- 📝 Logging de mensajes


```

**Resultado:**
✅ Usuario conectado: Juan
💬 Mensaje enviado en #general
📎 Archivo compartido: documento.pdf
💾 Conversación guardada en: conversations/chat_2024-11-06.json
```

**Características:**
- Indicador "escribiendo..."
- Lista de usuarios en línea
- Marcas de tiempo
- Notificaciones

---

### 4. 📁 Cliente FTP

**Protocolo:** FTP

**Comandos implementados:**
- Navegación: `LIST`, `CWD`, `PWD`, `CDUP`
- Archivos: `RETR`, `STOR`, `DELE`
- Carpetas: `MKD`, `RMD`
- Otros: `RNFR`, `RNTO`, `USER`, `PASS`

```

**Resultado:**
✅ Conectado a ftp.ejemplo.com
📁 Directorio actual: /documentos
📥 Descargando: archivo.pdf (2.5 MB)
📤 Subiendo: reporte.docx
✅ Archivo subido exitosamente
```

**Servidor FTP de prueba:**
```
Host: ftp.dlptest.com
Puerto: 21
Usuario: dlpuser
Contraseña: rNrKYTX9g7z3RgJRmxWuGHbeu

✅ Requisitos Cumplidos
RequisitoEstadoCorreo: SMTP, IMAP, POP3✅Correo: Reenviar, responder, eliminar✅Correo: Búsqueda avanzada✅HTTP: Protocolo completo✅HTTP: Logging✅HTTP: Seguridad DocumentRoot✅HTTP: Interfaz configuración✅HTTP: Protección directorios✅Chat: Canales y privados✅Chat: Protocolo XMPP✅Chat: Envío archivos✅Chat: Perfiles con foto✅Chat: Guardar conversaciones✅Chat: Logging✅FTP: Comandos principales✅FTP: Subir/bajar archivos✅

🔧 Solución Rápida de Problemas
ProblemaSolución"npm no reconocido"Reinstalar Node.js"Puerto en uso"Cerrar otras aplicacionesGmail no funcionaUsar contraseña de aplicación de GoogleNo conectaVerificar URL y que servidor esté corriendo


