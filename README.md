# pia-apps

Una sola dirección con dos botones: **Globología** y **Finanzas**. Sin login. Base de datos en Supabase.

```
pia-apps/
├── index.html        ← pantalla de inicio con los dos botones
├── config.js         ← URL y clave de Supabase (una sola vez para las dos apps)
├── supabase.sql      ← tablas (ya corrido)
├── sin-login.sql     ← abre las tablas para usarlas sin login (correr una vez)
├── globologia/
└── finanzas/
```

## Supabase
1. SQL Editor → New query → pegar `sin-login.sql` → Run.
2. Pegar la clave pública en `config.js`.

## Vercel
Un solo proyecto, con **Root Directory vacío** (la raíz del repo).
