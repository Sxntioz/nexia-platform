# 🌐 Guía Oficial: Cómo Subir NEXIA a Internet 100% Gratis (24/7)

Esta guía explica las **dos mejores formas** de tener NEXIA disponible en Internet sin pagar nada:
1. **Opción A (Recomendada para la Hackathon): Nube 24/7 (Vercel + Render)** — Funciona todo el tiempo, sin tener tu computador encendido.
2. **Opción B (Acceso Inmediato en 2 minutos): Túnel Público (Cloudflare Tunnel o Ngrok)** — Transforma tus servidores locales en una URL pública mundial con un solo comando.

---

## 🚀 Opción A: Despliegue en la Nube 24/7 (Vercel + Render)

El Frontend y el Backend se despliegan en las plataformas gratuitas líderes de la industria:
- **Frontend:** Vercel (Gratis de por vida, CDN ultrarrápido mundial, HTTPS automático).
- **Backend:** Render (Gratis de por vida, soporta FastAPI y Python 3.12).

### Paso 1: Subir tu proyecto a GitHub
1. Si aún no tienes Git instalado o tu código en GitHub, crea una cuenta gratuita en [github.com](https://github.com).
2. Crea un nuevo repositorio (puede ser público o privado), por ejemplo: `nexia-platform`.
3. Sube la carpeta del proyecto a ese repositorio:
   ```bash
   git init
   git add .
   git commit -m "NEXIA Platform v1.0"
   git remote add origin https://github.com/TU_USUARIO/nexia-platform.git
   git push -u origin main
   ```

### Paso 2: Desplegar el Backend en Render (Gratis)
1. Entra a [render.com](https://render.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **"New +"** > **"Web Service"**.
3. Selecciona tu repositorio de GitHub `nexia-platform`.
4. Configura estos campos:
   - **Name:** `nexia-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`
5. En la sección **"Environment Variables"**, agrega:
   - `GEMINI_API_KEY` = tu clave de Google Gemini.
   - `ENVIRONMENT` = `production`
   - `CORS_ORIGINS` = `*`
6. Haz clic en **"Create Web Service"**.
7. En unos 2 minutos, Render te dará tu URL pública, por ejemplo:
   `https://nexia-backend-xxxx.onrender.com`
   *(Verifica abriendo `https://nexia-backend-xxxx.onrender.com/api/health` y verás `{"status":"ok"}`)*.

### Paso 3: Desplegar el Frontend en Vercel (Gratis)
1. Entra a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. Haz clic en **"Add New..."** > **"Project"**.
3. Importa tu repositorio `nexia-platform`.
4. Configura:
   - **Root Directory:** Haz clic en *Edit* y selecciona `frontend`.
   - **Framework Preset:** `Vite` (lo detectará automáticamente).
5. En **"Environment Variables"**, añade:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://nexia-backend-xxxx.onrender.com/api` *(la URL de Render del Paso 2 con `/api` al final)*.
6. Haz clic en **"Deploy"**.
7. ¡Listo! En 45 segundos Vercel te entregará tu dominio oficial mundial:
   `https://nexia-tuproyecto.vercel.app`

---

## ⚡ Opción B: Compartir Inmediatamente por Internet desde tu PC (Cloudflare Tunnel)

Si necesitas mostrarle la página a profesores, jurados o compañeros **HOY MISMO** sin configurar cuentas en la nube:

### Con Cloudflare Tunnel (100% Gratis, Sin registro obligatorio):
1. Descarga el archivo ejecutable de Cloudflare:
   - Ve a: [https://github.com/cloudflare/cloudflared/releases/latest](https://github.com/cloudflare/cloudflared/releases/latest)
   - Descarga `cloudflared-windows-amd64.exe` y renómbralo a `cloudflared.exe`.
2. Con tus servidores encendidos (`INICIAR_TODO.bat`), abre una terminal y ejecuta:
   ```bash
   cloudflared tunnel --url http://127.0.0.1:5173
   ```
3. Cloudflare te dará de inmediato un enlace público HTTPS como:
   `https://tu-codigo-temporal.trycloudflare.com`
4. ¡Cualquiera en cualquier celular o computador del mundo podrá entrar y usar NEXIA en tiempo real!

### Con Ngrok (Alternativa rápida):
1. Descarga [ngrok.com](https://ngrok.com)
2. Ejecuta:
   ```bash
   ngrok http 5173
   ```
3. Copia el enlace `https://xxxx.ngrok-free.app` y compártelo.

---

## 🛡️ Credenciales de Demostración para Jurados y Profesores
- **Panel Directivo (Admin):**
  - Correo principal: `admin@nexia.edu.co` | Contraseña: `admin123`
  - Correo alternativo: `rectoria@nexia.edu.co` | Contraseña: `admin123password`
- **Estudiante (Demo):**
  - Correo: `juan.perez@nexia.edu.co` | Contraseña: `secretpassword`
  - O radicar reportes sin cuenta con código anónimo instantáneo.
