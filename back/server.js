// ==============================
// CONFIGURACIÓN INICIAL
// ==============================
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const path = require('path');
dotenv.config();

const app = express();


// ==============================
// MIDDLEWARES Y RUTAS ESTÁTICAS
// ==============================

// 1. Habilitar CORS (Configuración corregida para Render)
app.use(cors({
    origin: 'https://caminata-sana-1.onrender.com', // Sin la barra "/" al final
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Lectura de JSON
app.use(express.json());
// 3. Servir archivos estáticos (Imágenes, CSS, JS) desde CONTENEDOR
// Eliminamos el '../' porque la carpeta está en la misma raíz que server.js
app.use(express.static(path.join(__dirname, 'CONTENEDOR')));

// 4. Ruta raíz para cargar tu aplicación
app.get('/', (req, res) => {
    // Ajustamos la ruta para que coincida exactamente con tu carpeta 'pagina web'
    res.sendFile(path.join(__dirname, 'CONTENEDOR', 'pagina web', 'INDEX.HTML'));
});

// ==============================
// TOKENS DE RECUPERACIÓN
// ==============================
const tokensRecuperacion = {};

// ==============================
// CONEXIÓN A BASE DE DATOS
// ==============================
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ==============================
// TEST DE CONEXIÓN
// ==============================
pool.getConnection()
    .then(conn => {
        console.log('✅ Conexión a MySQL exitosa');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Error conectando a MySQL:', err.message);
    });

/* ==============================================================================
🔐 MIDDLEWARE JWT
============================================================================== */
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Token requerido" });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.id || !decoded.rol) {
            return res.status(403).json({ error: "Token inválido" });
        }
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: "Token inválido o expirado" });
    }
}

