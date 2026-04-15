/* ============================================================================== 
   CAMINATA SANA 
   ============================================================================== */

DROP DATABASE IF EXISTS CaminataSana;
CREATE DATABASE CaminataSana CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE CaminataSana;

-- =====================================================
-- 1. ROLES
-- =====================================================
CREATE TABLE roles (
    rol_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO roles (nombre_rol) VALUES ('Administrador'), ('Usuario');

-- =====================================================
-- 2. USUARIOS
-- =====================================================
CREATE TABLE usuarios (
    usuario_id INT AUTO_INCREMENT PRIMARY KEY,
    rol_id INT NOT NULL DEFAULT 2,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    -- Nuevas columnas agregadas:
    ultima_latitud DECIMAL(10, 8),
    ultima_longitud DECIMAL(11, 8),
    ultima_conexion DATETIME,
    FOREIGN KEY (rol_id) REFERENCES roles(rol_id)
) ENGINE=InnoDB;

-- =====================================================
-- 3. ACTIVIDAD
-- =====================================================
CREATE TABLE pasos_diarios (
    paso_id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fecha DATE NOT NULL,
    cantidad_pasos INT NOT NULL CHECK (cantidad_pasos >= 0),
    UNIQUE KEY uq_usuario_fecha (usuario_id, fecha),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE historial_rutas (
    ruta_id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    latitud DECIMAL(9,6) NOT NULL,
    longitud DECIMAL(9,6) NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- 4. LOCALES (⚡ AQUÍ LA CORRECCIÓN)
-- =====================================================
CREATE TABLE locales_aliados (
    local_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_comercial VARCHAR(150) NOT NULL,
    direccion VARCHAR(250),
    latitud DECIMAL(9,6),
    longitud DECIMAL(9,6),
    categoria VARCHAR(100) DEFAULT 'General', -- 🔥 AGREGADO
    activo BOOLEAN DEFAULT TRUE,
    fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- 5. RECOMPENSAS (🔥 CAMBIO DE NOMBRE)
-- =====================================================
CREATE TABLE recompensas (
    recompensa_id INT AUTO_INCREMENT PRIMARY KEY,
    local_id INT NOT NULL,
    nombre_recompensa VARCHAR(150) NOT NULL, -- 🔥 CAMBIO CLAVE
    descripcion TEXT,
    pasos_necesarios INT NOT NULL CHECK (pasos_necesarios > 0),
    stock_disponible INT NOT NULL DEFAULT 100 CHECK (stock_disponible >= 0),
    activa BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (local_id) REFERENCES locales_aliados(local_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- 6. CANJES
-- =====================================================
CREATE TABLE canjes_historial (
    canje_id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    recompensa_id INT NOT NULL,
    fecha_canje DATETIME DEFAULT CURRENT_TIMESTAMP,
    codigo_canje VARCHAR(50) NOT NULL UNIQUE,
    usado BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id),
    FOREIGN KEY (recompensa_id) REFERENCES recompensas(recompensa_id)
) ENGINE=InnoDB;

-- =====================================================
-- 7. SOLICITUDES (🔥 ENUM EN MINÚSCULAS)
-- =====================================================
CREATE TABLE solicitudes_afiliacion (
    solicitud_id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_negocio VARCHAR(150) NOT NULL,
    categoria ENUM('Cafetería', 'Gimnasio', 'Restaurante', 'Tienda', 'Salud', 'Otro') DEFAULT 'Otro',
    email_contacto VARCHAR(150),
    telefono VARCHAR(20),
    direccion_propuesta TEXT,
    recompensa_ofrecida TEXT NOT NULL,
    pasos_requeridos INT DEFAULT 5000,
    estatus ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente', -- 🔥 CORREGIDO
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- 8. VISTA (ADAPTADA)
-- =====================================================
CREATE VIEW vw_saldo_puntos_usuarios AS
SELECT 
    u.usuario_id,
    u.nombre,
    COALESCE(SUM(p.cantidad_pasos), 0) AS total_pasos_caminados,
    COALESCE((
        SELECT SUM(r.pasos_necesarios) 
        FROM canjes_historial ch 
        JOIN recompensas r ON ch.recompensa_id = r.recompensa_id 
        WHERE ch.usuario_id = u.usuario_id
    ), 0) AS total_pasos_gastados,
    (COALESCE(SUM(p.cantidad_pasos), 0) - 
     COALESCE((
        SELECT SUM(r.pasos_necesarios) 
        FROM canjes_historial ch 
        JOIN recompensas r ON ch.recompensa_id = r.recompensa_id 
        WHERE ch.usuario_id = u.usuario_id
     ), 0)) AS saldo_actual_pasos
FROM usuarios u
LEFT JOIN pasos_diarios p ON u.usuario_id = p.usuario_id
GROUP BY u.usuario_id;

-- =====================================================
-- 9. DATOS INICIALES
-- =====================================================

INSERT INTO usuarios (rol_id, nombre, apellido, correo, contrasena_hash) VALUES
(1, 'Iker', 'Bautista', 'ikerdayan2006@gmail.com', '$2b$10$YSyjn77enMFhwbQVAhle7OOQatLAvHGrI7PY5t2opia6iTbH44mLG');

INSERT INTO locales_aliados (nombre_comercial, direccion, categoria, latitud, longitud) VALUES
('Frutería de León', 'Centro de García', 'Tienda', 25.813000, -100.595000),
('Gimnasio Vital', 'Av. Heberto Castillo', 'Gimnasio', 25.815500, -100.591000),
('Cemal Café', 'Plaza Principal', 'Cafetería', 25.812200, -100.594500);

INSERT INTO recompensas (local_id, nombre_recompensa, descripcion, pasos_necesarios, stock_disponible) VALUES
(1, '1kg de Manzanas', 'Manzanas rojas frescas', 3000, 40),
(2, 'Pase Semanal', 'Acceso total por 7 días', 25000, 10),
(3, 'Café + Galleta', 'Combo energético', 6000, 25);