import os
import requests
from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# ── CONFIGURACIÓN ──
# Agrega tu token en .env para aumentar el rate limit de 60 → 5000 req/hora
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GH_BASE      = 'https://api.github.com'
CONTRIB_API  = 'https://github-contributions-api.jogruber.de/v4'


def gh_headers():
    """Headers para GitHub API. Incluye token si está configurado."""
    h = {'Accept': 'application/vnd.github+json'}
    if GITHUB_TOKEN:
        h['Authorization'] = f'Bearer {GITHUB_TOKEN}'
    return h


# ── VISTA PRINCIPAL ──

@app.route('/')
def index():
    return render_template('dashboard.html')


# ── PROXY GITHUB API ──
# Todas las llamadas pasan por Flask para evitar CORS en el cliente
# y para poder agregar el token de autenticación de forma segura.

@app.route('/api/users/<username>')
def api_user(username):
    r = requests.get(f'{GH_BASE}/users/{username}', headers=gh_headers())
    return jsonify(r.json()), r.status_code


@app.route('/api/users/<username>/repos')
def api_repos(username):
    r = requests.get(
        f'{GH_BASE}/users/{username}/repos',
        headers=gh_headers(),
        params=request.args   # reenvía sort, per_page, type, etc.
    )
    return jsonify(r.json()), r.status_code


@app.route('/api/users/<username>/events/public')
def api_events(username):
    r = requests.get(
        f'{GH_BASE}/users/{username}/events/public',
        headers=gh_headers(),
        params=request.args   # reenvía per_page
    )
    return jsonify(r.json()), r.status_code


@app.route('/api/repos/<path:full_name>/contributors')
def api_contributors(full_name):
    r = requests.get(
        f'{GH_BASE}/repos/{full_name}/contributors',
        headers=gh_headers(),
        params=request.args
    )
    return jsonify(r.json()), r.status_code


@app.route('/api/contributions/<username>')
def api_contributions(username):
    r = requests.get(
        f'{CONTRIB_API}/{username}',
        params=request.args   # reenvía y=last
    )
    return jsonify(r.json()), r.status_code


# ── INICIO ──
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(debug=debug, port=port)
