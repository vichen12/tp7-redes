const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const POP3Client = require('poplib');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Almacenar configuraciones de usuario en memoria
const userConfigs = new Map();

// Endpoint para configurar cuenta
app.post('/api/config', (req, res) => {
  const { userId, smtp, imap, pop3 } = req.body;
  userConfigs.set(userId, { smtp, imap, pop3 });
  res.json({ success: true, message: 'Configuración guardada' });
});

// Endpoint para enviar correo (SMTP)
app.post('/api/send', async (req, res) => {
  try {
    const { userId, to, subject, body, cc, bcc } = req.body;
    const config = userConfigs.get(userId);
    
    if (!config || !config.smtp) {
      return res.status(400).json({ error: 'Configuración SMTP no encontrada' });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password
      }
    });

    await transporter.sendMail({
      from: config.smtp.user,
      to,
      cc,
      bcc,
      subject,
      text: body,
      html: body
    });

    res.json({ success: true, message: 'Correo enviado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener correos (IMAP)
app.post('/api/fetch-imap', (req, res) => {
  const { userId, folder = 'INBOX', limit = 50 } = req.body;
  const config = userConfigs.get(userId);

  if (!config || !config.imap) {
    return res.status(400).json({ error: 'Configuración IMAP no encontrada' });
  }

  const imap = new Imap({
    user: config.imap.user,
    password: config.imap.password,
    host: config.imap.host,
    port: config.imap.port,
    tls: config.imap.tls
  });

  const emails = [];

  imap.once('ready', () => {
    imap.openBox(folder, true, (err, box) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const fetch = imap.seq.fetch(`1:${Math.min(limit, box.messages.total)}`, {
        bodies: '',
        struct: true
      });

      fetch.on('message', (msg, seqno) => {
        let emailData = { seqno };

        msg.on('body', (stream) => {
          simpleParser(stream, (err, parsed) => {
            if (!err) {
              emailData = {
                ...emailData,
                from: parsed.from?.text,
                to: parsed.to?.text,
                subject: parsed.subject,
                date: parsed.date,
                body: parsed.text || parsed.html,
                attachments: parsed.attachments?.map(a => a.filename)
              };
              emails.push(emailData);
            }
          });
        });
      });

      fetch.once('end', () => {
        imap.end();
        res.json({ emails: emails.reverse() });
      });
    });
  });

  imap.once('error', (err) => {
    res.status(500).json({ error: err.message });
  });

  imap.connect();
});

// Endpoint para obtener correos (POP3)
app.post('/api/fetch-pop3', (req, res) => {
  const { userId, limit = 50 } = req.body;
  const config = userConfigs.get(userId);

  if (!config || !config.pop3) {
    return res.status(400).json({ error: 'Configuración POP3 no encontrada' });
  }

  const client = new POP3Client(config.pop3.port, config.pop3.host, {
    enabletls: config.pop3.tls
  });

  const emails = [];

  client.on('connect', () => {
    client.login(config.pop3.user, config.pop3.password);
  });

  client.on('login', (status) => {
    if (status) {
      client.list();
    } else {
      res.status(401).json({ error: 'Error de autenticación' });
      client.quit();
    }
  });

  client.on('list', (status, msgcount) => {
    if (status && msgcount > 0) {
      const toRetrieve = Math.min(limit, msgcount);
      for (let i = 1; i <= toRetrieve; i++) {
        client.retr(i);
      }
    } else {
      client.quit();
      res.json({ emails: [] });
    }
  });

  client.on('retr', (status, msgnumber, data) => {
    if (status) {
      simpleParser(data, (err, parsed) => {
        if (!err) {
          emails.push({
            id: msgnumber,
            from: parsed.from?.text,
            to: parsed.to?.text,
            subject: parsed.subject,
            date: parsed.date,
            body: parsed.text || parsed.html
          });
        }
        
        if (emails.length >= Math.min(limit, 50)) {
          client.quit();
          res.json({ emails: emails.reverse() });
        }
      });
    }
  });

  client.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// Endpoint para eliminar correo (IMAP)
app.post('/api/delete', (req, res) => {
  const { userId, seqno } = req.body;
  const config = userConfigs.get(userId);

  if (!config || !config.imap) {
    return res.status(400).json({ error: 'Configuración IMAP no encontrada' });
  }

  const imap = new Imap({
    user: config.imap.user,
    password: config.imap.password,
    host: config.imap.host,
    port: config.imap.port,
    tls: config.imap.tls
  });

  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      imap.seq.addFlags(seqno, '\\Deleted', (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          imap.expunge();
          res.json({ success: true, message: 'Correo eliminado' });
        }
        imap.end();
      });
    });
  });

  imap.connect();
});

// Endpoint para buscar correos
app.post('/api/search', (req, res) => {
  const { userId, criteria } = req.body;
  const config = userConfigs.get(userId);

  if (!config || !config.imap) {
    return res.status(400).json({ error: 'Configuración IMAP no encontrada' });
  }

  const imap = new Imap({
    user: config.imap.user,
    password: config.imap.password,
    host: config.imap.host,
    port: config.imap.port,
    tls: config.imap.tls
  });

  const emails = [];
  const searchCriteria = [];

  if (criteria.from) searchCriteria.push(['FROM', criteria.from]);
  if (criteria.to) searchCriteria.push(['TO', criteria.to]);
  if (criteria.subject) searchCriteria.push(['SUBJECT', criteria.subject]);
  if (criteria.body) searchCriteria.push(['BODY', criteria.body]);

  imap.once('ready', () => {
    imap.openBox('INBOX', true, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      imap.search(searchCriteria.length ? searchCriteria : ['ALL'], (err, results) => {
        if (err || !results.length) {
          imap.end();
          res.json({ emails: [] });
          return;
        }

        const fetch = imap.fetch(results, { bodies: '', struct: true });

        fetch.on('message', (msg, seqno) => {
          let emailData = { seqno };

          msg.on('body', (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (!err) {
                emailData = {
                  ...emailData,
                  from: parsed.from?.text,
                  to: parsed.to?.text,
                  subject: parsed.subject,
                  date: parsed.date,
                  body: parsed.text || parsed.html
                };
                emails.push(emailData);
              }
            });
          });
        });

        fetch.once('end', () => {
          imap.end();
          res.json({ emails: emails.reverse() });
        });
      });
    });
  });

  imap.connect();
});

app.listen(PORT, () => {
  console.log(`✅ Cliente de Correo corriendo en http://localhost:${PORT}`);
});