/* ==============================================================================
📝 REGISTRO
============================================================================== */
app.post('/api/registrar', async (req, res) => {
    let { nombre, apellido, correo, contrasena } = req.body;
    if (!nombre || !correo || !contrasena) {
        return res.status(400).json({ error: "Datos incompletos" });
    }
    correo = correo.trim().toLowerCase();
    if (contrasena.length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    try {
        const hash = await bcrypt.hash(contrasena, 10);
        const [result] = await pool.execute(
            `INSERT INTO usuarios (rol_id, nombre, apellido, correo, contrasena_hash, activo) 
             VALUES (2, ?, ?, ?, ?, TRUE)`,
            [nombre.trim(), (apellido || '').trim(), correo, hash]
        );
        res.json({ mensaje: "Usuario registrado", id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Correo ya registrado" });
        }
        res.status(500).json({ error: "Error en registro" });
    }
});

/* ==============================================================================
🔑 LOGIN
============================================================================== */
app.post('/api/login', async (req, res) => {
    let { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.status(400).json({ error: "Faltan datos" });
    }
    correo = correo.trim().toLowerCase();
    try {
        const [rows] = await pool.execute(
            `SELECT usuario_id, nombre, apellido, rol_id, contrasena_hash 
             FROM usuarios WHERE correo=? AND activo=1`,
            [correo]
        );
        if (rows.length === 0) {
            await bcrypt.compare(contrasena, '$2a$10$invalidhashforsecurity'); 
            return res.status(401).json({ error: "Credenciales inválidas" });
        }
        const usuario = rows[0];
        const valido = await bcrypt.compare(contrasena, usuario.contrasena_hash.toString());
        if (!valido) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }
        const token = jwt.sign(
            { id: usuario.usuario_id, rol: usuario.rol_id },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );
        res.json({
            token,
            usuario: {
                id: usuario.usuario_id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                rol_id: usuario.rol_id
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Error en login" });
    }
});

/* ==============================================================================
📧 OLVIDÉ PASSWORD
============================================================================== */
app.post('/api/olvide-password', async (req, res) => {
    let { correo } = req.body;
    if (!correo) return res.status(400).json({ error: "Correo requerido" });
    correo = correo.trim().toLowerCase();
    try {
        const [users] = await pool.execute('SELECT nombre FROM usuarios WHERE correo = ?', [correo]);
        if (users.length === 0) return res.json({ ok: true });

        const token = crypto.randomBytes(3).toString('hex').toUpperCase();
        tokensRecuperacion[correo] = { token, expira: Date.now() + 600000 };

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        await transporter.sendMail({
            from: `"Caminata Sana" <${process.env.EMAIL_USER}>`, // CORRECCIÓN: Comillas en el From
            to: correo,
            subject: 'Código de Recuperación',
            html: `<div style="font-family:sans-serif"><h2>Código: ${token}</h2><p>Expira en 10 minutos</p></div>`
        });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: "Error al enviar correo" });
    }
});

/* ==============================================================================
🔄 ACTUALIZAR PASSWORD
============================================================================== */
app.post('/api/actualizar-password', async (req, res) => {
    let { correo, token, nuevaContrasena } = req.body;
    if (!correo || !token || !nuevaContrasena) return res.status(400).json({ error: "Datos incompletos" });
    if (nuevaContrasena.length < 6) return res.status(400).json({ error: "Contraseña muy corta" });

    correo = correo.trim().toLowerCase();
    const data = tokensRecuperacion[correo];
    if (!data || data.token !== token || Date.now() > data.expira) {
        return res.status(400).json({ error: "Código inválido o expirado" });
    }

    try {
        const hash = await bcrypt.hash(nuevaContrasena, 10);
        await pool.execute('UPDATE usuarios SET contrasena_hash = ? WHERE correo = ?', [hash, correo]);
        delete tokensRecuperacion[correo];
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar contraseña" });
    }
});

/* ============================================================================== 
    4. GESTIÓN DE PASOS Y GPS
============================================================================== */
app.post('/api/actualizar-progreso', async (req, res) => {
    const { usuario_id, pasos, lat, lng } = req.body;
    const fecha = new Date().toLocaleDateString('sv-SE'); 
    if (!usuario_id) return res.status(400).json({ error: "ID de usuario requerido" });
    const pasosAInsertar = parseInt(pasos) || 0;

    try {
        await pool.execute(
            `INSERT INTO pasos_diarios (usuario_id, fecha, cantidad_pasos)
             VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cantidad_pasos = cantidad_pasos + VALUES(cantidad_pasos)`,
            [usuario_id, fecha, pasosAInsertar]
        );
        await pool.execute(
            `UPDATE usuarios SET ultima_latitud = ?, ultima_longitud = ?, ultima_conexion = NOW() WHERE usuario_id = ?`,
            [lat || null, lng || null, usuario_id]
        );
        res.json({ ok: true, mensaje: "Sincronización exitosa", fecha_registrada: fecha });
    } catch (error) {
        res.status(500).json({ error: "Error al sincronizar datos móviles" });
    }
});

// ... (Las rutas de /api/pasos, saldo e historial se mantienen igual por ser correctas)
app.post('/api/pasos', async (req, res) => {
    const { usuario_id, cantidad_pasos } = req.body;
    const fecha = new Date().toLocaleDateString('sv-SE');
    try {
        await pool.execute(
            `INSERT INTO pasos_diarios (usuario_id, fecha, cantidad_pasos)
             VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cantidad_pasos = cantidad_pasos + VALUES(cantidad_pasos)`,
            [usuario_id, fecha, cantidad_pasos || 0]
        );
        res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: "Error al guardar pasos" }); }
});

app.get('/api/usuario/saldo/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT IFNULL(saldo_actual_pasos, 0) as saldo_actual_pasos, IFNULL(total_pasos_caminados, 0) as total_pasos_caminados 
             FROM vw_saldo_puntos_usuarios WHERE usuario_id = ?`, [req.params.id]
        );
        res.json(rows[0] || { saldo_actual_pasos: 0, total_pasos_caminados: 0 });
    } catch (error) { res.status(500).json({ error: "Error al obtener saldo" }); }
});

app.get('/api/usuario/historial-detallado/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, cantidad_pasos 
             FROM pasos_diarios WHERE usuario_id = ? ORDER BY fecha DESC LIMIT 30`, [req.params.id]
        );
        res.json(rows);
    } catch (error) { res.status(500).json({ error: "Error en historial" }); }
});

