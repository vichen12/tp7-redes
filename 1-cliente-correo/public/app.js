const API_URL = 'http://localhost:3000/api';
const userId = 'user-' + Date.now();
let currentEmails = [];
let currentEmail = null;

function showStatus(message, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    setTimeout(() => status.textContent = '', 5000);
}

function saveConfig() {
    const config = {
        userId,
        smtp: {
            host: document.getElementById('smtp-host').value,
            port: parseInt(document.getElementById('smtp-port').value),
            user: document.getElementById('smtp-user').value,
            password: document.getElementById('smtp-pass').value,
            secure: document.getElementById('smtp-secure').checked
        },
        imap: {
            host: document.getElementById('imap-host').value,
            port: parseInt(document.getElementById('imap-port').value),
            user: document.getElementById('imap-user').value,
            password: document.getElementById('imap-pass').value,
            tls: document.getElementById('imap-tls').checked
        },
        pop3: {
            host: document.getElementById('pop3-host').value,
            port: parseInt(document.getElementById('pop3-port').value),
            user: document.getElementById('pop3-user').value,
            password: document.getElementById('pop3-pass').value,
            tls: document.getElementById('pop3-tls').checked
        }
    };

    fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
    .then(res => res.json())
    .then(data => {
        showStatus('Configuración guardada exitosamente', 'success');
        document.getElementById('config-panel').style.display = 'none';
        document.getElementById('main-panel').style.display = 'block';
    })
    .catch(err => showStatus('Error al guardar configuración: ' + err.message, 'error'));
}

function showConfig() {
    document.getElementById('main-panel').style.display = 'none';
    document.getElementById('config-panel').style.display = 'block';
}

function showCompose() {
    document.getElementById('compose-panel').style.display = 'block';
    document.getElementById('to').value = '';
    document.getElementById('cc').value = '';
    document.getElementById('bcc').value = '';
    document.getElementById('subject').value = '';
    document.getElementById('body').value = '';
}

function hideCompose() {
    document.getElementById('compose-panel').style.display = 'none';
}

function showSearch() {
    document.getElementById('search-panel').style.display = 'block';
}

function hideSearch() {
    document.getElementById('search-panel').style.display = 'none';
}

function sendEmail() {
    const emailData = {
        userId,
        to: document.getElementById('to').value,
        cc: document.getElementById('cc').value,
        bcc: document.getElementById('bcc').value,
        subject: document.getElementById('subject').value,
        body: document.getElementById('body').value
    };

    if (!emailData.to || !emailData.subject) {
        showStatus('Por favor completa los campos obligatorios', 'error');
        return;
    }

    showStatus('Enviando correo...', 'info');

    fetch(`${API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
    })
    .then(res => res.json())
    .then(data => {
        showStatus('Correo enviado exitosamente', 'success');
        hideCompose();
    })
    .catch(err => showStatus('Error al enviar: ' + err.message, 'error'));
}

function fetchEmails(protocol = 'imap') {
    showStatus(`Obteniendo correos vía ${protocol.toUpperCase()}...`, 'info');

    const endpoint = protocol === 'imap' ? '/fetch-imap' : '/fetch-pop3';

    fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, limit: 50 })
    })
    .then(res => res.json())
    .then(data => {
        currentEmails = data.emails || [];
        displayEmails(currentEmails);
        showStatus(`${currentEmails.length} correos obtenidos`, 'success');
    })
    .catch(err => showStatus('Error al obtener correos: ' + err.message, 'error'));
}

function displayEmails(emails) {
    const emailList = document.getElementById('email-list');
    
    if (!emails || emails.length === 0) {
        emailList.innerHTML = '<div class="empty-state">No hay correos para mostrar</div>';
        return;
    }

    emailList.innerHTML = emails.map((email, index) => `
        <div class="email-item" onclick="viewEmail(${index})">
            <div class="email-from">${email.from || 'Sin remitente'}</div>
            <div class="email-subject">${email.subject || 'Sin asunto'}</div>
            <div class="email-date">${new Date(email.date).toLocaleDateString()}</div>
            <div class="email-preview">${(email.body || '').substring(0, 100)}...</div>
        </div>
    `).join('');
}

function viewEmail(index) {
    currentEmail = currentEmails[index];
    const viewer = document.getElementById('email-viewer');
    const content = document.getElementById('email-content');

    content.innerHTML = `
        <h2>${currentEmail.subject || 'Sin asunto'}</h2>
        <div class="email-meta">
            <p><strong>De:</strong> ${currentEmail.from || 'Desconocido'}</p>
            <p><strong>Para:</strong> ${currentEmail.to || 'Desconocido'}</p>
            <p><strong>Fecha:</strong> ${new Date(currentEmail.date).toLocaleString()}</p>
        </div>
        <div class="email-body">${currentEmail.body || 'Sin contenido'}</div>
    `;

    viewer.style.display = 'block';
}

function hideViewer() {
    document.getElementById('email-viewer').style.display = 'none';
}

function replyEmail() {
    if (!currentEmail) return;
    
    showCompose();
    document.getElementById('to').value = currentEmail.from;
    document.getElementById('subject').value = 'Re: ' + (currentEmail.subject || '');
    document.getElementById('body').value = '\n\n--- Mensaje original ---\n' + currentEmail.body;
    hideViewer();
}

function forwardEmail() {
    if (!currentEmail) return;
    
    showCompose();
    document.getElementById('subject').value = 'Fwd: ' + (currentEmail.subject || '');
    document.getElementById('body').value = '\n\n--- Mensaje reenviado ---\n' + currentEmail.body;
    hideViewer();
}

function deleteEmail() {
    if (!currentEmail || !currentEmail.seqno) {
        showStatus('No se puede eliminar este correo', 'error');
        return;
    }

    if (!confirm('¿Estás seguro de eliminar este correo?')) return;

    fetch(`${API_URL}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, seqno: currentEmail.seqno })
    })
    .then(res => res.json())
    .then(data => {
        showStatus('Correo eliminado', 'success');
        hideViewer();
        fetchEmails('imap');
    })
    .catch(err => showStatus('Error al eliminar: ' + err.message, 'error'));
}

function searchEmails() {
    const criteria = {
        from: document.getElementById('search-from').value,
        to: document.getElementById('search-to').value,
        subject: document.getElementById('search-subject').value,
        body: document.getElementById('search-body').value
    };

    showStatus('Buscando correos...', 'info');

    fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, criteria })
    })
    .then(res => res.json())
    .then(data => {
        currentEmails = data.emails || [];
        displayEmails(currentEmails);
        hideSearch();
        showStatus(`${currentEmails.length} correos encontrados`, 'success');
    })
    .catch(err => showStatus('Error en la búsqueda: ' + err.message, 'error'));
}