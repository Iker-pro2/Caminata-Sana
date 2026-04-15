document.addEventListener("DOMContentLoaded", () => {
    /* ================= NAVBAR ================= */
    const navItems = [
        { page: "index.html", icon: "home-outline", label: "Inicio" },
        { page: "recompensas.html", icon: "gift-outline", label: "Premios" },
        { page: "negocios.html", icon: "storefront-outline", label: "Locales" },
        { page: "historial.html", icon: "walk-outline", label: "Historial" },
        { page: "historial_recompensas.html", icon: "trophy-outline", label: "Logros" }
    ];

    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const activeIndex = navItems.findIndex(item => item.page === currentPath);

    if (!document.querySelector(".navbar")) {
        const navbarHTML = `
        <header class="navbar">
            <div class="navbar-container">
                <a href="index.html" class="logo">
                    <img src="../img/logo.png" alt="Logo">
                    <span>Caminata<span style="color:var(--primary-green)">Sana</span></span>
                </a>
                <nav class="navigation">
                    <ul id="nav-list">
                        ${navItems.map((item, index) => `
                            <li class="list ${currentPath === item.page ? 'active' : ''}" style="--i:${index}">
                                <a href="${item.page}">
                                    <span class="icon"><ion-icon name="${item.icon}"></ion-icon></span>
                                    <span class="text">${item.label}</span>
                                </a>
                            </li>
                        `).join('')}
                        <li class="settings-menu">
                            <button id="settings-toggle" class="nav-btn-link">
                                <span class="icon"><ion-icon name="settings-outline"></ion-icon></span>
                                <span class="text">Ajustes</span>
                            </button>
                        </li>
                        <div class="indicator"></div>
                    </ul>
                </nav>
            </div>
        </header>

        <div id="sheet-overlay" class="sheet-overlay"></div>
        <div id="bottom-sheet" class="bottom-sheet">
            <div class="sheet-handle"></div>
            <div class="sheet-content">
                <div class="sheet-item" data-modal="perfil"><ion-icon name="person-outline"></ion-icon><span>Perfil</span></div>
                <div class="sheet-item" data-modal="ayuda"><ion-icon name="help-circle-outline"></ion-icon><span>Ayuda</span></div>
                <div class="sheet-item logout"><ion-icon name="log-out-outline"></ion-icon><span>Cerrar sesión</span></div>
            </div>
        </div>

        <div id="modal-perfil" class="custom-modal-overlay">
            <div class="custom-modal-content">
                <span class="close-modal">&times;</span>
                <h2>Mi Perfil</h2>

                <div class="profile-edit-form">
                    <div class="profile-pic-wrapper">
                        <img src="../img/avatar.png" id="preview-foto" alt="Foto de perfil">
                        <button class="btn-icon-edit" onclick="document.getElementById('input-foto').click()">
                            <ion-icon name="camera-outline"></ion-icon>
                        </button>
                        <input type="file" id="input-foto" accept="image/*" hidden>
                    </div>

                    <div class="input-group-row">
                        <div class="input-field">
                            <label>Nombre</label>
                            <input type="text" id="edit-nombre" placeholder="Tu nombre">
                        </div>
                        <button class="btn-update-field" data-update="nombre">Cambiar</button>
                    </div>

                    <div class="input-group-row">
                        <div class="input-field">
                            <label>Correo Electrónico</label>
                            <input type="email" id="edit-correo" placeholder="tucorreo@ejemplo.com">
                        </div>
                        <button class="btn-update-field" data-update="correo">Cambiar</button>
                    </div>

                    <hr class="separator">

                    <a href="../auth/Contrasena_olvidada.html" class="btn-security-link">
                        <ion-icon name="lock-closed-outline"></ion-icon> Cambiar Contraseña
                    </a>
                </div>
            </div>
        </div>

       <div id="modal-ayuda" class="custom-modal-overlay">
    <div class="custom-modal-content">
        <span class="close-modal">&times;</span>
        <h2>Centro de Ayuda</h2>

        <div class="faq-container">

            <details>
                <summary>¿Cómo registro mis pasos?</summary>
                <p>La aplicación utiliza tu geolocalización de fondo para Caminata Sana.</p>
            </details>

            <details>
                <summary>¿Cómo gano puntos?</summary>
                <p>Caminando y registrando tu actividad en la app. Entre más camines, más puntos acumulas.</p>
            </details>

            <details>
                <summary>¿Cómo canjeo premios?</summary>
                <p>Ve a la sección de "Premios", selecciona uno y confirma el canje con tus puntos.</p>
            </details>

            <details>
                <summary>¿Cómo funcionan los locales?</summary>
                <p>Puedes visitar negocios afiliados y obtener beneficios o descuentos.</p>
            </details>

            <details>
                <summary>¿No puedo iniciar sesión?</summary>
                <p>Verifica tu correo y contraseña. Si el problema continúa, usa la opción de recuperación.</p>
            </details>

            <details>
                <summary>¿Puedo donar mis puntos?</summary>
                <p>Sí, puedes convertir tus puntos en donaciones reales para causas sociales y ambientales en la pestaña de "Impacto".</p>
            </details>

            <details>
                <summary>¿Qué son los retos semanales?</summary>
                <p>Son objetivos específicos (como caminar 50km en una semana) que te otorgan insignias y bonificadores de puntos extra.</p>
            </details>

            <details>
                <summary>¿Cómo subo de nivel?</summary>
                <p>Tu nivel aumenta según tu constancia mensual. A mayor nivel, desbloqueas mejores recompensas en los locales afiliados.</p>
            </details>

            <details>
                <summary>¿Mis datos de ubicación son privados?</summary>
                <p>Solo se usa el GPS para validar pasos. No se comparte la ubicación exacta con terceros.</p>
            </details>

        </div>
    </div>
</div>
        `;


        document.body.insertAdjacentHTML("afterbegin", navbarHTML);
    }

/* ================= LÓGICA DE FUNCIONAMIENTO (ACTUALIZADA) ================= */
    const indicator = document.querySelector(".indicator");
    if (indicator && activeIndex !== -1) {
        indicator.style.setProperty("--x", activeIndex);
    }

    const sheet = document.getElementById("bottom-sheet");
    const overlay = document.getElementById("sheet-overlay");

    document.getElementById("settings-toggle")?.addEventListener("click", () => {
        sheet?.classList.add("active");
        overlay?.classList.add("active");
    });

    overlay?.addEventListener("click", () => {
        sheet?.classList.remove("active");
        overlay?.classList.remove("active");
    });

    /* ================= EVENTOS DELEGADOS ================= */
    document.addEventListener("click", async (e) => {
        
        // 1. ABRIR MODALES
        const modalTrigger = e.target.closest("[data-modal]");
        if (modalTrigger) {
            const modalId = modalTrigger.dataset.modal;
            const targetModal = document.getElementById(`modal-${modalId}`);
            if (targetModal) {
                targetModal.classList.add("active");
                sheet?.classList.remove("active");
                overlay?.classList.remove("active");
            }
        }

        // 2. CERRAR MODALES
        if (e.target.closest(".close-modal") || e.target.classList.contains("custom-modal-overlay")) {
            document.querySelectorAll(".custom-modal-overlay").forEach(m => m.classList.remove("active"));
        }

/* ================= ACTUALIZACIÓN DINÁMICA DE PERFIL (CORREGIDO) ================= */
const updateBtn = e.target.closest(".btn-update-field");

if (updateBtn) {
    const tipo = updateBtn.dataset.update;

    // 1. Obtener la sesión y el token del localStorage
    const sesion = localStorage.getItem("usuarioCaminataSana");
    const token = localStorage.getItem("token");

    // 2. Verificar que exista una sesión activa
    if (!sesion || !token) {
        alert("No se detectó una sesión activa. Por favor, inicia sesión.");
        window.location.href = "/auth/index.html";
        return;
    }

    // 3. Parsear datos y extraer el ID (coincidiendo con tu res.json del server)
    const datosUsuario = JSON.parse(sesion);
    const usuarioId = datosUsuario.id; 

    let valor = "";
    // IMPORTANTE: Cambia esta URL por la de tu ngrok para que conecte con el servidor (puerto 3000)
    const API_URL = "https://mercilessly-micellar-annika.ngrok-free.dev";
    let endpoint = `${API_URL}/api/usuarios/update-${tipo}`;
    
    let payload = { usuarioId: usuarioId };

    // 4. Definir qué estamos editando
    if (tipo === "nombre") {
        valor = document.getElementById("edit-nombre").value;
        payload.nuevoNombre = valor;
    } else if (tipo === "correo") {
        valor = document.getElementById("edit-correo").value;
        payload.nuevoCorreo = valor;
    }

    // Validación de campo vacío
    if (!valor?.trim()) {
        return alert(`Por favor, ingresa un ${tipo} válido.`);
    }

    try {
        // 5. Petición al servidor con TOKEN DE AUTORIZACIÓN
        const res = await fetch(endpoint, {
            method: "PATCH",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`, // Necesario para tu middleware verificarToken
                "ngrok-skip-browser-warning": "true" 
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
            alert("✅ " + (data.message || "Actualizado con éxito"));
            
            // Actualizar el objeto en localStorage para que los cambios persistan al recargar
            if (tipo === "nombre") {
                datosUsuario.nombre = valor;
                const nombrePantalla = document.querySelector(".user-name-display");
                if (nombrePantalla) nombrePantalla.innerText = valor;
            } else if (tipo === "correo") {
                datosUsuario.correo = valor;
            }
            localStorage.setItem("usuarioCaminataSana", JSON.stringify(datosUsuario));

        } else {
            alert("❌ Error: " + (data.error || data.message || "No se pudo actualizar"));
        }

    } catch (err) {
        console.error("Error de conexión:", err);
        alert("No se pudo conectar con el servidor. Verifica tu conexión a internet o el estado de ngrok.");
    }
}
        // 4. CERRAR SESIÓN
        if (e.target.closest(".logout")) {
            if (confirm("¿Seguro que deseas cerrar sesión?")) {
                localStorage.clear(); // Limpia el ID para que nadie más lo use
                location.href = "/auth/index.html";
            }
        }
    });

    /* ================= FOTO PERFIL (SIN REFERENCE ERROR) ================= */
    document.addEventListener("change", (ev) => {
        if (ev.target.id === "input-foto") {
            const file = ev.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            // Usamos 'event' interno para la carga del archivo
            reader.onload = (fileLoadEvent) => {
                const preview = document.getElementById("preview-foto");
                if (preview) preview.src = fileLoadEvent.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

});