app.get('/api/usuario/historial-resumen/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT IFNULL(SUM(cantidad_pasos), 0) as total_pasos, COUNT(DISTINCT fecha) as total_dias 
             FROM pasos_diarios WHERE usuario_id = ?`, [req.params.id]
        );
        res.json(rows[0]);
    } catch (error) { res.status(500).json({ error: "Error en resumen" }); }
});

/* ============================================================================== 
    5. RECOMPENSAS Y CANJES
============================================================================== */
app.get('/api/recompensas-disponibles', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT r.*, l.nombre_comercial AS nombre_local
            FROM recompensas r JOIN locales_aliados l ON r.local_id = l.local_id
            WHERE r.activa = 1 AND r.stock_disponible > 0`);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: "Error en catálogo" }); }
});

app.get('/api/locales-con-ofertas', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT l.*, COUNT(r.recompensa_id) as total_recompensas, 
            IFNULL(MIN(r.pasos_necesarios), 0) as pasos_minimos
            FROM locales_aliados l
            LEFT JOIN recompensas r ON l.local_id = r.local_id AND r.activa = 1
            GROUP BY l.local_id`);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: "Error locales" }); }
});

app.post('/api/canjear', async (req, res) => {
    const { usuario_id, recompensa_id } = req.body;
    const conn = await pool.getConnection();
    const codigo = crypto.randomUUID().substring(0, 8).toUpperCase();
    try {
        await conn.beginTransaction();
        const [val] = await conn.execute(
            `SELECT v.saldo_actual_pasos, r.pasos_necesarios, r.stock_disponible 
             FROM vw_saldo_puntos_usuarios v, recompensas r
             WHERE v.usuario_id=? AND r.recompensa_id=?`, [usuario_id, recompensa_id]
        );
        if (!val.length || val[0].saldo_actual_pasos < val[0].pasos_necesarios || val[0].stock_disponible <= 0) {
            throw new Error("Saldo insuficiente o sin stock");
        }
        // CORRECCIÓN: Faltaban comillas en el string SQL
        await conn.execute("INSERT INTO canjes_historial (usuario_id, recompensa_id, codigo_canje) VALUES (?,?,?)", [usuario_id, recompensa_id, codigo]);
        await conn.execute("UPDATE recompensas SET stock_disponible = stock_disponible - 1 WHERE recompensa_id=?", [recompensa_id]);
        await conn.commit();
        res.json({ success: true, codigo });
    } catch (err) { await conn.rollback(); res.status(400).json({ error: err.message }); }
    finally { conn.release(); }
});

app.get('/api/usuario/historial-recompensas/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT ch.canje_id, ch.codigo_canje, ch.fecha_canje, ch.usado, r.nombre_recompensa, l.nombre_comercial 
             FROM canjes_historial ch
             JOIN recompensas r ON ch.recompensa_id = r.recompensa_id
             JOIN locales_aliados l ON r.local_id = l.local_id
             WHERE ch.usuario_id = ? ORDER BY ch.fecha_canje DESC`, [req.params.id]
        );
        res.json(rows);
    } catch (error) { res.status(500).json({ error: "Error en canjes" }); }
});

/* ==============================================================================
    6. PANEL ADMINISTRATIVO (MEJORADO)
============================================================================== */

// 🔐 Middleware extra para ADMIN
function verificarAdmin(req, res, next) {
    if (!req.usuario || req.usuario.rol !== 1) {
        return res.status(403).json({ error: "Acceso solo para administradores" });
    }
    next();
}

