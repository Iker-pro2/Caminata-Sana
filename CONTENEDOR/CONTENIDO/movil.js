/**
 * // movil.js 
 */

// 🌐 1. CONFIGURACIÓN Y VARIABLES DE ESTADO
const API_URL_SYNC = `${API_BASE_URL}/actualizar-progreso`;

// Persistencia de pasos en LocalStorage (Evita pérdidas por desconexión)
let pasosReales = parseInt(localStorage.getItem('pasos_pendientes')) || 0;
let ultimaAceleracion = 0;
let ultimoPasoTiempo = 0; 
const sensibilidad = 12; // Ajuste de umbral para detección de impacto
let marcadorUsuario = null;

// Datos de sesión del usuario
const usuarioLocal = JSON.parse(localStorage.getItem('usuarioCaminataSana'));

/**
 * 2. INICIALIZACIÓN DE UI
 */
window.addEventListener('load', () => {
    const display = document.getElementById('contador-pasos');
    if (display) display.innerText = pasosReales;
    
    // Crear indicador de estado visual si no existe
    if(!document.getElementById('status-conexion')){
        const statusDiv = document.createElement('div');
        statusDiv.id = 'status-conexion';
        statusDiv.style.cssText = 'font-size: 12px; text-align: center; margin-top: 10px; color: #666; font-family: sans-serif;';
        statusDiv.innerText = 'Sistema Listo';
        document.body.appendChild(statusDiv);
    }
});

/**
 * 3. GESTIÓN DE MAPA (Leaflet integration)
 */
function actualizarMapaMovil(lat, lng) {
    if (typeof map !== 'undefined' && map !== null) {
        if (!marcadorUsuario) {
            marcadorUsuario = L.marker([lat, lng]).addTo(map)
                .bindPopup("Estás aquí").openPopup();
        } else {
            marcadorUsuario.setLatLng([lat, lng]);
        }
    }
}

/**
 * 4. ACTIVACIÓN DE SENSORES (Iniciado por interacción del usuario)
 */
async function activarSensores() {
    const status = document.getElementById('status-conexion');
    if(status) status.innerText = "Sensores Activos 🏃";

    // Seguimiento GPS continuo
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                window.currentLat = latitude;
                window.currentLng = longitude;
                actualizarMapaMovil(latitude, longitude);
            },
            (err) => console.warn("Error en GPS:", err.message),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }

    // Permisos para Acelerómetro (Requerido en iOS 13+ y navegadores modernos)
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            const permiso = await DeviceMotionEvent.requestPermission();
            if (permiso === 'granted') console.log("Acelerómetro autorizado.");
        } catch (error) {
            console.error("Error en permiso acelerómetro:", error);
        }
    }
}

// Iniciar sensores con el primer click en la pantalla
document.addEventListener('click', () => activarSensores(), { once: true });

/**
 * 5. ALGORITMO DE DETECCIÓN DE PASOS
 */
window.addEventListener('devicemotion', (event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    // Cálculo de la magnitud del vector de aceleración
    const fuerzaTotal = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    const delta = Math.abs(fuerzaTotal - ultimaAceleracion);
    const ahora = Date.now();

    // Filtro de detección: Umbral de fuerza + Diferencia de cambio (delta) + Debounce (350ms)
    if (fuerzaTotal > sensibilidad && delta > 3.5) {
        if (ahora - ultimoPasoTiempo > 350) { 
            pasosReales++;
            ultimoPasoTiempo = ahora;

            const display = document.getElementById('contador-pasos');
            if (display) {
                display.innerText = pasosReales;
                // Efecto visual de rebote
                display.style.transform = "scale(1.1)";
                setTimeout(() => display.style.transform = "scale(1)", 100);
            }

            // Guardado inmediato en móvil para evitar pérdidas de energía/conexión
            localStorage.setItem('pasos_pendientes', pasosReales);
        }
    }
    ultimaAceleracion = fuerzaTotal;
});

/**
 * 6. SINCRONIZACIÓN AUTOMÁTICA (Cada 30 segundos)
 */
setInterval(async () => {
    const status = document.getElementById('status-conexion');
    
    // Solo sincroniza si hay usuario, posición GPS y pasos acumulados
    if (!usuarioLocal?.id || !window.currentLat || pasosReales <= 0) {
        if (pasosReales > 0 && status) status.innerText = "Esperando GPS o Usuario... ⏳";
        return;
    }

    const payload = {
        usuario_id: usuarioLocal.id,
        pasos: pasosReales,
        lat: window.currentLat,
        lng: window.currentLng
    };

    try {
        const res = await fetch(API_URL_SYNC, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true' 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            console.log("✅ Datos sincronizados correctamente.");
            if(status) status.innerText = "Sincronizado ✅";
            
            // Solo reiniciamos el contador local si el servidor confirmó la recepción
            pasosReales = 0; 
            localStorage.removeItem('pasos_pendientes');
            
            const display = document.getElementById('contador-pasos');
            if (display) display.innerText = 0;

            // Actualizar saldo de recompensas si la función existe
            if (typeof cargarSaldoActualizado === 'function') cargarSaldoActualizado();
        } else {
            if(status) status.innerText = "Error en servidor (No sincronizado) ⚠️";
        }
    } catch (err) {
        console.error("📡 Sin conexión detectada. Manteniendo datos en local.");
        if(status) status.innerText = "Modo Offline (Datos Protegidos) 💾";
    }
}, 30000);

/**
 * 7. GESTIÓN DE INSTALACIÓN (PWA)
 */
let promptInstalacion;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptInstalacion = e;
    
    // Muestra el botón de instalación si el elemento existe en el HTML
    const btnInstalar = document.getElementById('btn-instalar');
    if (btnInstalar) {
        btnInstalar.style.display = 'block';
        btnInstalar.onclick = () => {
            promptInstalacion.prompt();
            promptInstalacion.userChoice.then(choice => {
                if (choice.outcome === 'accepted') {
                    btnInstalar.style.display = 'none';
                    promptInstalacion = null;
                }
            });
        };
    }
});

/**
 * 8. DESCARGAR REPORTE DE EMERGENCIA (Backup Local)
 */
function descargarReporte() {
    const pasosActuales = localStorage.getItem('pasos_pendientes') || 0;
    const nombreUser = usuarioLocal ? usuarioLocal.nombre : "Usuario No Identificado";
    
    const texto = `
========================================
   REPORTE DE ACTIVIDAD - CAMINATA SANA
========================================
Fecha: ${new Date().toLocaleString()}
Usuario: ${nombreUser}
ID: ${usuarioLocal?.id || 'N/A'}

RESUMEN:
- Pasos sin sincronizar: ${pasosActuales}
- Latitud actual: ${window.currentLat || 'No disponible'}
- Longitud actual: ${window.currentLng || 'No disponible'}

ESTADO: Estos datos están guardados localmente 
en su navegador. Si el servidor no responde,
puede presentar este archivo como respaldo.
========================================`;
    
    const blob = new Blob([texto], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Pasos_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Limpieza de DOM y memoria
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}