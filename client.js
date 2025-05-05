// client.js (Versión MIDI + WebSocket)

// --- Elementos del HTML ---
const midiInSelect = document.getElementById('midiInSelect');
const midiOutSelect = document.getElementById('midiOutSelect');
const statusDiv = document.getElementById('status');

// --- Variables Globales ---
let webSocket = null;       // Para la conexión WebSocket
let midiAccess = null;      // Para el objeto de acceso MIDI
let selectedMidiInput = null; // Para el dispositivo de ENTRADA MIDI seleccionado
let selectedMidiOutput = null;// Para el dispositivo de SALIDA MIDI seleccionado

// URL del servidor WebSocket en Glitch (¡Asegúrate que sea la tuya!)
const serverUrl = 'wss://free-rich-argon.glitch.me';

// --- Funciones de Utilidad ---

// Actualiza el mensaje de estado en la página
function updateStatus(message) {
    console.log("Status:", message); // También en consola para debug
    statusDiv.textContent = message;
}

// --- Lógica WebSocket ---

function connectWebSocket() {
    updateStatus(`Conectando al servidor WebSocket en ${serverUrl}...`);

    try {
        webSocket = new WebSocket(serverUrl);

        webSocket.onopen = (event) => {
            updateStatus('¡Conectado al servidor WebSocket! Esperando acceso MIDI...');
            // Ahora que estamos conectados, pedimos acceso MIDI
            requestMidi();
        };

        webSocket.onmessage = (event) => {
            // Mensaje recibido del servidor (se asume que es MIDI)
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'midi' && message.payload) {
                    const midiData = new Uint8Array(message.payload);
                    console.log('MIDI Recibido vía WebSocket:', midiData);
                    playRemoteMidi(midiData); // Intentar reproducir localmente
                } else {
                    console.warn("Mensaje WebSocket recibido, pero no es del tipo MIDI esperado:", message);
                }
            } catch (e) {
                console.error("Error al procesar mensaje WebSocket (¿no era JSON?):", event.data, e);
                // Podríamos intentar manejarlo como binario si enviáramos binario
                // if (event.data instanceof Blob || event.data instanceof ArrayBuffer) { ... }
            }
        };

        webSocket.onclose = (event) => {
            updateStatus('Desconectado del servidor WebSocket. Intenta recargar la página.');
            webSocket = null;
            // Podríamos deshabilitar selects o intentar reconectar aquí
        };

        webSocket.onerror = (error) => {
            console.error('Error en WebSocket:', error);
            updateStatus('Error en la conexión WebSocket. Revisa la consola (F12).');
            webSocket = null;
        };

    } catch (error) {
        console.error("No se pudo crear la conexión WebSocket:", error);
        updateStatus(`ERROR al intentar conectar a ${serverUrl}. Revisa la URL y si el servidor está corriendo.`);
    }
}

// --- Lógica Web MIDI ---

function requestMidi() {
    updateStatus('Solicitando acceso a dispositivos MIDI...');
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: false }) // sysex: false es más seguro si no lo necesitas
            .then(onMIDISuccess, onMIDIFailure);
    } else {
        updateStatus('Web MIDI API no es compatible en este navegador.');
        console.warn('Web MIDI API no es compatible en este navegador.');
    }
}

function onMIDISuccess(access) {
    midiAccess = access; // Guardar el objeto de acceso globalmente
    updateStatus('Acceso MIDI concedido. Selecciona tus dispositivos.');
    console.log('Acceso MIDI concedido:', midiAccess);

    // Limpiar selects (excepto la opción por defecto)
    midiInSelect.options.length = 1;
    midiOutSelect.options.length = 1;
    midiInSelect.options[0].textContent = '-- Selecciona tu Entrada MIDI --';
    midiOutSelect.options[0].textContent = '-- Selecciona tu Salida MIDI --';


    // Poblar selector de ENTRADAS
    if (midiAccess.inputs.size > 0) {
        midiAccess.inputs.forEach(input => {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = input.name;
            midiInSelect.appendChild(option);
        });
    } else {
         midiInSelect.options[0].textContent = '-- No hay Entradas MIDI --';
         midiInSelect.disabled = true;
    }


    // Poblar selector de SALIDAS
     if (midiAccess.outputs.size > 0) {
        midiAccess.outputs.forEach(output => {
            const option = document.createElement('option');
            option.value = output.id;
            option.textContent = output.name;
            midiOutSelect.appendChild(option);
        });
    } else {
         midiOutSelect.options[0].textContent = '-- No hay Salidas MIDI --';
         midiOutSelect.disabled = true;
    }


    // Añadir listeners para cuando el usuario seleccione un dispositivo
    midiInSelect.addEventListener('change', handleInputSelection);
    midiOutSelect.addEventListener('change', handleOutputSelection);

    // Habilitar selects si hay opciones
    midiInSelect.disabled = midiAccess.inputs.size === 0;
    midiOutSelect.disabled = midiAccess.outputs.size === 0;

}