/* ============================
📊 STATS
============================ */
app.get('/api/admin/stats', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [[u]] = await pool.execute('SELECT COUNT(*) as total FROM usuarios WHERE rol_id = 2');
        const [[p]] = await pool.execute('SELECT IFNULL(SUM(cantidad_pasos),0) as total FROM pasos_diarios');
        const [[l]] = await pool.execute('SELECT COUNT(*) as total FROM locales_aliados');
        const [[s]] = await pool.execute('SELECT COUNT(*) as total FROM solicitudes_afiliacion WHERE estatus = "pendiente"');

        res.json({
            usuariosTotales: u.total,
            pasosGlobales: p.total,
            localesAliados: l.total,
            pendientes: s.total
        });

    } catch (error) {
        console.error("Error stats:", error);
        res.status(500).json({ error: "Error en estadísticas" });
    }
});

/* ============================
🏪 LISTAR LOCALES
============================ */
app.get('/api/admin/locales', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM locales_aliados ORDER BY fecha_alta DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error("Error locales:", error);
        res.status(500).json({ error: "Error al obtener locales" });
    }
});

/* ============================
🗑 ELIMINAR LOCAL
============================ */
app.delete('/api/admin/eliminar-local/:id', verificarToken, verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [existe] = await conn.execute(
            'SELECT local_id FROM locales_aliados WHERE local_id = ?',
            [id]
        );

        if (!existe.length) {
            throw new Error("Local no encontrado");
        }

        await conn.execute('DELETE FROM recompensas WHERE local_id = ?', [id]);
        await conn.execute('DELETE FROM locales_aliados WHERE local_id = ?', [id]);

        await conn.commit();

        res.json({ ok: true, mensaje: "Local eliminado correctamente" });

    } catch (error) {
        await conn.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        conn.release();
    }
});

/* ============================
📋 SOLICITUDES PENDIENTES
============================ */
app.get('/api/admin/solicitudes', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM solicitudes_afiliacion WHERE estatus = "pendiente"'
        );
        res.json(rows);
    } catch (error) {
        console.error("Error solicitudes:", error);
        res.status(500).json({ error: "Error al obtener solicitudes" });
    }
});

/* ============================
✅ APROBAR NEGOCIO
============================ */
app.post('/api/admin/aprobar-negocio', verificarToken, verificarAdmin, async (req, res) => {
    const { solicitud_id } = req.body;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [sol] = await conn.execute(
            'SELECT * FROM solicitudes_afiliacion WHERE solicitud_id = ?',
            [solicitud_id]
        );

        if (!sol.length) {
            throw new Error("Solicitud no encontrada");
        }

        const s = sol[0];

        const [local] = await conn.execute(
            `INSERT INTO locales_aliados (nombre_comercial, direccion, categoria)
             VALUES (?, ?, ?)`,
            [
                s.nombre_negocio,
                s.direccion_propuesta || 'García, NL',
                s.categoria || 'General'
            ]
        );

        await conn.execute(
            `INSERT INTO recompensas 
             (local_id, nombre_recompensa, pasos_necesarios, stock_disponible, activa)
             VALUES (?, ?, ?, 50, 1)`,
            [
                local.insertId,
                s.recompensa_ofrecida,
                parseInt(s.pasos_requeridos) || 100
            ]
        );

        await conn.execute(
            'UPDATE solicitudes_afiliacion SET estatus = "aprobado" WHERE solicitud_id = ?',
            [solicitud_id]
        );

        await conn.commit();

        res.json({ ok: true, mensaje: "Negocio aprobado correctamente" });

    } catch (error) {
        await conn.rollback();
        console.error("Error aprobar:", error);
        res.status(400).json({ error: error.message });
    } finally {
        conn.release();
    }
});

