# Cómo subir profesionalesok a GitHub

Necesitás una cuenta gratuita en https://github.com. Elegí **una** de estas formas.

## Antes de empezar (importante)

- El archivo `.env` (tus contraseñas y claves) **no está** en este paquete y **nunca** debe subirse. `.gitignore` ya lo excluye.
- Si más adelante cargás credenciales reales de Mercado Pago, hacelo solo en tu `.env` o en las variables de entorno de tu hosting.

## Opción 1: GitHub Desktop (la más simple, sin comandos)

1. Instalá GitHub Desktop: https://desktop.github.com e iniciá sesión.
2. Descomprimí el `.zip`.
3. En GitHub Desktop: **File → Add local repository…** y elegí la carpeta `profesionalesok`. Si te dice que no es un repositorio, tocá **create a repository**.
4. Escribí un mensaje (por ejemplo "Primera versión") y tocá **Commit to main**.
5. Tocá **Publish repository**. Elegí el nombre `profesionalesok` y si va a ser **Private** (solo vos) o **Public** (cualquiera puede verlo).

## Opción 2: terminal

1. En https://github.com/new creá un repositorio vacío llamado `profesionalesok` (sin README ni .gitignore).
2. En la carpeta del proyecto:
   ```bash
   git init -b main
   git add .
   git commit -m "Primera versión de profesionalesok"
   git remote add origin https://github.com/TU-USUARIO/profesionalesok.git
   git push -u origin main
   ```
   Reemplazá `TU-USUARIO` por tu usuario de GitHub.

## Opción 3: desde la página web de GitHub

GitHub permite arrastrar hasta 100 archivos por vez desde el navegador. El proyecto tiene alrededor de 90, así que entra justo.
Creá el repositorio, tocá **uploading an existing file** y arrastrá **el contenido** de la carpeta (no la carpeta). Incluí la carpeta oculta `.github`; si tu sistema no la muestra, usá la Opción 1 o 2.

## Después de subirlo

- En la pestaña **Actions** vas a ver las pruebas automáticas correr solas (tipos, compilación y cobros contra una base real). Tardan unos 3 minutos.
- Para **compartirlo**: si el repositorio es público, pasá el link. Si es privado, en *Settings → Collaborators* invitá por email o usuario.
- Reemplazá `TU-USUARIO` en el `README.md` por tu usuario real.
- Elegí una licencia si querés que otras personas puedan reutilizar el código (ver el final del README).