function onMIDIFailure(msg) {
    updateStatus(`Fallo al obtener acceso MIDI: ${msg}`);
    console.error(`Fallo al obtener acceso MIDI: ${msg}`);
     midiInSelect.disabled = true;
     midiOutSelect.disabled = true;
}

// --- Manejadores de Selección y MIDI ---

function handleInputSelection(event) {
    const selectedId = event.target.value;

    // Desvincular listener del input anterior si existía
    if (selectedMidiInput) {
        selectedMidiInput.onmidimessage = null;
        console.log(`Listener desvinculado de: ${selectedMidiInput.name}`);
    }

    if (selectedId && midiAccess) {
        selectedMidiInput = midiAccess.inputs.get(selectedId);
        if (selectedMidiInput) {
            // ¡Vincular el listener de mensajes MIDI a ESTE dispositivo!
            selectedMidiInput.onmidimessage = handleLocalMidiMessage;
            updateStatus(`Entrada seleccionada: ${selectedMidiInput.name}. ¡Listo para tocar!`);
            console.log(`Escuchando MIDI en: ${selectedMidiInput.name} (ID: ${selectedMidiInput.id})`);
        } else {
             updateStatus('Error al obtener el dispositivo de entrada seleccionado.');
             selectedMidiInput = null;
        }
    } else {
        selectedMidiInput = null; // Ninguno seleccionado
        updateStatus('Ninguna entrada MIDI seleccionada.');
    }
}

function handleOutputSelection(event) {
    const selectedId = event.target.value;
    if (selectedId && midiAccess) {
         selectedMidiOutput = midiAccess.outputs.get(selectedId);
         if(selectedMidiOutput) {
            updateStatus(`Salida seleccionada: ${selectedMidiOutput.name}. Aquí sonará el otro usuario.`);
            console.log(`Salida seleccionada: ${selectedMidiOutput.name} (ID: ${selectedMidiOutput.id})`);
         } else {
             updateStatus('Error al obtener el dispositivo de salida seleccionado.');
             selectedMidiOutput = null;
         }
    } else {
        selectedMidiOutput = null; // Ninguno seleccionado
        updateStatus('Ninguna salida MIDI seleccionada.');
    }
}

// Se llama cuando se recibe un mensaje MIDI del dispositivo de ENTRADA LOCAL seleccionado
function handleLocalMidiMessage(event) {
    const midiData = event.data; // Uint8Array [comando, nota, velocidad]
    console.log('MIDI Local Detectado:', midiData);

    // Enviar los datos MIDI al servidor vía WebSocket
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        // Convertir a Array dentro de un JSON para envío más robusto entre navegadores/servidor
        const messageToSend = JSON.stringify({
            type: 'midi',
            payload: Array.from(midiData) // Convertir Uint8Array a Array estándar
        });
        webSocket.send(messageToSend);
        console.log('MIDI enviado vía WebSocket:', messageToSend);
    } else {
        console.warn('No se pudo enviar MIDI: WebSocket no conectado.');
        updateStatus('Error: WebSocket desconectado. No se pudo enviar MIDI.');
    }
    // ¡IMPORTANTE! No reproducimos este MIDI localmente aquí para evitar eco.
}

// Se llama cuando se recibe un mensaje MIDI desde el WebSocket (originado por el otro usuario)
function playRemoteMidi(midiDataArray) {
    // Enviar el mensaje MIDI al dispositivo de SALIDA LOCAL seleccionado
    if (selectedMidiOutput) {
        selectedMidiOutput.send(midiDataArray);
        console.log('MIDI Remoto enviado a Salida Local:', midiDataArray);
    } else {
        // Si no hay salida seleccionada, podríamos dar un aviso visual o sonoro fallback?
        console.warn('Se recibió MIDI remoto, pero no hay salida seleccionada.');
        // updateStatus('MIDI recibido, pero no hay salida seleccionada para reproducirlo.'); // Podría ser molesto
    }
}


// --- Inicialización ---
// Deshabilitar selects inicialmente hasta que MIDI esté listo
midiInSelect.disabled = true;
midiOutSelect.disabled = true;

// Iniciar la conexión WebSocket al cargar la página
connectWebSocket();

// El acceso MIDI se solicitará desde webSocket.onopen para asegurar que el servidor está conectado primero
// o podemos llamarlo directamente si preferimos pedir MIDI incluso antes de conectar:
// requestMidi(); // Descomentar si prefieres pedir MIDI de inmediato