/* ============================
❌ RECHAZAR NEGOCIO
============================ */
app.post('/api/admin/rechazar-negocio', verificarToken, verificarAdmin, async (req, res) => {
    const { solicitud_id } = req.body;

    try {
        const [result] = await pool.execute(
            'UPDATE solicitudes_afiliacion SET estatus = "rechazado" WHERE solicitud_id = ?',
            [solicitud_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Solicitud no encontrada" });
        }

        res.json({ ok: true, mensaje: "Solicitud rechazada" });

    } catch (error) {
        console.error("Error rechazar:", error);
        res.status(500).json({ error: "Error al rechazar solicitud" });
    }
});

/* ============================
📊 REPORTE USUARIOS
============================ */
app.get('/api/admin/usuarios-reporte', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                u.usuario_id,
                CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo,
                u.activo,
                IFNULL(SUM(p.cantidad_pasos), 0) AS pasos_totales,
                IFNULL((
                    SELECT SUM(rec.pasos_necesarios)
                    FROM canjes_historial ch
                    JOIN recompensas rec ON ch.recompensa_id = rec.recompensa_id
                    WHERE ch.usuario_id = u.usuario_id
                ), 0) AS pasos_gastados
            FROM usuarios u
            LEFT JOIN pasos_diarios p ON u.usuario_id = p.usuario_id
            WHERE u.rol_id = 2
            GROUP BY u.usuario_id
        `);

        res.json(rows);

    } catch (error) {
        console.error("Error reporte:", error);
        res.status(500).json({ error: "Error en reporte" });
    }
});
/* ============================================================================== 
    7. AFILIACIÓN DE LOCALES
============================================================================== */
app.post('/api/solicitar-afiliacion', async (req, res) => {
    const { nombre_negocio, categoria, recompensa_ofrecida, email_contacto, telefono, direccion_propuesta, pasos_requeridos, latitud, longitud } = req.body;
    if (!nombre_negocio || !email_contacto || !recompensa_ofrecida || !pasos_requeridos) {
        return res.status(400).json({ error: "Faltan campos obligatorios." });
    }
    try {
        const query = `INSERT INTO solicitudes_afiliacion (nombre_negocio, categoria, recompensa_ofrecida, correo_contacto, telefono_contacto, direccion_propuesta, pasos_requeridos, latitud, longitud, estatus, fecha_solicitud) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', NOW())`;
        await pool.execute(query, [nombre_negocio, categoria, recompensa_ofrecida, email_contacto.trim().toLowerCase(), telefono || null, direccion_propuesta || null, parseInt(pasos_requeridos), latitud || null, longitud || null]);
        res.json({ ok: true, mensaje: "Solicitud enviada con éxito." });
    } catch (error) { res.status(500).json({ error: "Error al procesar solicitud." }); }
});

/* ============================================================================== 
    3. RUTAS DE USUARIO (PERFIL)
============================================================================== */
app.patch('/api/usuarios/update-nombre', async (req, res) => {
    const { nuevoNombre, usuarioId } = req.body;
    if (!nuevoNombre || nuevoNombre.trim().length < 2) return res.status(400).json({ success: false, message: "Nombre demasiado corto." });
    try {
        const [result] = await pool.query("UPDATE usuarios SET nombre = ? WHERE usuario_id = ?", [nuevoNombre.trim(), usuarioId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado." });
        res.json({ success: true, message: "¡Nombre actualizado con éxito!" });
    } catch (err) { res.status(500).json({ success: false, message: "Error interno" }); }
});

app.patch('/api/usuarios/update-correo', async (req, res) => {
    const { nuevoCorreo, usuarioId } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!nuevoCorreo || !emailRegex.test(nuevoCorreo)) return res.status(400).json({ success: false, message: "Correo inválido." });
    try {
        const [result] = await pool.query("UPDATE usuarios SET correo = ? WHERE usuario_id = ?", [nuevoCorreo.trim(), usuarioId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado." });
        res.json({ success: true, message: "¡Correo actualizado con éxito!" });
    } catch (err) { res.status(500).json({ success: false, message: "Error interno" }); }
});

/* ============================================================================== 
INICIO DEL SERVIDOR
============================================================================== */
// SOLUCIÓN: Definir la variable usando la que te da Render o 10000 por defecto
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});