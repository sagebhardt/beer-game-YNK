# Deployment — Railway

## Requisitos previos

- Cuenta en [Railway](https://railway.app)
- Repositorio conectado a Railway (GitHub)

## Paso a paso

### 1. Crear proyecto en Railway

1. Ir a [railway.app/new](https://railway.app/new)
2. Seleccionar "Deploy from GitHub repo"
3. Conectar `sagebhardt/beer-game-YNK`
4. Railway detectará el `Dockerfile` automáticamente

### 2. Crear volumen persistente (crítico para SQLite)

Sin volumen, la base de datos se pierde cada deploy.

1. En el dashboard del servicio, ir a **Settings** → **Volumes**
2. Click **"Add Volume"**
3. **Mount Path**: `/app/data`
4. **Size**: 1 GB (más que suficiente)

### 3. Configurar variables de entorno

En el servicio, ir a **Variables** y agregar:

```
NODE_ENV=production
DATA_DIR=/app/data
```

No definir `Start Command` manual en Railway. Déjalo vacío para que use el `CMD` del `Dockerfile`.

### 4. Deploy

Railway hace deploy automático al detectar el Dockerfile. El proceso:

1. **Build**: Multi-stage Docker build (deps → build → runner)
2. **DB Init**: Al iniciar, el container copia `template.db` a `/app/data/prod.db` si no existe
3. **Server**: Ejecuta `node custom-server.js` (Next.js + Socket.io)

### 5. Verificar

- Abrir la URL pública de Railway
- Crear una partida de prueba
- Verificar que el código de acceso se genera correctamente

## Migraciones de schema

SQLite no soporta `ALTER COLUMN`. Cuando cambies el schema de Prisma:

1. Editar `prisma/schema.prisma`
2. Incrementar `SCHEMA_V` en la línea `CMD` del `Dockerfile` (ej: `SCHEMA_V=1` → `SCHEMA_V=2`)
3. Push a main → Railway redeploy
4. **IMPORTANTE**: Esto borra y recrea la base de datos. Todos los juegos existentes se pierden.

```dockerfile
# En Dockerfile, línea CMD:
CMD ["sh", "-c", "SCHEMA_V=2; if [ ! -f ..."]
#                  ^^^^^^^^^ incrementar aquí
```

## Troubleshooting

### La base de datos se pierde en cada deploy
- Verificar que el volumen está montado en `/app/data`
- Verificar que `DATA_DIR=/app/data`

### Socket.io no conecta
- Railway usa HTTPS por defecto, Socket.io debería funcionar
- Si hay problemas de CORS, verificar que el dominio de Railway esté permitido
- El path de Socket.io es `/api/socketio`

### El build falla
- Correr `npm run build` localmente para verificar errores de TypeScript
- Verificar que todas las dependencias están en `package.json` (no en devDependencies si se usan en runtime)

## Estructura Docker

```
Dockerfile (multi-stage)
├── deps      → npm ci
├── builder   → prisma generate, db push (template), next build
└── runner    → standalone output + socket.io + template.db
                CMD: copy template.db → /app/data/prod.db (si no existe)
                     node custom-server.js
```

## Custom domain (opcional)

1. En Railway → Settings → Networking → Custom Domain
2. Agregar dominio y configurar DNS (CNAME al dominio de Railway)
