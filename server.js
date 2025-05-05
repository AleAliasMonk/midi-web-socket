// server.js
const WebSocket = require('ws');

// Obtener el puerto de la variable de entorno PORT que Render asigna,
// o usar 8080 como fallback si PORT no está definido (útil para pruebas locales)
const PORT = process.env.PORT || 8080;

// Crear el servidor WebSocket usando el puerto correcto
const wss = new WebSocket.Server({ port: PORT });

// Añadir un log para confirmar el puerto en el que escucha
console.log(`Servidor WebSocket escuchando en el puerto ${PORT}`);


// 2. Almacenar las conexiones de los clientes (navegadores)
const clients = new Set();

// 3. Esto se ejecuta CADA VEZ que un navegador se conecta al servidor
wss.on('connection', (ws) => {
    console.log('¡Cliente conectado!');
    clients.add(ws); // Añadir el nuevo cliente a nuestra lista
    console.log(`Total clientes conectados: ${clients.size}`);

    // 4. Esto se ejecuta CADA VEZ que el servidor recibe un mensaje DE ESE cliente
    ws.on('message', (message) => {

        // Log mejorado para distinguir binario (Buffer) de texto
        let messageType = 'Desconocido';
        if (Buffer.isBuffer(message)) {
            messageType = 'BINARIO (Buffer)';
            console.log(`Mensaje ${messageType} recibido, tamaño: ${message.length} bytes.`);
            // Opcional: Mostrar primeros bytes para inspección
            // console.log(' -> Primeros bytes:', message.slice(0, 8));
        } else {
            // Asumir texto si no es Buffer
            messageType = 'TEXTO';
            console.log(`Mensaje ${messageType} recibido:`, message.toString());
        }

        // 5. ¡La parte clave! Reenviar el mensaje (BINARIO O TEXTO) a TODOS
        //    los OTROS clientes CONECTADOS. Es importante no reenviar al remitente
        //    para evitar ecos infinitos si el cliente no lo maneja.
        clients.forEach((client) => {
            // Revisamos si el cliente al que vamos a enviar...
            //  a) NO es el mismo que envió el mensaje original (ws)
            //  b) Todavía está conectado y listo para recibir (readyState === WebSocket.OPEN)
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                // Reenviar el objeto 'message' original tal cual llegó.
                // La librería 'ws' maneja el envío de Buffers o Strings.
                client.send(message, (err) => {
                    if (err) {
                        console.error(`Error al reenviar mensaje (${messageType}) a un cliente: ${err}`);
                        // Considerar eliminar al cliente si el error persiste o es grave?
                        // clients.delete(client); // Cuidado con modificar el Set mientras se itera
                    } else {
                         // Log opcional de reenvío exitoso
                         // console.log(`Mensaje ${messageType} reenviado a otro cliente.`);
                    }
                });
            }
        });
    });

    // 6. Esto se ejecuta si el cliente se desconecta
    ws.on('close', () => {
        console.log('Cliente desconectado.');
        clients.delete(ws); // Quitar al cliente de nuestra lista
        console.log(`Total clientes conectados: ${clients.size}`);
    });

    // 7. Manejo básico de errores por si algo falla con una conexión específica
    ws.on('error', (error) => {
        console.error('Error en la conexión WebSocket de un cliente:', error);
        // Asegurarse de eliminar al cliente si hay un error irrecuperable
        clients.delete(ws);
        console.log(`Cliente eliminado por error. Total clientes: ${clients.size}`);
    });

    // Podrías enviar un mensaje de bienvenida (como texto) solo a este cliente
    // if (ws.readyState === WebSocket.OPEN) {
    //     ws.send('¡Bienvenido al servidor MIDI!');
    // }
});

// Evento general de error del servidor (menos común)
wss.on('error', (error) => {
    console.error('Error general en el Servidor WebSocket:', error);
});

console.log('El servidor está listo y escuchando.');