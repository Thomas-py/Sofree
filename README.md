# SOFREE — Terminal de Contribuciones Open Source

Visualizador en tiempo real de actividad GitHub con estética de terminal hacker.  
Explorá el impacto de cualquier desarrollador: commits, PRs, issues, heatmap y más.

---

## Características

- **Dashboard bento** — identidad, stats, heatmap de 52 semanas, ranking, proyectos activos y feed en vivo
- **Búsqueda de usuarios** — cualquier perfil público de GitHub
- **OSS Advisor** — chatbot integrado con n8n + OpenAI que recomienda herramientas open source
- **Guía de contribución** — 8 proyectos OSS populares con paso a paso interactivo
- **Pantalla de bienvenida** — interfaz limpia al iniciar, sin datos hardcodeados

## Stack

- **Backend:** Python + Flask (proxy de GitHub API)
- **Frontend:** HTML + CSS + JavaScript vanilla
- **IA:** OpenAI GPT-4o-mini vía n8n webhook
- **APIs:** GitHub REST API · github-contributions-api

## Instalación local

```bash
git clone https://github.com/Thomas-py/Sofree
cd Sofree
pip install -r requirements.txt
cp .env.example .env   # opcional: agregá tu GITHUB_TOKEN
python app.py
```

Abrí `http://localhost:5000`

## Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `GITHUB_TOKEN` | Token de GitHub (60 → 5000 req/hora) | No |
| `PORT` | Puerto del servidor (default: 5000) | No |
| `FLASK_DEBUG` | Modo debug (default: true) | No |

## Deploy en Vercel

El repositorio incluye `vercel.json` para deploy directo.  
Agregá `GITHUB_TOKEN` en las variables de entorno de Vercel para mayor rate limit.

## Contribuir

¿Querés mejorar Sofree? ¡Bienvenido!

```bash
git clone https://github.com/Thomas-py/Sofree
git checkout -b feature/mi-mejora
git commit -m "feat: descripción del cambio"
git push origin feature/mi-mejora
```

Abrí un Pull Request y lo revisamos.

## Licencia

MIT — libre para usar, modificar y distribuir.
